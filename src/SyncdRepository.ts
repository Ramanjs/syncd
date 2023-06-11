import path from 'path'
import { Op, type Sequelize, type Model } from 'sequelize'
import getFileModel, { type FileAttributes, type FileCreationAttributes } from './models/file'
import getDirectoryModel, { type DirectoryAttributes, type DirectoryCreationAttributes } from './models/directory'
import getFileUpdationModel, { type FileUpdationCreationAttributes } from './models/fileUpdation'
import { statusConfig } from './config/status'
import { stat, opendir, copyFile } from 'fs/promises'
import getSequelizeConnection from './databaseConnection'
import { existsSync, mkdirSync, statSync } from 'fs'

class SyncdRepository {
  worktree: string
  syncddir: string
  files: Array<Model<FileAttributes, FileCreationAttributes>>
  directories: Array<Model<DirectoryAttributes, DirectoryCreationAttributes>>
  fileAdditions: FileCreationAttributes[]
  fileDeletions: FileAttributes[]
  directoryAdditions: DirectoryCreationAttributes[]
  directoryDeletions: DirectoryAttributes[]
  fileUpdations: FileUpdationCreationAttributes[]

  constructor (repopath: string, force = false) {
    this.worktree = path.resolve(repopath)
    this.syncddir = path.join(this.worktree, '.syncd')

    if (!(force || existsSync(this.syncddir))) {
      throw Error('Not a syncd repository')
    }

    this.files = []
    this.directories = []
    this.fileAdditions = []
    this.directoryAdditions = []
    this.fileDeletions = []
    this.directoryDeletions = []
    this.fileUpdations = []
  }

  async syncDB (sequelize: Sequelize): Promise<void> {
    const DirectoryModel = getDirectoryModel(sequelize)
    const FileModel = getFileModel(sequelize)
    const FileUpdationModel = getFileUpdationModel(sequelize)

    await sequelize.sync()
  }

  async createRepo (pathToCredentials: string): Promise<Sequelize> {
    if (!(existsSync(this.worktree) && statSync(this.worktree).isDirectory())) {
      throw Error(`${this.worktree} is not a directory`)
    }
    if (existsSync(this.syncddir)) {
      throw Error(`${this.worktree} is already an existing syncd repository`)
    }

    mkdirSync(this.syncddir)
    const sequelize = getSequelizeConnection(path.join(this.syncddir, 'db.sqlite'))
    await this.syncDB(sequelize)
    await sequelize.sync()

    const stats = await stat(this.worktree)

    const DirectoryModel = getDirectoryModel(sequelize)
    await DirectoryModel.create({
      path: this.worktree,
      lastModified: stats.mtime,
      lastChanged: stats.ctime,
      status: statusConfig.DONE,
      parent: this.worktree
    })

    await copyFile(pathToCredentials, path.join(this.syncddir, 'credentials.json'))

    return sequelize
  }

  async loadDatabase (): Promise<void> {
    const sequelize = getSequelizeConnection(path.join(this.syncddir, 'db.sqlite'))
    const FileModel = getFileModel(sequelize)
    const DirectoryModel = getDirectoryModel(sequelize)
    await sequelize.sync()

    this.files = await FileModel.findAll()
    this.directories = await DirectoryModel.findAll()

    // remove root directory
    const index = this.directories.findIndex((directory) => directory.dataValues.path === directory.dataValues.parent)
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
    const dir = await opendir(dirpath)
    for await (const dirent of dir) {
      if (dirent.isDirectory()) {
        const directoryPath = path.join(dirpath, dirent.name)
        if (directoryPath === this.syncddir) {
          continue
        }
        await this.handleDirectory(directoryPath, dirpath)
        await this.walkWorkdir(directoryPath)
      } else if (dirent.isFile()) {
        await this.handleFile(dirent.name, dirpath)
      }
    }
  }

  async saveToDB (): Promise<boolean> {
    const sequelize = getSequelizeConnection(path.join(this.syncddir, 'db.sqlite'))
    const FileModel = getFileModel(sequelize)
    const DirectoryModel = getDirectoryModel(sequelize)
    const FileUpdationModel = getFileUpdationModel(sequelize)

    await sequelize.sync()

    this.filterUpdatedFiles()
    await DirectoryModel.bulkCreate(this.directoryAdditions, {
      validate: true
    })
    for (const directory of this.directoryDeletions) {
      await DirectoryModel.update({
        status: statusConfig.PENDING_DELETION
      }, {
        where: {
          path: directory.path
        }
      })
    }
    await FileModel.bulkCreate(this.fileAdditions, {
      validate: true
    })
    for (const file of this.fileDeletions) {
      await FileModel.update({
        status: statusConfig.PENDING_DELETION
      }, {
        where: {
          id: file.id
        }
      })
    }
    await FileUpdationModel.bulkCreate(this.fileUpdations, {
      validate: true
    })
    for (const fileUpdate of this.fileUpdations) {
      await FileModel.update({
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

    if (this.fileAdditions.length === 0 && this.fileDeletions.length === 0 &&
       this.directoryAdditions.length === 0 && this.directoryDeletions.length === 0 &&
     this.fileUpdations.length === 0) {
      return false
    }

    return true
  }
}

export default SyncdRepository
