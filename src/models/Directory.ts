import { DataTypes } from 'sequelize'
import sequelize from '../databaseConnection'

const Directory = sequelize.define('Directory', {
  path: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  lastModified: {
    type: DataTypes.DATE,
    unique: true,
    allowNull: false
  }
})

export default Directory
