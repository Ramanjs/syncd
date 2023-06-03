import { type ModelDefined, DataTypes } from 'sequelize'
import Directory from './directory'
import sequelize from '../databaseConnection'

interface FileAttributes {
  name: string
  hash: string
  lastModified: Date
  lastChanged: Date
}

const File: ModelDefined<FileAttributes, FileAttributes> = sequelize.define('File', {
  name: {
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
  },
  lastChanged: {
    type: DataTypes.DATE,
    allowNull: false
  }
})

File.belongsTo(Directory)

export type { FileAttributes }
export default File
