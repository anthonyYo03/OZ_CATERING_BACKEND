import { Op } from "sequelize";
import sequelize from "../db/db.js";
import Invoice from "../models/invoice.model.js";
import InvoiceItem from "../models/invoiceItem.model.js";
import ReturnInvoice from "../models/returnInvoice.model.js";
import ReturnInvoiceItem from "../models/returnInvoiceItem.model.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const money = n => Math.round(Number(n || 0) * 100) / 100;

// GET /api/summary?from=2026-11-01&to=2026-11-30
// Calculated live from invoices and returns, so it is always up to date.
export const getSummary = async (req, res) => {
  const { from, to } = req.query;

  if (!DATE.test(from || '') || !DATE.test(to || '')) {
    return res.status(400).json({ message: "from and to are required as YYYY-MM-DD" });
  }
  if (from > to) {
    return res.status(400).json({ message: "from must be before to" });
  }

  try {
    const invoiceWhere = { user_id: req.user_id, invoice_issued_date: { [Op.between]: [from, to] } };
    const returnWhere = { user_id: req.user_id, return_date: { [Op.between]: [from, to] } };

    // 1. Totals
    const [sales, invoiceCount, returns, returnCount] = await Promise.all([
      Invoice.sum('invoice_total_amount', { where: invoiceWhere }),
      Invoice.count({ where: invoiceWhere }),
      ReturnInvoice.sum('return_total_amount', { where: returnWhere }),
      ReturnInvoice.count({ where: returnWhere })
    ]);

    // 2. Per item: sold and returned in this range
    const [soldItems, returnedItems] = await Promise.all([
      InvoiceItem.findAll({
        attributes: [
          'item_id',
          [sequelize.fn('MAX', sequelize.col('InvoiceItem.item_name')), 'item_name'],
          [sequelize.fn('SUM', sequelize.col('InvoiceItem.quantity')), 'quantity'],
          [sequelize.fn('SUM', sequelize.col('InvoiceItem.line_total')), 'amount']
        ],
        include: [{ model: Invoice, attributes: [], where: invoiceWhere }],
        group: [sequelize.col('InvoiceItem.item_id')],
        raw: true
      }),
      ReturnInvoiceItem.findAll({
        attributes: [
          'item_id',
          [sequelize.fn('MAX', sequelize.col('ReturnInvoiceItem.item_name')), 'item_name'],
          [sequelize.fn('SUM', sequelize.col('ReturnInvoiceItem.quantity')), 'quantity'],
          [sequelize.fn('SUM', sequelize.col('ReturnInvoiceItem.line_total')), 'amount']
        ],
        include: [{ model: ReturnInvoice, attributes: [], where: returnWhere }],
        group: [sequelize.col('ReturnInvoiceItem.item_id')],
        raw: true
      })
    ]);

    const items = new Map();
    const itemRow = (r) => {
      const key = r.item_id ?? `deleted:${r.item_name}`;
      if (!items.has(key)) {
        items.set(key, { item_id: r.item_id, item_name: r.item_name, sold_quantity: 0, sold_amount: 0, returned_quantity: 0, returned_amount: 0 });
      }
      return items.get(key);
    };
    for (const r of soldItems) {
      const row = itemRow(r);
      row.sold_quantity += Number(r.quantity);
      row.sold_amount += Number(r.amount);
    }
    for (const r of returnedItems) {
      const row = itemRow(r);
      row.returned_quantity += Number(r.quantity);
      row.returned_amount += Number(r.amount);
    }

    // 3. Per customer: bought and returned in this range
    const [soldCustomers, returnedCustomers] = await Promise.all([
      Invoice.findAll({
        attributes: [
          'customer_id',
          [sequelize.fn('MAX', sequelize.col('customer_name')), 'customer_name'],
          [sequelize.fn('COUNT', sequelize.col('invoice_id')), 'invoice_count'],
          [sequelize.fn('SUM', sequelize.col('invoice_total_amount')), 'amount']
        ],
        where: invoiceWhere,
        group: ['customer_id'],
        raw: true
      }),
      ReturnInvoice.findAll({
        attributes: [
          'customer_id',
          [sequelize.fn('MAX', sequelize.col('customer_name')), 'customer_name'],
          [sequelize.fn('SUM', sequelize.col('return_total_amount')), 'amount']
        ],
        where: returnWhere,
        group: ['customer_id'],
        raw: true
      })
    ]);

    const customers = new Map();
    const customerRow = (r) => {
      if (!customers.has(r.customer_id)) {
        customers.set(r.customer_id, { customer_id: r.customer_id, customer_name: r.customer_name, invoice_count: 0, sales: 0, returns: 0 });
      }
      return customers.get(r.customer_id);
    };
    for (const r of soldCustomers) {
      const row = customerRow(r);
      row.invoice_count = Number(r.invoice_count);
      row.sales = Number(r.amount);
    }
    for (const r of returnedCustomers) {
      customerRow(r).returns = Number(r.amount);
    }

    return res.json({
      from,
      to,
      invoice_count: invoiceCount,
      return_count: returnCount,
      sales: money(sales),
      returns: money(returns),
      net: money(sales - returns),
      items: [...items.values()]
        .map(i => ({
          ...i,
          sold_amount: money(i.sold_amount),
          returned_amount: money(i.returned_amount),
          net_quantity: i.sold_quantity - i.returned_quantity,
          net_amount: money(i.sold_amount - i.returned_amount)
        }))
        .sort((a, b) => b.net_amount - a.net_amount),
      customers: [...customers.values()]
        .map(c => ({ ...c, sales: money(c.sales), returns: money(c.returns), net: money(c.sales - c.returns) }))
        .sort((a, b) => b.net - a.net)
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: `An error occurred while building the summary ${err}` });
  }
};

// Per item: revenue, cost and how many lines have no saved cost.
// Lines without a cost (saved before cost was copied) can't give a profit, so they are left out of it and counted.
const profitAttributes = (model) => {
  const col = (c) => `"${model}"."${c}"`;
  return [
    'item_id',
    [sequelize.fn('MAX', sequelize.col(`${model}.item_name`)), 'item_name'],
    [sequelize.fn('SUM', sequelize.col(`${model}.quantity`)), 'quantity'],
    [sequelize.literal(`SUM(CASE WHEN ${col('unit_cost')} IS NOT NULL THEN ${col('line_total')} ELSE 0 END)`), 'revenue'],
    [sequelize.literal(`SUM(COALESCE(${col('unit_cost')} * ${col('quantity')}, 0))`), 'cost'],
    [sequelize.literal(`SUM(CASE WHEN ${col('unit_cost')} IS NULL THEN 1 ELSE 0 END)`), 'missing_cost_lines']
  ];
};

// GET /api/summary/profit?from=2026-11-01&to=2026-11-30
// profit = (price - cost) x quantity of what was sold in the range, minus the same for what was returned in the range.
export const getProfit = async (req, res) => {
  const { from, to } = req.query;

  if (!DATE.test(from || '') || !DATE.test(to || '')) {
    return res.status(400).json({ message: "from and to are required as YYYY-MM-DD" });
  }
  if (from > to) {
    return res.status(400).json({ message: "from must be before to" });
  }

  try {
    const invoiceWhere = { user_id: req.user_id, invoice_issued_date: { [Op.between]: [from, to] } };
    const returnWhere = { user_id: req.user_id, return_date: { [Op.between]: [from, to] } };

    const [soldItems, returnedItems] = await Promise.all([
      InvoiceItem.findAll({
        attributes: profitAttributes('InvoiceItem'),
        include: [{ model: Invoice, attributes: [], where: invoiceWhere }],
        group: [sequelize.col('InvoiceItem.item_id')],
        raw: true
      }),
      ReturnInvoiceItem.findAll({
        attributes: profitAttributes('ReturnInvoiceItem'),
        include: [{ model: ReturnInvoice, attributes: [], where: returnWhere }],
        group: [sequelize.col('ReturnInvoiceItem.item_id')],
        raw: true
      })
    ]);

    const items = new Map();
    const itemRow = (r) => {
      const key = r.item_id ?? `deleted:${r.item_name}`;
      if (!items.has(key)) {
        items.set(key, { item_id: r.item_id, item_name: r.item_name, sold_quantity: 0, returned_quantity: 0, revenue: 0, cost: 0, missing_cost_lines: 0 });
      }
      return items.get(key);
    };
    for (const r of soldItems) {
      const row = itemRow(r);
      row.sold_quantity += Number(r.quantity);
      row.revenue += Number(r.revenue);
      row.cost += Number(r.cost);
      row.missing_cost_lines += Number(r.missing_cost_lines);
    }
    for (const r of returnedItems) {
      const row = itemRow(r);
      row.returned_quantity += Number(r.quantity);
      row.revenue -= Number(r.revenue);
      row.cost -= Number(r.cost);
      row.missing_cost_lines += Number(r.missing_cost_lines);
    }

    const list = [...items.values()]
      .map(i => ({ ...i, revenue: money(i.revenue), cost: money(i.cost), profit: money(i.revenue - i.cost) }))
      .sort((a, b) => b.profit - a.profit);

    const revenue = list.reduce((s, i) => s + i.revenue, 0);
    const cost = list.reduce((s, i) => s + i.cost, 0);

    return res.json({
      from,
      to,
      revenue: money(revenue),          // sales minus returns (only lines with a known cost)
      cost: money(cost),
      profit: money(revenue - cost),
      missing_cost_lines: list.reduce((s, i) => s + i.missing_cost_lines, 0),
      items: list
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: `An error occurred while calculating the profit ${err}` });
  }
};
