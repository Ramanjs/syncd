import { DataTypes, type ModelDefined, type Optional } from 'sequelize'
import sequelize from '../databaseConnection'
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

const Directory: ModelDefined<
DirectoryAttributes, DirectoryCreationAttributes
> = sequelize.define('Directory', {
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

export type { DirectoryAttributes, DirectoryCreationAttributes }
export default Directory
