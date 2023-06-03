import { type ModelDefined, DataTypes, type Optional } from 'sequelize'
import Directory from './directory'
import sequelize from '../databaseConnection'

interface FileAttributes {
  id: number
  name: string
  path: string
  hash: string
  lastModified: Date
  lastChanged: Date
}

type FileCreationAttributes = Optional<FileAttributes, 'id'>

const File: ModelDefined<
FileAttributes, FileCreationAttributes
> = sequelize.define('File', {
  name: {
    type: DataTypes.STRING,
    validate: {
      min: 1,
      max: 255
    },
    allowNull: false
  },
  path: {
    type: DataTypes.STRING,
    validate: {
      min: 1,
      max: 4096
    },
    unique: true
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

export type { FileAttributes, FileCreationAttributes }
export default File
