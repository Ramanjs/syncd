import os from 'os'
import WorkerPool from './workerThreads/workerPool'
import path from 'path'
import { readFile } from 'fs/promises'
import { type FileCreationAttributes } from './models/file'
import type SyncdRepository from './SyncdRepository'
import { getRelativePath } from './utils'

const pool = new WorkerPool(os.cpus().length, path.join(__dirname, 'workerThreads/worker.js'))

async function hashFile (file: FileCreationAttributes, rootPath: string, observer: any): Promise<void> {
  const filePath = path.join(file.parent, file.name)
  const relativePath = getRelativePath(rootPath, filePath)
  const fileContent = await readFile(filePath)
  observer.next(relativePath)
  pool.runTask(fileContent, (err: Error | null, result: Uint8Array | null) => {
    if (err != null) console.log(err)
    if (result != null) file.hash = Buffer.from(result).toString('hex')
  })
}

function hashAllFiles (repo: SyncdRepository, observer: any): void {
  pool.setNumFiles(repo.fileAdditions.length)
  pool.setObserver(observer)
  for (const file of repo.fileAdditions) {
    void hashFile(file, repo.worktree, observer)
  }
}

type hashCallback = (err: Error | null, result: Uint8Array | null) => void

export type { hashCallback }
export default hashAllFiles
