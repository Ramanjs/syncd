import { AsyncResource } from 'async_hooks'
import { EventEmitter } from 'events'
import { Worker } from 'worker_threads'

const kWorkerFreedEvent = Symbol('kWorkerFreedEvent')

interface AsyncResourceWorker {
  kTaskInfo?: WorkerPoolTaskInfo | null
}

class WorkerPoolTaskInfo extends AsyncResource {
  callback: any

  constructor (callback: any) {
    super('WorkerPoolTaskInfo')
    this.callback = callback
  }

  done (err: Error | null, result: any): void {
    this.runInAsyncScope(this.callback, null, err, result)
    this.emitDestroy() // `TaskInfo`s are used only once.
  }
}

export default class WorkerPool extends EventEmitter {
  numThreads: number
  workerFile: string
  workers: Array<Worker & AsyncResourceWorker>
  freeWorkers: Array<Worker & AsyncResourceWorker>
  tasks: any[]

  constructor (numThreads: number, workerFile: string) {
    super()
    this.numThreads = numThreads
    this.workerFile = workerFile
    this.workers = []
    this.freeWorkers = []
    this.tasks = []

    for (let i = 0; i < numThreads; i++) { this.addNewWorker() }

    // Any time the kWorkerFreedEvent is emitted, dispatch
    // the next task pending in the queue, if any.
    this.on(kWorkerFreedEvent, () => {
      if (this.tasks.length > 0) {
        const { task, callback } = this.tasks.shift()
        this.runTask(task, callback)
      }
    })
  }

  addNewWorker (): void {
    const worker: Worker & AsyncResourceWorker = new Worker(this.workerFile)
    worker.on('message', (result) => {
      // In case of success: Call the callback that was passed to `runTask`,
      // remove the `TaskInfo` associated with the Worker, and mark it as free
      // again.
      worker.kTaskInfo?.done(null, result)
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

  runTask (task: any, callback: any): void {
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
}
