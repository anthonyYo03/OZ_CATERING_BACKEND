import { DataTypes } from "sequelize";

import sequelize from "../db/db.js";




const User = sequelize.define('Customer', {

  customer_id: {

    type: DataTypes.INTEGER,

    primaryKey: true,

    autoIncrement: true

  },

  user_id: {                 // the user who added this customer (empty on old rows from before this existed)

    type: DataTypes.INTEGER,
    allowNull: true

  },

  customer_name: {

    type: DataTypes.STRING,
    allowNull: false

  },

  customer_email: {

    type: DataTypes.STRING,
    allowNull: false

  },

    customer_phone: {
         type: DataTypes.STRING,
    allowNull: false

},

customer_address: {
    type: DataTypes.STRING,
    allowNull: false
},


}, {
  // Unique per user: two users can each have the same customer without seeing each other's
  indexes: [
    { unique: true, fields: ['user_id', 'customer_name'] },
    { unique: true, fields: ['user_id', 'customer_email'] },
    { unique: true, fields: ['user_id', 'customer_phone'] },
    { unique: true, fields: ['user_id', 'customer_address'] }
  ]
});



export default User;