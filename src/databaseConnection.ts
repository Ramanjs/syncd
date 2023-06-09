import { Sequelize } from 'sequelize'

function getSequelizeConnection (dbPath: string): Sequelize {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
  })

  return sequelize
}

export default getSequelizeConnection
