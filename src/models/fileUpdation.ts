import { DataTypes, type ModelDefined, type Optional } from 'sequelize'
import sequelize from '../databaseConnection'
import File from './file'

interface FileUpdationAttributes {
  id: number
  oldName: string
  oldParent: string
  newName: string
  newParent: string
  lastModified: Date
  lastChanged: Date
}

type FileUpdationCreationAttributes = Optional<FileUpdationAttributes, 'id'>

const FileUpdation: ModelDefined<
FileUpdationAttributes, FileUpdationCreationAttributes
> = sequelize.define('FileUpdation', {
  oldName: {
    type: DataTypes.STRING,
    validate: {
      min: 1,
      max: 255
    }
  },
  newName: {
    type: DataTypes.STRING,
    validate: {
      min: 1,
      max: 255
    }
  },
  oldParent: {
    type: DataTypes.STRING,
    validate: {
      min: 1,
      max: 4096
    }
  },
  newParent: {
    type: DataTypes.STRING,
    validate: {
      min: 1,
      max: 4096
    }
  },
  lastModified: {
    type: DataTypes.DATE,
    allowNull: false
  },
  lastChanged: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  timestamps: false
})

FileUpdation.hasOne(File)

export type { FileUpdationAttributes, FileUpdationCreationAttributes }
export default FileUpdation
