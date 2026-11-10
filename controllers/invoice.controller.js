import sequelize from "../db/db.js";
import Invoice from "../models/invoice.model.js";
import InvoiceItem from "../models/invoiceItem.model.js";
import Item from "../models/items.model.js";
import Customer from "../models/customer.model.js";
import ReturnInvoice from "../models/returnInvoice.model.js";

// Invoices are what the customer sees: show the price, never our cost
const customerLines = { model: InvoiceItem, attributes: { exclude: ['unit_cost'] } };

// POST /api/invoices
// body: { customer_id, area, invoice_issued_date, items: [{ item_id, quantity }] }
export const createInvoice = async (req, res) => {
  const { customer_id, area, invoice_issued_date, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Invoice must have at least one item" });
  }

  const t = await sequelize.transaction();
  try {
    const customer = await Customer.findByPk(customer_id, { transaction: t });
    if (!customer || customer.user_id !== req.user_id) throw new Error("Customer not found");

    // 1. Load the current catalog prices for the requested items
    const ids = items.map(i => i.item_id);
    const catalog = await Item.findAll({ where: { item_id: ids }, transaction: t });
    const byId = new Map(catalog.map(it => [it.item_id, it]));

    // 2. Build the lines, copying name + price + cost
    let total = 0;
    const lines = items.map(({ item_id, quantity = 1 }) => {
      const item = byId.get(item_id);
      if (!item) throw new Error(`Item ${item_id} not found`);
      if (item.unit_price === null) throw new Error(`Item ${item.item_name} has no unit price set`);
      const qty = Math.max(1, parseInt(quantity, 10) || 1);
      const unit_price = Number(item.unit_price);
      const unit_cost = Number(item.unit_cost);
      const line_total = unit_price * qty;
      total += line_total;
      return { item_id, item_name: item.item_name, unit_price, unit_cost, quantity: qty, line_total };
    });

    // 3. Next invoice number for this user
    const last = await Invoice.max('invoice_number', { where: { user_id: req.user_id }, transaction: t });
    const invoice_number = (last || 0) + 1;

    // 4. Create the invoice and its lines
    const invoice = await Invoice.create({
      user_id: req.user_id,
      invoice_number, area, customer_id,
      customer_name: customer.customer_name,
      invoice_issued_date,
      invoice_total_amount: total
    }, { transaction: t });

    await InvoiceItem.bulkCreate(
      lines.map(l => ({ ...l, invoice_id: invoice.invoice_id })),
      { transaction: t }
    );

    await t.commit();

    const full = await Invoice.findByPk(invoice.invoice_id, { include: customerLines });
    return res.status(201).json(full);
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ message: err.message });
  }
};

// PUT /api/invoices/:id
// body (all optional): { customer_id, invoice_issued_date, items: [{ item_id, quantity }] }
// Items already on the invoice keep their saved price and cost; only new items take the current catalog ones.
export const updateInvoice = async (req, res) => {
  const { customer_id, invoice_issued_date, items } = req.body;

  if (items !== undefined && (!Array.isArray(items) || items.length === 0)) {
    return res.status(400).json({ message: "Invoice must have at least one item" });
  }

  const t = await sequelize.transaction();
  try {
    const invoice = await Invoice.findOne({ where: { invoice_id: req.params.id, user_id: req.user_id }, include: InvoiceItem, transaction: t });
    if (!invoice) {
      await t.rollback();
      return res.status(404).json({ message: "Invoice not found" });
    }

    // 1. Customer changed -> copy the new customer's name
    if (customer_id !== undefined && customer_id !== invoice.customer_id) {
      const customer = await Customer.findByPk(customer_id, { transaction: t });
      if (!customer || customer.user_id !== req.user_id) throw new Error("Customer not found");
      invoice.customer_id = customer_id;
      invoice.customer_name = customer.customer_name;
    }

    if (invoice_issued_date !== undefined) {
      invoice.invoice_issued_date = invoice_issued_date;
    }

    // 2. Items sent -> rebuild the lines
    if (items !== undefined) {
      // Returns point at these lines, so they can't be rebuilt once a return exists
      const returnCount = await ReturnInvoice.count({ where: { invoice_id: invoice.invoice_id }, transaction: t });
      if (returnCount > 0) {
        await t.rollback();
        return res.status(409).json({ message: "Cannot change items: this invoice has returns" });
      }

      const saved = new Map(invoice.InvoiceItems.map(l => [l.item_id, l]));

      // Only look up catalog prices for items that are new to this invoice
      const newIds = items.map(i => i.item_id).filter(id => !saved.has(id));
      const catalog = newIds.length
        ? await Item.findAll({ where: { item_id: newIds }, transaction: t })
        : [];
      const byId = new Map(catalog.map(it => [it.item_id, it]));

      let total = 0;
      const lines = items.map(({ item_id, quantity = 1 }) => {
        const qty = Math.max(1, parseInt(quantity, 10) || 1);
        const old = saved.get(item_id);
        let item_name, unit_price, unit_cost;
        if (old) {
          item_name = old.item_name;
          unit_price = Number(old.unit_price);
          unit_cost = old.unit_cost === null ? null : Number(old.unit_cost);
        } else {
          const item = byId.get(item_id);
          if (!item) throw new Error(`Item ${item_id} not found`);
          if (item.unit_price === null) throw new Error(`Item ${item.item_name} has no unit price set`);
          item_name = item.item_name;
          unit_price = Number(item.unit_price);
          unit_cost = Number(item.unit_cost);
        }
        const line_total = unit_price * qty;
        total += line_total;
        return { invoice_id: invoice.invoice_id, item_id, item_name, unit_price, unit_cost, quantity: qty, line_total };
      });

      await InvoiceItem.destroy({ where: { invoice_id: invoice.invoice_id }, transaction: t });
      await InvoiceItem.bulkCreate(lines, { transaction: t });
      invoice.invoice_total_amount = total;
    }

    await invoice.save({ transaction: t });
    await t.commit();

    const full = await Invoice.findByPk(invoice.invoice_id, { include: customerLines });
    return res.json(full);
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ message: err.message });
  }
};

// GET /api/invoices/:id  -> shows the copied prices, not the current ones
export const getInvoice = async (req, res) => {
  const invoice = await Invoice.findOne({ where: { invoice_id: req.params.id, user_id: req.user_id }, include: customerLines });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  return res.json(invoice);
};

// GET /api/invoices
export const getInvoices = async (req, res) => {
  const invoices = await Invoice.findAll({ where: { user_id: req.user_id }, order: [['invoice_number', 'DESC']] });
  return res.json(invoices);
};
