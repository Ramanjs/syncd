import { DataTypes, type Optional, type ModelDefined } from 'sequelize'
import sequelize from '../databaseConnection'

interface DirectoryAttributes {
  id: number
  name: string
  path: string
  lastModified: Date
  lastChanged: Date
}

type DirectoryCreationAttributes = Optional<DirectoryAttributes, 'id'>

const Directory: ModelDefined<
DirectoryAttributes, DirectoryCreationAttributes
> = sequelize.define('Directory', {
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
  lastModified: {
    type: DataTypes.DATE,
    allowNull: false
  },
  lastChanged: {
    type: DataTypes.DATE,
    allowNull: false
  }
})

Directory.belongsTo(Directory)

export type { DirectoryAttributes, DirectoryCreationAttributes }
export default Directory
