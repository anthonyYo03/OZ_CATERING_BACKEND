import { Op } from "sequelize";
import sequelize from "../db/db.js";
import Invoice from "../models/invoice.model.js";
import InvoiceItem from "../models/invoiceItem.model.js";
import ReturnInvoice from "../models/returnInvoice.model.js";
import ReturnInvoiceItem from "../models/returnInvoiceItem.model.js";

// Returns are shown to the customer too: show the price, never our cost
const customerLines = { model: ReturnInvoiceItem, attributes: { exclude: ['unit_cost'] } };

// Builds the return lines from the original invoice lines.
// Uses the price the customer paid and stops returning more than was sold
// (counting what earlier returns already took back).
const buildReturnLines = async (invoice_id, items, t, excludeReturnId = null) => {
  const invoiceLines = await InvoiceItem.findAll({ where: { invoice_id }, transaction: t });
  const byId = new Map(invoiceLines.map(l => [l.invoice_item_id, l]));

  const where = { invoice_item_id: invoiceLines.map(l => l.invoice_item_id) };
  if (excludeReturnId) where.return_id = { [Op.ne]: excludeReturnId };
  const previous = await ReturnInvoiceItem.findAll({ where, transaction: t });

  const alreadyReturned = new Map();
  for (const p of previous) {
    alreadyReturned.set(p.invoice_item_id, (alreadyReturned.get(p.invoice_item_id) || 0) + p.quantity);
  }

  let total = 0;
  const lines = items.map(({ invoice_item_id, quantity = 1 }) => {
    const line = byId.get(invoice_item_id);
    if (!line) throw new Error(`Line ${invoice_item_id} is not on invoice ${invoice_id}`);

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const returned = alreadyReturned.get(invoice_item_id) || 0;
    const left = line.quantity - returned;
    if (qty > left) {
      throw new Error(`Cannot return ${qty} x ${line.item_name}: only ${left} left to return`);
    }
    alreadyReturned.set(invoice_item_id, returned + qty); // same line sent twice in one request

    const unit_price = Number(line.unit_price);
    const unit_cost = line.unit_cost === null ? null : Number(line.unit_cost); // takes back the profit of that sale
    const line_total = unit_price * qty;
    total += line_total;
    return { invoice_item_id, item_id: line.item_id, item_name: line.item_name, unit_price, unit_cost, quantity: qty, line_total };
  });

  return { lines, total };
};

// POST /api/returns
// body: { invoice_id, return_date, reason, notes, items: [{ invoice_item_id, quantity }] }
export const createReturn = async (req, res) => {
  const { invoice_id, return_date, reason, notes, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Return must have at least one item" });
  }

  const t = await sequelize.transaction();
  try {
    // Lock the invoice so two returns on it can't be saved at the same time
    const invoice = await Invoice.findByPk(invoice_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!invoice || invoice.user_id !== req.user_id) {
      await t.rollback();
      return res.status(404).json({ message: "Invoice not found" });
    }

    const { lines, total } = await buildReturnLines(invoice.invoice_id, items, t);

    const last = await ReturnInvoice.max('return_number', { where: { user_id: req.user_id }, transaction: t });
    const return_number = Math.max(last || 0, 999) + 1; // return numbers start at 1000

    const returnInvoice = await ReturnInvoice.create({
      user_id: req.user_id,
      return_number,
      invoice_id: invoice.invoice_id,
      customer_id: invoice.customer_id,
      customer_name: invoice.customer_name,
      return_date,
      ...(reason && { reason }),
      notes,
      return_total_amount: total
    }, { transaction: t });

    await ReturnInvoiceItem.bulkCreate(
      lines.map(l => ({ ...l, return_id: returnInvoice.return_id })),
      { transaction: t }
    );

    await t.commit();

    const full = await ReturnInvoice.findByPk(returnInvoice.return_id, { include: customerLines });
    return res.status(201).json(full);
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ message: err.message });
  }
};

// GET /api/returns  (optional ?invoice_id=12 to get the returns of one invoice)
export const getReturns = async (req, res) => {
  const where = { user_id: req.user_id };
  if (req.query.invoice_id) where.invoice_id = req.query.invoice_id;
  const returns = await ReturnInvoice.findAll({ where, order: [['return_number', 'DESC']] });
  return res.json(returns);
};

// GET /api/returns/:id
export const getReturn = async (req, res) => {
  const returnInvoice = await ReturnInvoice.findOne({ where: { return_id: req.params.id, user_id: req.user_id }, include: customerLines });
  if (!returnInvoice) return res.status(404).json({ message: "Return not found" });
  return res.json(returnInvoice);
};

// PUT /api/returns/:id
// body (all optional): { return_date, reason, notes, items: [{ invoice_item_id, quantity }] }
export const updateReturn = async (req, res) => {
  const { return_date, reason, notes, items } = req.body;

  if (items !== undefined && (!Array.isArray(items) || items.length === 0)) {
    return res.status(400).json({ message: "Return must have at least one item" });
  }

  const t = await sequelize.transaction();
  try {
    const returnInvoice = await ReturnInvoice.findOne({ where: { return_id: req.params.id, user_id: req.user_id }, transaction: t });
    if (!returnInvoice) {
      await t.rollback();
      return res.status(404).json({ message: "Return not found" });
    }

    if (return_date !== undefined) returnInvoice.return_date = return_date;
    if (reason !== undefined) returnInvoice.reason = reason;
    if (notes !== undefined) returnInvoice.notes = notes;

    if (items !== undefined) {
      await Invoice.findByPk(returnInvoice.invoice_id, { transaction: t, lock: t.LOCK.UPDATE });

      const { lines, total } = await buildReturnLines(returnInvoice.invoice_id, items, t, returnInvoice.return_id);

      await ReturnInvoiceItem.destroy({ where: { return_id: returnInvoice.return_id }, transaction: t });
      await ReturnInvoiceItem.bulkCreate(
        lines.map(l => ({ ...l, return_id: returnInvoice.return_id })),
        { transaction: t }
      );
      returnInvoice.return_total_amount = total;
    }

    await returnInvoice.save({ transaction: t });
    await t.commit();

    const full = await ReturnInvoice.findByPk(returnInvoice.return_id, { include: customerLines });
    return res.json(full);
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ message: err.message });
  }
};

// DELETE /api/returns/:id  -> its lines are deleted with it
export const deleteReturn = async (req, res) => {
  const returnInvoice = await ReturnInvoice.findOne({ where: { return_id: req.params.id, user_id: req.user_id } });
  if (!returnInvoice) return res.status(404).json({ message: "Return not found" });

  await returnInvoice.destroy();
  return res.json({ message: "Return deleted successfully" });
};
