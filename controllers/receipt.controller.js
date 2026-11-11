import sequelize from "../db/db.js";
import Invoice from "../models/invoice.model.js";
import Customer from "../models/customer.model.js";
import Receipt from "../models/receipt.model.js";

// The invoice number and total are shown with each receipt
const invoiceInfo = { model: Invoice, attributes: ['invoice_number', 'invoice_total_amount'] };
// The customer's email and phone are shown on the receipt PDF
const customerContact = { model: Customer, attributes: ['customer_email', 'customer_phone'] };

// Returns the amount as a number, or null when it is not a valid amount
const parseAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || value >= 100000000) return null;
  return Math.round(value * 100) / 100;
};

// POST /api/receipts
// body: { invoice_id, payment_date, amount, payment_method, notes }
export const createReceipt = async (req, res) => {
  const { invoice_id, payment_date, amount, payment_method, notes } = req.body;

  const value = parseAmount(amount);
  if (value === null) return res.status(400).json({ message: "Amount must be more than 0" });
  if (!payment_date) return res.status(400).json({ message: "Payment date is required" });

  const t = await sequelize.transaction();
  try {
    const invoice = await Invoice.findByPk(invoice_id, { transaction: t });
    if (!invoice || invoice.user_id !== req.user_id) {
      await t.rollback();
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Next receipt number for this user
    const last = await Receipt.max('receipt_number', { where: { user_id: req.user_id }, transaction: t });
    const receipt_number = Math.max(last || 0, 999) + 1; // receipt numbers start at 1000

    const receipt = await Receipt.create({
      user_id: req.user_id,
      receipt_number,
      invoice_id: invoice.invoice_id,
      customer_id: invoice.customer_id,
      customer_name: invoice.customer_name,
      payment_date,
      amount: value,
      ...(payment_method && { payment_method }),
      notes
    }, { transaction: t });

    await t.commit();

    const full = await Receipt.findByPk(receipt.receipt_id, { include: [invoiceInfo, customerContact] });
    return res.status(201).json(full);
  } catch (err) {
    await t.rollback();
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: "Another receipt was saved at the same time. Please try again." });
    }
    return res.status(400).json({ message: err.message });
  }
};

// GET /api/receipts  (optional ?invoice_id=12 to get the receipts of one invoice)
export const getReceipts = async (req, res) => {
  const where = { user_id: req.user_id };
  if (req.query.invoice_id) where.invoice_id = req.query.invoice_id;
  const receipts = await Receipt.findAll({ where, include: invoiceInfo, order: [['receipt_number', 'DESC']] });
  return res.json(receipts);
};

// GET /api/receipts/:id
export const getReceipt = async (req, res) => {
  const receipt = await Receipt.findOne({ where: { receipt_id: req.params.id, user_id: req.user_id }, include: [invoiceInfo, customerContact] });
  if (!receipt) return res.status(404).json({ message: "Receipt not found" });
  return res.json(receipt);
};

// PUT /api/receipts/:id
// body (all optional): { payment_date, amount, payment_method, notes }
// The invoice cannot be changed: delete the receipt and make a new one instead
export const updateReceipt = async (req, res) => {
  const { payment_date, amount, payment_method, notes } = req.body;

  try {
    const receipt = await Receipt.findOne({ where: { receipt_id: req.params.id, user_id: req.user_id } });
    if (!receipt) return res.status(404).json({ message: "Receipt not found" });

    if (amount !== undefined) {
      const value = parseAmount(amount);
      if (value === null) return res.status(400).json({ message: "Amount must be more than 0" });
      receipt.amount = value;
    }
    if (payment_date !== undefined) {
      if (!payment_date) return res.status(400).json({ message: "Payment date is required" });
      receipt.payment_date = payment_date;
    }
    if (payment_method !== undefined) receipt.payment_method = payment_method;
    if (notes !== undefined) receipt.notes = notes;

    await receipt.save();

    const full = await Receipt.findByPk(receipt.receipt_id, { include: [invoiceInfo, customerContact] });
    return res.json(full);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

// DELETE /api/receipts/:id
export const deleteReceipt = async (req, res) => {
  const receipt = await Receipt.findOne({ where: { receipt_id: req.params.id, user_id: req.user_id } });
  if (!receipt) return res.status(404).json({ message: "Receipt not found" });

  await receipt.destroy();
  return res.json({ message: "Receipt deleted successfully" });
};
