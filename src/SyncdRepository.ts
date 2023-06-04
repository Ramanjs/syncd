import path from 'path'
import File, { type FileAttributes, type FileCreationAttributes } from './models/file'
import { type Model } from 'sequelize'
import Directory, { type DirectoryAttributes, type DirectoryCreationAttributes } from './models/directory'
import { lstat, opendir } from 'fs/promises'

interface FileUpdate {
  oldName: string
  oldPath: string
  newName: string
  newPath: string
  lastModified: Date
  lastChanged: Date
}

class SyncdRepository {
  workdir: string
  syncddir: string
  files: Array<Model<FileAttributes, FileCreationAttributes>>
  directories: Array<Model<DirectoryAttributes, DirectoryCreationAttributes>>
  fileAdditions: FileCreationAttributes[]
  fileAdditionsMap: Map<string, FileCreationAttributes>
  directoryAdditions: DirectoryCreationAttributes[]
  fileDeletions: FileAttributes[]
  fileDeletionsMap: Map<string, FileAttributes>
  directoryDeletions: DirectoryAttributes[]
  fileUpdations: FileUpdate[]

  constructor (repopath: string) {
    this.workdir = repopath
    this.syncddir = path.join(repopath, '.syncd')
    this.files = []
    this.directories = []
    this.fileAdditions = []
    this.directoryAdditions = []
    this.fileDeletions = []
    this.directoryDeletions = []
    this.fileUpdations = []

    this.fileAdditionsMap = new Map()
    this.fileDeletionsMap = new Map()
  }

  async loadDatabase (): Promise<void> {
    this.files = await File.findAll()
    this.directories = await Directory.findAll()
    console.log(this.files)
    // console.log('All files: ', JSON.stringify(this.files, null, 2))
  }

  populateFileAdditionsMap (): void {
    for (const file of this.fileAdditions) {
      this.fileAdditionsMap.set(file.hash, file)
    }
  }

  populateFileDeletionsMap (): void {
    for (const file of this.fileDeletions) {
      this.fileDeletionsMap.set(file.hash, file)
    }
  }

  filterUpdatedFiles (): void {
    this.populateFileAdditionsMap()
    this.populateFileDeletionsMap()

    for (const key in this.fileAdditionsMap.keys()) {
      if (this.fileDeletionsMap.has(key)) {
        const oldFile = this.fileDeletionsMap.get(key)
        const newFile = this.fileAdditionsMap.get(key)
        if ((oldFile != null) && (newFile != null)) {
          this.fileUpdations.push({
            oldName: oldFile.name,
            oldPath: oldFile.path,
            newName: newFile.name,
            newPath: newFile.path,
            lastModified: newFile.lastModified,
            lastChanged: newFile.lastChanged
          })
        }
        this.fileAdditionsMap.delete(key)
        this.fileDeletionsMap.delete(key)
      }
    }
  }

  async handleDirectory (directoryName: string, directoryPath: string): Promise<void> {
    // fetch directory object
    // TODO: Optimize using Map
    const directory = this.directories.filter(directory => {
      return directory.dataValues.path === directoryPath
    })

    const stat = await lstat(directoryPath)
    if (directory.length === 0) {
      this.directoryAdditions.push({
        name: directoryName,
        path: directoryPath,
        lastModified: stat.mtime,
        lastChanged: stat.ctime
      })
    } else {
      const oldDirectory = directory[0]
      if (oldDirectory.dataValues.lastModified !== stat.mtime ||
               oldDirectory.dataValues.lastChanged !== stat.ctime) {
        this.directoryAdditions.push({
          name: directoryName,
          path: directoryPath,
          lastModified: stat.mtime,
          lastChanged: stat.ctime
        })
        this.directoryDeletions.push(oldDirectory.dataValues)
      }
    }
  }

  async handleFile (fileName: string, filePath: string): Promise<void> {
    // fetch file object
    // TODO: Optimize using Map
    const file = this.files.filter(file => {
      return file.dataValues.path === filePath
    })

    const stat = await lstat(filePath)
    if (file.length === 0) {
      this.fileAdditions.push({
        name: fileName,
        path: filePath,
        hash: '',
        lastModified: stat.mtime,
        lastChanged: stat.ctime
      })
    } else {
      const oldFile = file[0]
      if (oldFile.dataValues.lastModified !== stat.mtime ||
         oldFile.dataValues.lastChanged !== stat.ctime) {
        this.fileAdditions.push({
          name: fileName,
          path: filePath,
          hash: '',
          lastModified: stat.mtime,
          lastChanged: stat.ctime
        })
        this.fileDeletions.push(oldFile.dataValues)
      }
    }
  }

  async walkWorkdir (dirpath: string): Promise<void> {
    try {
      const dir = await opendir(dirpath)
      for await (const dirent of dir) {
        if (dirent.isDirectory()) {
          const directoryPath = path.join(dir.path, dirent.name)
          await this.handleDirectory(dirent.name, directoryPath)
          await this.walkWorkdir(directoryPath)
        } else if (dirent.isFile()) {
          const filePath = path.join(dir.path, dirent.name)
          await this.handleFile(dirent.name, filePath)
        }
      }
    } catch (err) {
      console.log(err)
    }
  }
}

export default SyncdRepository