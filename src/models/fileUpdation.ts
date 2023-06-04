import { DataTypes, type ModelDefined } from 'sequelize'
import sequelize from '../databaseConnection'

interface FileUpdationAttributes {
  oldName: string
  oldParent: string
  newName: string
  newParent: string
  lastModified: Date
  lastChanged: Date
}

const FileUpdation: ModelDefined<
FileUpdationAttributes, FileUpdationAttributes
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
})

export type { FileUpdationAttributes }
export default FileUpdation
