import { DataTypes } from "sequelize";

import sequelize from "../db/db.js";




const Item = sequelize.define('Item', {

  item_id: {

    type: DataTypes.INTEGER,

    primaryKey: true,

    autoIncrement: true

  },

  user_id: {                 // the user who added this item (empty on old rows from before this existed)

    type: DataTypes.INTEGER,
    allowNull: true

  },

  categories: {

    type: DataTypes.ENUM('Sandwiches', 'Salads'),

    allowNull: false,

    defaultValue: 'Sandwiches'

  },

  item_name: {

    type: DataTypes.STRING,

    allowNull: false

  },

  unit_cost: {              // what the item costs us (never shown to customers)

    type: DataTypes.DECIMAL(10, 2),

    allowNull: false,
 },

  unit_price: {             // what the customer pays
    // Nullable only so sync can add it to items that already exist.
    // The controller requires it for new items, and an invoice refuses an item without one.
    type: DataTypes.DECIMAL(10, 2),

    allowNull: true
  }

}, {
  // Unique per user: two users can each have an item with the same name without seeing each other's
  indexes: [
    { unique: true, fields: ['user_id', 'item_name'] }
  ]
});




export default Item;