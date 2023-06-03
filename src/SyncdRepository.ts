import path from 'path'
import File, { type FileAttributes } from './models/file'
import { type Model } from 'sequelize'
import Directory, { type DirectoryAttributes } from './models/directory'

class SyncdRepository {
  workdir: string
  syncddir: string
  files: Array<Model<FileAttributes, FileAttributes> | Model<DirectoryAttributes, DirectoryAttributes>>

  constructor (repopath: string) {
    this.workdir = repopath
    this.syncddir = path.join(repopath, '.syncd')
    this.files = []
  }

  async fetchDatabase (): Promise<void> {
    this.files = await File.findAll()
    this.files.push(...(await Directory.findAll()))
    console.log('All files: ', JSON.stringify(this.files, null, 2))
  }
}

const repo = new SyncdRepository('.')
repo.fetchDatabase()
  .then(() => {
    console.log('success')
  })
  .catch((err) => {
    console.log('error', err)
  })

export default SyncdRepository
