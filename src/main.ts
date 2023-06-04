import SyncdRepository from './SyncdRepository'
import hashAllFiles from './checksums'
import sequelize from './databaseConnection'

const repo = new SyncdRepository('.')

async function main (): Promise<void> {
  try {
    await sequelize.sync()
    await repo.loadDatabase()
    await repo.walkWorkdir('.')
    hashAllFiles(repo)
  } catch (err) {
    console.log(err)
  }
}

void main()
