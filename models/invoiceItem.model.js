import { DataTypes } from "sequelize";
import sequelize from "../db/db.js";

const InvoiceItem = sequelize.define('InvoiceItem', {
  invoice_item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invoice_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  item_id: {
    type: DataTypes.INTEGER,
    allowNull: true          // stays null if the item is deleted from the catalog later
  },
  item_name: {               // copy of the name at sale time
    type: DataTypes.STRING,
    allowNull: false
  },
  unit_price: {              // copy of the price at sale time
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  unit_cost: {               // copy of our cost at sale time, used for profit (hidden from customers)
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true          // null on lines saved before cost was copied: their profit is unknown
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

export default InvoiceItem;
