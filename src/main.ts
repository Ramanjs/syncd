import SyncdRepository from './SyncdRepository'
import hashAllFiles from './checksums'

const repo = new SyncdRepository('.')

async function main (): Promise<void> {
  try {
    await repo.loadDatabase()
    await repo.walkWorkdir('.')
    console.log(repo.fileAdditions)
    hashAllFiles(repo.fileAdditions)
  } catch (err) {
    console.log(err)
  }
}

void main()
