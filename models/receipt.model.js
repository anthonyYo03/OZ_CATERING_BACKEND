import { DataTypes } from "sequelize";
import sequelize from "../db/db.js";

const Receipt = sequelize.define('Receipt', {
  receipt_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {                 // the user who made this receipt, so each user only sees their own
    type: DataTypes.INTEGER,
    allowNull: false
  },
  receipt_number: {          // each user has their own 1000, 1001, 1002...
    type: DataTypes.INTEGER,
    allowNull: false
  },
  invoice_id: {              // the invoice this payment is for
    type: DataTypes.INTEGER,
    allowNull: false
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  customer_name: {           // copy from the invoice
    type: DataTypes.STRING,
    allowNull: false
  },
  payment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  amount: {                  // how much was paid
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'card', 'bank_transfer', 'cheque'),
    allowNull: false,
    defaultValue: 'cash'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  indexes: [{ unique: true, fields: ['user_id', 'receipt_number'] }]
});

export default Receipt;
