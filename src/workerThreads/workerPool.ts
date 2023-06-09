import { AsyncResource } from 'async_hooks'
import { EventEmitter } from 'events'
import { Worker } from 'worker_threads'
import type { hashCallback } from '../checksums'
import type SyncdRepository from '../SyncdRepository'

const kWorkerFreedEvent = Symbol('kWorkerFreedEvent')

interface AsyncResourceWorker {
  kTaskInfo?: WorkerPoolTaskInfo | null
}

class WorkerPoolTaskInfo extends AsyncResource {
  callback: hashCallback

  constructor (callback: hashCallback) {
    super('WorkerPoolTaskInfo')
    this.callback = callback
  }

  done (err: Error | null, result: Uint8Array | null): void {
    this.runInAsyncScope(this.callback, null, err, result)
    this.emitDestroy() // `TaskInfo`s are used only once.
  }
}

export default class WorkerPool extends EventEmitter {
  numThreads: number
  numFiles: number
  filesProcessed: number
  workerFile: string
  workers: Array<Worker & AsyncResourceWorker>
  freeWorkers: Array<Worker & AsyncResourceWorker>
  tasks: Array<{ task: Buffer, callback: hashCallback }>
  observer: any

  constructor (numThreads: number, workerFile: string) {
    super()
    this.numThreads = numThreads
    this.numFiles = 0
    this.filesProcessed = 0
    this.workerFile = workerFile
    this.workers = []
    this.freeWorkers = []
    this.tasks = []
    this.observer = null

    for (let i = 0; i < numThreads; i++) { this.addNewWorker() }

    // Any time the kWorkerFreedEvent is emitted, dispatch
    // the next task pending in the queue, if any.
    this.on(kWorkerFreedEvent, () => {
      if (this.tasks.length > 0) {
        const nextTask = this.tasks.shift()
        if (nextTask != null) {
          const { task, callback } = nextTask
          this.runTask(task, callback)
        }
      }

      if (this.numFiles === this.filesProcessed) {
        console.log('stopping worker pool')
        void this.cleanUp()
      }
    })
  }

  setNumFiles (numFiles: number): void {
    this.numFiles = numFiles
  }

  setObserver (observer: any): void {
    this.observer = observer
  }

  addNewWorker (): void {
    const worker: Worker & AsyncResourceWorker = new Worker(this.workerFile)
    worker.on('message', (result) => {
      // In case of success: Call the callback that was passed to `runTask`,
      // remove the `TaskInfo` associated with the Worker, and mark it as free
      // again.
      worker.kTaskInfo?.done(null, result)
      this.filesProcessed += 1
      worker.kTaskInfo = null
      this.freeWorkers.push(worker)
      this.emit(kWorkerFreedEvent)
    })
    worker.on('error', (err) => {
      // In case of an uncaught exception: Call the callback that was passed to
      // `runTask` with the error.
      if (worker.kTaskInfo != null) { worker.kTaskInfo.done(err, null) } else { this.emit('error', err) }
      // Remove the worker from the list and start a new Worker to replace the
      // current one.
      this.workers.splice(this.workers.indexOf(worker), 1)
      this.addNewWorker()
    })
    this.workers.push(worker)
    this.freeWorkers.push(worker)
    this.emit(kWorkerFreedEvent)
  }

  runTask (task: Buffer, callback: hashCallback): void {
    if (this.freeWorkers.length === 0) {
      // No free threads, wait until a worker thread becomes free.
      this.tasks.push({ task, callback })
    }

    const worker = this.freeWorkers.pop()
    if (worker != null) {
      worker.kTaskInfo = new WorkerPoolTaskInfo(callback)
      worker.postMessage(task)
    }
  }

  close (): void {
    for (const worker of this.workers) void worker.terminate()
  }

  async cleanUp (): Promise<void> {
    this.close()
    this.observer.complete()
  }
}
