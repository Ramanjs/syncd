import { createHash } from 'crypto'
import { parentPort } from 'worker_threads'

parentPort?.on('message', (task: Buffer) => {
  const hash = createHash('sha256').update(task).digest()
  parentPort?.postMessage(hash)
})
