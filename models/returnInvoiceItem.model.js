import { DataTypes } from "sequelize";
import sequelize from "../db/db.js";

const ReturnInvoiceItem = sequelize.define('ReturnInvoiceItem', {
  return_item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  return_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  invoice_item_id: {         // the line on the original invoice being returned
    type: DataTypes.INTEGER,
    allowNull: false
  },
  item_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  item_name: {               // copy from the original invoice line
    type: DataTypes.STRING,
    allowNull: false
  },
  unit_price: {              // the price the customer paid, not today's price
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  unit_cost: {               // our cost from the original invoice line, so the return takes back that profit
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true          // null when the original line has no saved cost
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: { min: 1 }
  },
  line_total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }
});

export default ReturnInvoiceItem;
