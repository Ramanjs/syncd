import { type ModelDefined, DataTypes, type Optional } from 'sequelize'
import { statusConfig } from '../config/status'
import Directory from './directory'
import sequelize from '../databaseConnection'

interface FileAttributes {
  id: number
  name: string
  hash: string
  lastModified: Date
  lastChanged: Date
  parent: string
  status: string
}

type FileCreationAttributes = Optional<FileAttributes, 'id'>

const File: ModelDefined<
FileAttributes, FileCreationAttributes
> = sequelize.define('File', {
  name: {
    type: DataTypes.STRING,
    validate: {
      len: [1, 255]
    }
  },
  hash: {
    type: DataTypes.STRING(64),
    validate: {
      len: [64, 64]
    }
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
      len: [1, 4096]
    }
  },
  status: {
    type: DataTypes.ENUM(
      statusConfig.PENDING_ADDITION,
      statusConfig.PENDING_DELETION,
      statusConfig.PENDING_UPDATE,
      statusConfig.DONE
    )
  }
})

File.belongsTo(Directory, {
  foreignKey: 'parent'
})

export type { FileAttributes, FileCreationAttributes }
export default File
