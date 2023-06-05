import path from 'path'
import { type Model } from 'sequelize'
import File, { type FileAttributes, type FileCreationAttributes } from './models/file'
import Directory, { type DirectoryAttributes } from './models/directory'
import type { FileUpdationAttributes } from './models/fileUpdation'
import { statusConfig } from './config/status'
import { lstat, opendir } from 'fs/promises'
import sequelize from './databaseConnection'
import FileUpdation from './models/fileUpdation'

class SyncdRepository {
  workdir: string
  syncddir: string
  files: Array<Model<FileAttributes, FileCreationAttributes>>
  directories: Array<Model<DirectoryAttributes, DirectoryAttributes>>
  fileAdditions: FileCreationAttributes[]
  fileDeletions: FileAttributes[]
  directoryAdditions: DirectoryAttributes[]
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
  }

  async loadDatabase (): Promise<void> {
    this.files = await File.findAll()
    this.directories = await Directory.findAll()
    console.log(this.files)
    console.log(this.directories)
    // console.log('All files: ', JSON.stringify(this.files, null, 2))
  }

  filterUpdatedFiles (): void {
    for (const file of this.fileAdditions) {
      const oldFile = this.fileDeletions.find((value) => value.hash === file.hash)
      const newFile = file
      if (oldFile != null) {
        this.fileUpdations.push({
          oldName: oldFile.name,
          oldParent: oldFile.parent,
          newName: newFile.name,
          newParent: newFile.parent,
          lastModified: newFile.lastModified,
          lastChanged: newFile.lastChanged
        })
        const newIndex = this.fileAdditions.indexOf(newFile)
        this.fileAdditions.splice(newIndex, 1)
        const oldIndex = this.fileDeletions.indexOf(oldFile)
        this.fileDeletions.splice(oldIndex, 1)
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
        parent: directoryParent,
        status: statusConfig.PENDING_ADDITION
      })
    } else {
      const oldDirectory = directory[0]
      if (oldDirectory.dataValues.lastModified.getTime() !== stat.mtime.getTime() ||
               oldDirectory.dataValues.lastChanged.getTime() !== stat.ctime.getTime()) {
        this.directoryAdditions.push({
          path: directoryPath,
          lastModified: stat.mtime,
          lastChanged: stat.ctime,
          parent: directoryParent,
          status: statusConfig.PENDING_ADDITION
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
        parent: fileParent,
        status: statusConfig.PENDING_ADDITION
      })
    } else {
      const oldFile = file[0]
      if (oldFile.dataValues.lastModified.getTime() !== stat.mtime.getTime() ||
         oldFile.dataValues.lastChanged.getTime() !== stat.ctime.getTime()) {
        this.fileAdditions.push({
          name: fileName,
          hash: '',
          lastModified: stat.mtime,
          lastChanged: stat.ctime,
          parent: fileParent,
          status: statusConfig.PENDING_ADDITION
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

  async setupDB (): Promise<void> {
    const directories = await Directory.findAll()
    if (directories.length === 0) {
      const stat = await lstat('.')
      await Directory.create({
        path: '.',
        lastModified: stat.mtime,
        lastChanged: stat.ctime,
        parent: '.',
        status: statusConfig.DONE
      })
    }
  }

  async saveToDB (): Promise<void> {
    this.filterUpdatedFiles()
    await sequelize.sync()
    await this.setupDB()
    await Directory.bulkCreate(this.directoryAdditions, {
      validate: true
    })
    for (const directory of this.directoryDeletions) {
      await Directory.update({
        status: statusConfig.PENDING_DELETION
      }, {
        where: {
          path: directory.path
        }
      })
    }
    await File.bulkCreate(this.fileAdditions, {
      validate: true
    })
    for (const file of this.fileDeletions) {
      await File.update({
        status: statusConfig.PENDING_DELETION
      }, {
        where: {
          id: file.id
        }
      })
    }
    await FileUpdation.bulkCreate(this.fileUpdations, {
      validate: true
    })
  }
}

export default SyncdRepository
