import { Op } from "sequelize";
import sequelize from "../db/db.js";
import Customer from "../models/customer.model.js";
import Invoice from "../models/invoice.model.js";
import ReturnInvoice from "../models/returnInvoice.model.js";
import Receipt from "../models/receipt.model.js";
import DuePayment from "../models/duePayment.model.js";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const money = n => Math.round(Number(n || 0) * 100) / 100;
const pad = n => String(n).padStart(2, '0');

// Sums one amount column per customer for this user, e.g. { 12: 300, 15: 40 }
const sumPerCustomer = async (Model, column, where) => {
  const rows = await Model.findAll({
    attributes: ['customer_id', [sequelize.fn('SUM', sequelize.col(column)), 'total']],
    where,
    group: ['customer_id'],
    raw: true
  });
  return new Map(rows.map(r => [r.customer_id, Number(r.total || 0)]));
};

// What every customer of this user owes: invoices minus returns minus receipts
const balancesPerCustomer = async (userId) => {
  const where = { user_id: userId };
  const [invoiced, returned, paid] = await Promise.all([
    sumPerCustomer(Invoice, 'invoice_total_amount', where),
    sumPerCustomer(ReturnInvoice, 'return_total_amount', where),
    sumPerCustomer(Receipt, 'amount', where)
  ]);
  const ids = new Set([...invoiced.keys(), ...returned.keys(), ...paid.keys()]);
  const balances = new Map();
  for (const id of ids) {
    balances.set(id, money((invoiced.get(id) || 0) - (returned.get(id) || 0) - (paid.get(id) || 0)));
  }
  return balances;
};

// Gives a due payment number to every customer in the list that does not have one yet.
// Locked per user so two requests at the same time can't hand out the same number.
const assignNumbers = async (userId, customerIds) => {
  if (customerIds.length === 0) return;
  await sequelize.transaction(async (t) => {
    await sequelize.query('SELECT pg_advisory_xact_lock(8231, :userId)', { replacements: { userId }, transaction: t });

    const existing = await DuePayment.findAll({ where: { user_id: userId, customer_id: customerIds }, attributes: ['customer_id'], transaction: t });
    const has = new Set(existing.map(d => d.customer_id));
    const missing = customerIds.filter(id => !has.has(id)).sort((a, b) => a - b);
    if (missing.length === 0) return;

    const last = await DuePayment.max('due_number', { where: { user_id: userId }, transaction: t });
    let next = Math.max(last || 0, 999) + 1; // due payment numbers start at 1000
    await DuePayment.bulkCreate(
      missing.map(customer_id => ({ user_id: userId, customer_id, due_number: next++ })),
      { transaction: t }
    );
  });
};

// GET /api/duePayments/customerBalance/:customerId
// What one customer of this user still owes right now, shown on the receipt PDF
export const getCustomerBalance = async (req, res) => {
  try {
    const customer = await Customer.findOne({ where: { customer_id: req.params.customerId, user_id: req.user_id } });
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const where = { user_id: req.user_id, customer_id: customer.customer_id };
    const [invoiced, returned, paid] = await Promise.all([
      Invoice.sum('invoice_total_amount', { where }),
      ReturnInvoice.sum('return_total_amount', { where }),
      Receipt.sum('amount', { where })
    ]);
    return res.json({ balance: money(Number(invoiced || 0) - Number(returned || 0) - Number(paid || 0)) });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Could not load the customer's balance" });
  }
};

// GET /api/duePayments/getDuePayments
// Every customer of this user that still owes money, with how much
export const getDuePayments = async (req, res) => {
  try {
    const balances = await balancesPerCustomer(req.user_id);
    const owing = [...balances].filter(([, balance]) => balance > 0).map(([id]) => id);

    await assignNumbers(req.user_id, owing);

    const [duePayments, customers] = await Promise.all([
      DuePayment.findAll({ where: { user_id: req.user_id, customer_id: owing }, order: [['due_number', 'DESC']], raw: true }),
      Customer.findAll({ where: { user_id: req.user_id, customer_id: owing }, attributes: ['customer_id', 'customer_name'], raw: true })
    ]);
    const names = new Map(customers.map(c => [c.customer_id, c.customer_name]));

    return res.json(duePayments.map(d => ({
      due_payment_id: d.due_payment_id,
      due_number: d.due_number,
      customer_id: d.customer_id,
      customer_name: names.get(d.customer_id) ?? 'Unknown customer',
      balance: balances.get(d.customer_id) || 0
    })));
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Could not load due payments" });
  }
};

// GET /api/duePayments/getDuePayment/:id?month=2026-11
// The customer's details and every invoice, return and receipt of that month, with a running total.
// The total carries on from what was still owed at the start of the month.
export const getDuePayment = async (req, res) => {
  const now = new Date();
  const month = req.query.month || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  if (!MONTH.test(month)) return res.status(400).json({ message: "month must be YYYY-MM" });

  try {
    const duePayment = await DuePayment.findOne({ where: { due_payment_id: req.params.id, user_id: req.user_id } });
    if (!duePayment) return res.status(404).json({ message: "Due payment not found" });

    const customer = await Customer.findOne({
      where: { customer_id: duePayment.customer_id, user_id: req.user_id },
      attributes: ['customer_id', 'customer_name', 'customer_address', 'customer_phone', 'customer_email']
    });
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const [year, monthNumber] = month.split('-').map(Number);
    const from = `${month}-01`;
    const to = `${month}-${pad(new Date(year, monthNumber, 0).getDate())}`;
    const base = { user_id: req.user_id, customer_id: customer.customer_id };

    const [invoicedBefore, returnedBefore, paidBefore, invoices, returns, receipts] = await Promise.all([
      Invoice.sum('invoice_total_amount', { where: { ...base, invoice_issued_date: { [Op.lt]: from } } }),
      ReturnInvoice.sum('return_total_amount', { where: { ...base, return_date: { [Op.lt]: from } } }),
      Receipt.sum('amount', { where: { ...base, payment_date: { [Op.lt]: from } } }),
      Invoice.findAll({ where: { ...base, invoice_issued_date: { [Op.between]: [from, to] } }, attributes: ['invoice_id', 'invoice_number', 'invoice_issued_date', 'invoice_total_amount', 'createdAt'], raw: true }),
      ReturnInvoice.findAll({ where: { ...base, return_date: { [Op.between]: [from, to] } }, attributes: ['return_id', 'return_number', 'return_date', 'return_total_amount', 'createdAt'], raw: true }),
      Receipt.findAll({ where: { ...base, payment_date: { [Op.between]: [from, to] } }, attributes: ['receipt_id', 'receipt_number', 'payment_date', 'amount', 'createdAt'], raw: true })
    ]);

    const opening_balance = money(Number(invoicedBefore || 0) - Number(returnedBefore || 0) - Number(paidBefore || 0));

    const entries = [
      ...invoices.map(i => ({ type: 'invoice', id: i.invoice_id, number: i.invoice_number, date: i.invoice_issued_date, amount: money(i.invoice_total_amount), createdAt: i.createdAt })),
      ...returns.map(r => ({ type: 'return', id: r.return_id, number: r.return_number, date: r.return_date, amount: money(r.return_total_amount), createdAt: r.createdAt })),
      ...receipts.map(r => ({ type: 'receipt', id: r.receipt_id, number: r.receipt_number, date: r.payment_date, amount: money(r.amount), createdAt: r.createdAt }))
    ].sort((a, b) => a.date.localeCompare(b.date) || new Date(a.createdAt) - new Date(b.createdAt));

    // Invoices add to what is owed, returns and receipts take away from it
    let running = opening_balance;
    const rows = entries.map(({ createdAt, ...entry }) => {
      running = money(entry.type === 'invoice' ? running + entry.amount : running - entry.amount);
      return { ...entry, total: running };
    });

    const totalOf = type => money(rows.filter(r => r.type === type).reduce((sum, r) => sum + r.amount, 0));

    return res.json({
      due_payment_id: duePayment.due_payment_id,
      due_number: duePayment.due_number,
      month,
      Customer: customer,
      opening_balance,
      rows,
      totals: { invoices: totalOf('invoice'), returns: totalOf('return'), receipts: totalOf('receipt') },
      closing_balance: running
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Could not load this due payment" });
  }
};
