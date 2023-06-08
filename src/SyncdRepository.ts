import path from 'path'
import { type Model } from 'sequelize'
import { Op } from 'sequelize'
import File, { type FileAttributes, type FileCreationAttributes } from './models/file'
import Directory, { type DirectoryAttributes, type DirectoryCreationAttributes } from './models/directory'
import type { FileUpdationCreationAttributes } from './models/fileUpdation'
import { statusConfig } from './config/status'
import { stat, opendir } from 'fs/promises'
import sequelize from './databaseConnection'
import FileUpdation from './models/fileUpdation'

class SyncdRepository {
  workdir: string
  syncddir: string
  files: Array<Model<FileAttributes, FileCreationAttributes>>
  directories: Array<Model<DirectoryAttributes, DirectoryCreationAttributes>>
  fileAdditions: FileCreationAttributes[]
  fileDeletions: FileAttributes[]
  directoryAdditions: DirectoryCreationAttributes[]
  directoryDeletions: DirectoryAttributes[]
  fileUpdations: FileUpdationCreationAttributes[]

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

    // remove root directory
    const index = this.directories.findIndex((directory) => directory.dataValues.path === '.')
    this.directories.splice(index, 1)

    for (const directory of this.directories) {
      this.directoryDeletions.push({
        ...directory.dataValues
      })
    }

    for (const file of this.files) {
      this.fileDeletions.push({
        ...file.dataValues
      })
    }

    console.log(this.files)
    console.log(this.directories)
  }

  filterUpdatedFiles (): void {
    for (const file of this.fileAdditions) {
      const oldFile = this.fileDeletions.find((value) => value.hash === file.hash)
      const newFile = file
      if (oldFile != null) {
        this.fileUpdations.push({
          id: oldFile.id,
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
    const directory = this.directoryDeletions.filter(directory => {
      return directory.path === directoryPath
    })

    const stats = await stat(directoryPath)
    if (directory.length === 0) {
      this.directoryAdditions.push({
        path: directoryPath,
        lastModified: stats.mtime,
        lastChanged: stats.ctime,
        parent: directoryParent,
        status: statusConfig.PENDING_ADDITION
      })
    } else {
      const index = this.directoryDeletions.indexOf(directory[0])
      this.directoryDeletions.splice(index, 1)
    }
  }

  async handleFile (fileName: string, fileParent: string): Promise<void> {
    // fetch file object
    // TODO: Optimize using Map
    const filePath = path.join(fileParent, fileName)
    const file = this.fileDeletions.filter(file => {
      const dbFilePath = path.join(file.parent, file.name)
      return dbFilePath === filePath
    })

    const stats = await stat(filePath)
    if (file.length === 0) {
      this.fileAdditions.push({
        name: fileName,
        hash: '',
        lastModified: stats.mtime,
        lastChanged: stats.ctime,
        parent: fileParent,
        status: statusConfig.PENDING_ADDITION
      })
    } else {
      const oldFile = file[0]
      if (oldFile.lastModified.getTime() !== stats.mtime.getTime() ||
         oldFile.lastChanged.getTime() !== stats.ctime.getTime()) {
        this.fileAdditions.push({
          name: fileName,
          hash: '',
          lastModified: stats.mtime,
          lastChanged: stats.ctime,
          parent: fileParent,
          status: statusConfig.PENDING_ADDITION
        })
      } else {
        const index = this.fileDeletions.indexOf(oldFile)
        this.fileDeletions.splice(index, 1)
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
      const stats = await stat('.')
      await Directory.create({
        path: '.',
        lastModified: stats.mtime,
        lastChanged: stats.ctime,
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
    for (const fileUpdate of this.fileUpdations) {
      await File.update({
        status: statusConfig.PENDING_UPDATE
      }, {
        where: {
          [Op.and]: [
            { name: fileUpdate.oldName },
            { parent: fileUpdate.oldParent }
          ]
        }
      })
    }
  }
}

export default SyncdRepository
