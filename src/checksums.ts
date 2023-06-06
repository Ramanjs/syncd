import os from 'os'
import WorkerPool from './workerThreads/workerPool'
import path from 'path'
import { readFile } from 'fs/promises'
import { type FileCreationAttributes } from './models/file'
import type SyncdRepository from './SyncdRepository'

const pool = new WorkerPool(os.cpus().length, path.join(__dirname, 'workerThreads/worker.js'))

async function hashFile (file: FileCreationAttributes): Promise<void> {
  const fileContent = await readFile(path.join(file.parent, file.name))
  pool.runTask(fileContent, (err: Error | null, result: Uint8Array | null) => {
    if (err != null) console.log(err)
    if (result != null) file.hash = Buffer.from(result).toString('hex')
  })
}

function hashAllFiles (repo: SyncdRepository, onCloseCallback: any): void {
  pool.setNumFiles(repo.fileAdditions.length)
  pool.setRepo(repo)
  pool.setOnCloseCallback(onCloseCallback)
  for (const file of repo.fileAdditions) {
    void hashFile(file)
  }
}

type hashCallback = (err: Error | null, result: Uint8Array | null) => void

export type { hashCallback }
export default hashAllFiles
