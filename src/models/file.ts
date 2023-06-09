import { type ModelDefined, DataTypes, type Optional, type Sequelize } from 'sequelize'
import { statusConfig } from '../config/status'
import getDirectory from './directory'

interface FileAttributes {
  id: number
  name: string
  hash: string
  lastModified: Date
  lastChanged: Date
  parent: string
  status: string
  driveId: string
}

type FileCreationAttributes = Optional<FileAttributes, 'id' | 'driveId'>

type File = ModelDefined<FileAttributes, FileCreationAttributes>

function getFileModel (sequelize: Sequelize): File {
  const File: File = sequelize.define('File', {
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
    },
    driveId: {
      type: DataTypes.STRING
    }
  }, {
    timestamps: false
  })

  const Directory = getDirectory(sequelize)
  File.belongsTo(Directory, {
    foreignKey: 'parent'
  })

  return File
}

export type { File, FileAttributes, FileCreationAttributes }
export default getFileModel
