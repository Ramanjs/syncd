import { DataTypes } from 'sequelize'
import Directory from './Directory'
import sequelize from '../databaseConnection'

const File = sequelize.define('File', {
  fileName: {
    type: DataTypes.STRING,
    validate: {
      min: 1,
      max: 255
    },
    allowNull: false
  },
  hash: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  lastModified: {
    type: DataTypes.DATE,
    allowNull: false
  }
})

File.belongsTo(Directory)

export default File
