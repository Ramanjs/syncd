import { DataTypes, type ModelDefined } from 'sequelize'
import sequelize from '../databaseConnection'

interface DirectoryAttributes {
  path: string
  lastModified: Date
}

const Directory: ModelDefined<
DirectoryAttributes, DirectoryAttributes
> = sequelize.define('Directory', {
  path: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  lastModified: {
    type: DataTypes.DATE,
    allowNull: false
  }
})

Directory.belongsTo(Directory)

export type { DirectoryAttributes }
export default Directory
