import SyncdRepository from './SyncdRepository'
import hashAllFiles from './checksums'
import sequelize from './databaseConnection'
import authorize from './auth/authClient'
import { push } from './drive'

const repo = new SyncdRepository('.')

async function main (): Promise<void> {
  try {
    await sequelize.sync()
    await repo.loadDatabase()
    await repo.walkWorkdir('.')
    hashAllFiles(repo, push)
  } catch (err) {
    console.log(err)
  }
}

void main()
void authorize()
