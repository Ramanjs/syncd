import { DataTypes } from 'sequelize'
import sequelize from '../databaseConnection'

interface DirectoryAttributes {
  path: string
  lastModified: Date
  lastChanged: Date
  parent: string
}

const Directory = sequelize.define('Directory', {
  path: {
    type: DataTypes.STRING,
    validate: {
      min: 1,
      max: 4096
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
      min: 1,
      max: 4096
    }
  }
})

Directory.belongsTo(Directory, {
  foreignKey: 'parent'
})

export type { DirectoryAttributes }
export default Directory
