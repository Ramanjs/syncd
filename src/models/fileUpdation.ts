import { DataTypes, type Sequelize, type ModelDefined, type Optional } from 'sequelize'
import getFileModel from './file'

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

type FileUpdation = ModelDefined<FileUpdationAttributes, FileUpdationCreationAttributes>

function getFileUpdationModel (sequelize: Sequelize): FileUpdation {
  const FileUpdation: FileUpdation = sequelize.define('FileUpdation', {
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

  const File = getFileModel(sequelize)
  FileUpdation.hasOne(File)

  return FileUpdation
}

export type { FileUpdationAttributes, FileUpdationCreationAttributes }
export default getFileUpdationModel
