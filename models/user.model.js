import { DataTypes } from "sequelize";

import sequelize from "../db/db.js";



const User = sequelize.define('User', {

  user_id: {

    type: DataTypes.INTEGER,

    primaryKey: true,

    autoIncrement: true

  },

  username: {

    type: DataTypes.STRING,

    unique: true,

    allowNull: false

  },

  password: {

    type: DataTypes.STRING,

    unique: false,

    allowNull: false

  },

  roles: {

    type: DataTypes.ENUM('observer', 'catering', 'admin'),

    allowNull: false,

    defaultValue: 'observer'

  }

});



export default User;