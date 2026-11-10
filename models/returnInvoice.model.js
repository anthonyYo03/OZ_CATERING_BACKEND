import { DataTypes } from "sequelize";
import sequelize from "../db/db.js";

const ReturnInvoice = sequelize.define('ReturnInvoice', {
  return_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {                 // the user who made this return (empty on old rows from before this existed)
    type: DataTypes.INTEGER,
    allowNull: true
  },
  return_number: {           // each user has their own 1, 2, 3...
    type: DataTypes.INTEGER,
    allowNull: false
  },
  invoice_id: {              // the original invoice the items came from
    type: DataTypes.INTEGER,
    allowNull: false
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  customer_name: {           // copy from the original invoice
    type: DataTypes.STRING,
    allowNull: false
  },
  return_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  reason: {
    type: DataTypes.ENUM('expired', 'damaged', 'other'),
    allowNull: false,
    defaultValue: 'expired'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  return_total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }
}, {
  indexes: [{ unique: true, fields: ['user_id', 'return_number'] }]
});

export default ReturnInvoice;
