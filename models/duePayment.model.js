import { DataTypes } from "sequelize";
import sequelize from "../db/db.js";

// Gives each customer that owes money a due payment number (1000, 1001, ...) per user.
// The amounts themselves are not stored: they are worked out live from invoices, returns and receipts.
const DuePayment = sequelize.define('DuePayment', {
  due_payment_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {                 // the user this due payment belongs to, so each user only sees their own
    type: DataTypes.INTEGER,
    allowNull: false
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  due_number: {              // each user has their own 1000, 1001, 1002...
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  indexes: [
    { unique: true, fields: ['user_id', 'due_number'] },
    { unique: true, fields: ['user_id', 'customer_id'] }
  ]
});

export default DuePayment;
