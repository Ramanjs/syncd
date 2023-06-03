import { DataTypes, type ModelDefined } from 'sequelize'
import sequelize from '../databaseConnection'

interface DirectoryAttributes {
  name: string
  path: string
  lastModified: Date
  lastChanged: Date
}

const Directory: ModelDefined<
DirectoryAttributes, DirectoryAttributes
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
    unique: true,
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

Directory.belongsTo(Directory)

export type { DirectoryAttributes }
export default Directory
