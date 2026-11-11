import Invoice from "./invoice.model.js";
import InvoiceItem from "./invoiceItem.model.js";
import Item from "./items.model.js";
import Customer from "./customer.model.js";
import ReturnInvoice from "./returnInvoice.model.js";
import ReturnInvoiceItem from "./returnInvoiceItem.model.js";
import User from "./user.model.js";
import Receipt from "./receipt.model.js";

// Each customer, invoice and return belongs to the user who created it
User.hasMany(Customer, { foreignKey: 'user_id', onDelete: 'RESTRICT' });
Customer.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Invoice, { foreignKey: 'user_id', onDelete: 'RESTRICT' });
Invoice.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(ReturnInvoice, { foreignKey: 'user_id', onDelete: 'RESTRICT' });
ReturnInvoice.belongsTo(User, { foreignKey: 'user_id' });

Invoice.hasMany(InvoiceItem, { foreignKey: 'invoice_id', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoice_id' });

Item.hasMany(InvoiceItem, { foreignKey: 'item_id', onDelete: 'SET NULL' });
InvoiceItem.belongsTo(Item, { foreignKey: 'item_id' });

Customer.hasMany(Invoice, { foreignKey: 'customer_id', onDelete: 'RESTRICT' });
Invoice.belongsTo(Customer, { foreignKey: 'customer_id' });

// Returns
Invoice.hasMany(ReturnInvoice, { foreignKey: 'invoice_id', onDelete: 'RESTRICT' });
ReturnInvoice.belongsTo(Invoice, { foreignKey: 'invoice_id' });

Customer.hasMany(ReturnInvoice, { foreignKey: 'customer_id', onDelete: 'RESTRICT' });
ReturnInvoice.belongsTo(Customer, { foreignKey: 'customer_id' });

ReturnInvoice.hasMany(ReturnInvoiceItem, { foreignKey: 'return_id', onDelete: 'CASCADE' });
ReturnInvoiceItem.belongsTo(ReturnInvoice, { foreignKey: 'return_id' });

InvoiceItem.hasMany(ReturnInvoiceItem, { foreignKey: 'invoice_item_id', onDelete: 'RESTRICT' });
ReturnInvoiceItem.belongsTo(InvoiceItem, { foreignKey: 'invoice_item_id' });

Item.hasMany(ReturnInvoiceItem, { foreignKey: 'item_id', onDelete: 'SET NULL' });
ReturnInvoiceItem.belongsTo(Item, { foreignKey: 'item_id' });

// Receipts
User.hasMany(Receipt, { foreignKey: 'user_id', onDelete: 'RESTRICT' });
Receipt.belongsTo(User, { foreignKey: 'user_id' });

Invoice.hasMany(Receipt, { foreignKey: 'invoice_id', onDelete: 'RESTRICT' });
Receipt.belongsTo(Invoice, { foreignKey: 'invoice_id' });

Customer.hasMany(Receipt, { foreignKey: 'customer_id', onDelete: 'RESTRICT' });
Receipt.belongsTo(Customer, { foreignKey: 'customer_id' });
