import os from 'os'
import WorkerPool from './workerThreads/workerPool'
import path from 'path'
import { readFile } from 'fs/promises'
import { type FileCreationAttributes } from './models/file'

const pool = new WorkerPool(os.cpus().length, path.join(__dirname, 'workerThreads/worker.js'))

async function hashFile (file: FileCreationAttributes): Promise<void> {
  const fileContent = await readFile(path.join(file.parent, file.name))
  pool.runTask(fileContent, (err: Error | null, result: Uint8Array | null) => {
    if (err != null) console.log(err)
    if (result != null) file.hash = Buffer.from(result).toString('hex')
    console.log(file)
  })
}

function hashAllFiles (files: FileCreationAttributes[]): void {
  pool.setNumFiles(files.length)
  for (const file of files) {
    void hashFile(file)
  }
}

type hashCallback = (err: Error | null, result: Uint8Array | null) => void

export type { hashCallback }
export default hashAllFiles
