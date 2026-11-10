import { DataTypes } from "sequelize";

import sequelize from "../db/db.js";




const Invoice = sequelize.define('Invoice', {
  invoice_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {                  // the user who made this invoice (empty on old rows from before this existed)
    type: DataTypes.INTEGER,
    allowNull: true
  },
  invoice_number: {           // each user has their own 1, 2, 3...
    type: DataTypes.INTEGER,
    allowNull: false
  },
 
     customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  customer_name: {            // copy of the name at the time of the invoice
    type: DataTypes.STRING,
    allowNull: false
  },

  invoice_issued_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  
  invoice_total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }


}, {
  indexes: [{ unique: true, fields: ['user_id', 'invoice_number'] }]
});

export default Invoice;