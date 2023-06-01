import sequelize from './databaseConnection'
import Directory from './models/Directory'

const init = async () => {
  await sequelize.sync()
  await Directory.create({
    path: 'src',
    lastModified: new Date()
  })
}

init()
  .then(() => {
    console.log('success')
  })
  .catch(() => {
  })
