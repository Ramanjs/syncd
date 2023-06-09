import { DataTypes, type Sequelize, type ModelDefined, type Optional } from 'sequelize'
import { statusConfig } from '../config/status'

interface DirectoryAttributes {
  path: string
  lastModified: Date
  lastChanged: Date
  parent: string
  status: string
  driveId: string
}

type DirectoryCreationAttributes = Optional<DirectoryAttributes, 'driveId'>

type Directory = ModelDefined<DirectoryAttributes, DirectoryCreationAttributes>

function getDirectoryModel (sequelize: Sequelize): Directory {
  const Directory: Directory = sequelize.define('Directory', {
    path: {
      type: DataTypes.STRING,
      validate: {
        len: [1, 4096]
      },
      primaryKey: true
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

  Directory.belongsTo(Directory, {
    as: 'Parent',
    foreignKey: 'parent'
  })

  return Directory
}

export type { Directory, DirectoryAttributes, DirectoryCreationAttributes }
export default getDirectoryModel
