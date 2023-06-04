import path from 'path'
import { type Model } from 'sequelize'
import File, { type FileAttributes, type FileCreationAttributes } from './models/file'
import Directory, { type DirectoryAttributes } from './models/directory'
import type { FileUpdationAttributes } from './models/fileUpdation'
import { lstat, opendir } from 'fs/promises'

class SyncdRepository {
  workdir: string
  syncddir: string
  files: Array<Model<FileAttributes, FileCreationAttributes>>
  directories: Array<Model<DirectoryAttributes, DirectoryAttributes>>
  fileAdditions: FileCreationAttributes[]
  fileAdditionsMap: Map<string, FileCreationAttributes>
  directoryAdditions: DirectoryAttributes[]
  fileDeletions: FileAttributes[]
  fileDeletionsMap: Map<string, FileAttributes>
  directoryDeletions: DirectoryAttributes[]
  fileUpdations: FileUpdationAttributes[]

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
            oldParent: oldFile.parent,
            newName: newFile.name,
            newParent: newFile.parent,
            lastModified: newFile.lastModified,
            lastChanged: newFile.lastChanged
          })
        }
        this.fileAdditionsMap.delete(key)
        this.fileDeletionsMap.delete(key)
      }
    }
  }

  async handleDirectory (directoryPath: string, directoryParent: string): Promise<void> {
    // fetch directory object
    // TODO: Optimize using Map
    const directory = this.directories.filter(directory => {
      return directory.dataValues.path === directoryPath
    })

    const stat = await lstat(directoryPath)
    if (directory.length === 0) {
      this.directoryAdditions.push({
        path: directoryPath,
        lastModified: stat.mtime,
        lastChanged: stat.ctime,
        parent: directoryParent
      })
    } else {
      const oldDirectory = directory[0]
      if (oldDirectory.dataValues.lastModified !== stat.mtime ||
               oldDirectory.dataValues.lastChanged !== stat.ctime) {
        this.directoryAdditions.push({
          path: directoryPath,
          lastModified: stat.mtime,
          lastChanged: stat.ctime,
          parent: directoryParent
        })
        this.directoryDeletions.push(oldDirectory.dataValues)
      }
    }
  }

  async handleFile (fileName: string, fileParent: string): Promise<void> {
    // fetch file object
    // TODO: Optimize using Map
    const filePath = path.join(fileParent, fileName)
    const file = this.files.filter(file => {
      const dbFilePath = path.join(file.dataValues.parent, file.dataValues.name)
      return dbFilePath === filePath
    })

    const stat = await lstat(filePath)
    if (file.length === 0) {
      this.fileAdditions.push({
        name: fileName,
        hash: '',
        lastModified: stat.mtime,
        lastChanged: stat.ctime,
        parent: fileParent
      })
    } else {
      const oldFile = file[0]
      if (oldFile.dataValues.lastModified !== stat.mtime ||
         oldFile.dataValues.lastChanged !== stat.ctime) {
        this.fileAdditions.push({
          name: fileName,
          hash: '',
          lastModified: stat.mtime,
          lastChanged: stat.ctime,
          parent: fileParent
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
          const directoryPath = path.join(dirpath, dirent.name)
          await this.handleDirectory(directoryPath, dirpath)
          await this.walkWorkdir(directoryPath)
        } else if (dirent.isFile()) {
          await this.handleFile(dirent.name, dirpath)
        }
      }
    } catch (err) {
      console.log(err)
    }
  }
}

export default SyncdRepository
