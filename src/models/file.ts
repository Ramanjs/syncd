import { type ModelDefined, DataTypes, type Optional } from 'sequelize'
import Directory from './directory'
import sequelize from '../databaseConnection'

interface FileAttributes {
  id: number
  name: string
  hash: string
  lastModified: Date
  lastChanged: Date
  parent: string
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
  hash: {
    type: DataTypes.STRING(64),
    validate: {
      min: 1,
      max: 64
    },
    allowNull: false
  },
  lastModified: {
    type: DataTypes.DATE,
    allowNull: false
  },
  lastChanged: {
    type: DataTypes.DATE,
    allowNull: false
  },
  parent: {
    type: DataTypes.STRING,
    validate: {
      min: 1,
      max: 4096
    }
  }
})

File.belongsTo(Directory, {
  foreignKey: 'parent'
})

export type { FileAttributes, FileCreationAttributes }
export default File
