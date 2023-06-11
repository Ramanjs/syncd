import { type drive_v3 } from 'googleapis'
import path from 'path'
import getDirectoryModel, { type Directory, type DirectoryAttributes, type DirectoryCreationAttributes } from './models/directory'
import mime from 'mime-types'
import { createReadStream } from 'fs'
import { Op, type Model, type Sequelize } from 'sequelize'
import { statusConfig } from './config/status'
import { type File, type FileAttributes, type FileCreationAttributes } from './models/file'
import { type FileUpdation, type FileUpdationAttributes, type FileUpdationCreationAttributes } from './models/fileUpdation'
import { getRelativePath } from './utils'
import { stat } from 'fs/promises'
import resumableUpload from './resumable'

async function getNewDirectory (Directory: Directory): Promise<Model<DirectoryAttributes, DirectoryCreationAttributes
> | null> {
  const newDirectory = await Directory.findOne({
    where: {
      status: statusConfig.PENDING_ADDITION
    },
    include: {
      model: Directory,
      as: 'Parent',
      required: true,
      where: {
        driveId: {
          [Op.ne]: null
        }
      }
    }
  })
  return newDirectory
}

async function getDeletedDirectory (Directory: Directory): Promise<Model<DirectoryAttributes, DirectoryCreationAttributes> | null> {
  const oldDirectory = await Directory.findOne({
    where: {
      status: statusConfig.PENDING_DELETION
    }
  })

  return oldDirectory
}

async function saveDirectoryDriveId (Directory: Directory, directoryPath: string, fileId: string): Promise<void> {
  await Directory.update({
    driveId: fileId,
    status: statusConfig.DONE
  }, {
    where: {
      path: directoryPath
    }
  })
}

async function saveDirectoryDeletion (Directory: Directory, directoryPath: string): Promise<void> {
  await Directory.destroy({
    where: {
      path: directoryPath
    }
  })
}

async function getNewFile (File: File, Directory: Directory): Promise<Model<FileAttributes, FileCreationAttributes
> | null> {
  const newFile = await File.findOne({
    where: {
      status: statusConfig.PENDING_ADDITION
    },
    include: {
      model: Directory
    }
  })
  return newFile
}

async function getDeletedFile (File: File): Promise<Model<FileAttributes, FileCreationAttributes> | null> {
  const oldFile = await File.findOne({
    where: {
      status: statusConfig.PENDING_DELETION
    }
  })

  return oldFile
}

async function saveFileDriveId (File: File, fileId: number, fileDriveId: string): Promise<void> {
  await File.update({
    driveId: fileDriveId,
    status: statusConfig.DONE
  }, {
    where: {
      id: fileId
    }
  })
}

async function saveFileDeletion (File: File, fileId: number): Promise<void> {
  await File.destroy({
    where: {
      id: fileId
    }
  })
}

async function getNewFileUpdation (FileUpdation: FileUpdation): Promise<Model<FileUpdationAttributes, FileUpdationCreationAttributes> | null> {
  const newFileUpdate = await FileUpdation.findOne()
  return newFileUpdate
}

async function saveFileUpdation (FileUpdation: FileUpdation, File: File, fileId: number, newName: string, newParent: string, lastModified: Date, lastChanged: Date): Promise<void> {
  await FileUpdation.destroy({
    where: {
      id: fileId
    }
  })
  await File.update({
    name: newName,
    parent: newParent,
    status: statusConfig.DONE,
    lastModified,
    lastChanged
  }, {
    where: {
      id: fileId
    }
  })
}

async function getDirectoryDriveId (Directory: Directory, directoryPath: string): Promise<string> {
  const directory = await Directory.findOne({
    where: {
      path: directoryPath
    }
  })

  return String(directory?.dataValues.driveId)
}

async function getFileDriveId (File: File, fileId: number): Promise<string> {
  const file = await File.findByPk(fileId)
  return String(file?.dataValues.driveId)
}

async function createFolder (name: string, parentDriveId: string | null, drive: drive_v3.Drive): Promise<string | null | undefined> {
  let folder
  if (parentDriveId != null) {
    folder = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentDriveId]
      }
    })
  } else {
    folder = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder'
      }
    })
  }
  return folder.data.id
}

async function createFile (name: string, parent: string, parentDriveId: string, drive: drive_v3.Drive): Promise<string | null | undefined> {
  const filePath = path.join(parent, name)
  const requestBody = {
    name,
    parents: [parentDriveId],
    fields: 'id'
  }
  const content = createReadStream(filePath)
  const mimeType = mime.lookup(filePath) !== false ? String(mime.lookup(filePath)) : '[*/*]'
  const driveFile = await drive.files.create({
    requestBody,
    media: {
      mimeType,
      body: content
    }
  })
  return driveFile.data.id
}

// async function resumableUpload (fileId: string, data: Buffer) {

// }

async function updateFile (fileId: string, newName: string, newParentDriveId: string, oldParentDriveId: string, drive: drive_v3.Drive): Promise<void> {
  await drive.files.update({
    // @ts-expect-error ts gone wild
    fileId,
    addParents: [newParentDriveId],
    removeParents: [oldParentDriveId],
    requestBody: {
      name: newName
    }
  })
}

async function deleteFile (fileId: string, drive: drive_v3.Drive): Promise<void> {
  await drive.files.delete({
    fileId
  })
}

async function pushDirectoryAdditions (Directory: Directory, drive: drive_v3.Drive, observer: any): Promise<void> {
  let newDirectory = await getNewDirectory(Directory)
  while (newDirectory != null) {
    const directoryName = path.basename(newDirectory.dataValues.path)
    observer.next(directoryName)
    // @ts-expect-error idk how to implement eager loading in ts
    const parentDriveId = newDirectory.dataValues.Parent.dataValues.driveId
    const directoryId = await createFolder(directoryName, parentDriveId, drive)
    await saveDirectoryDriveId(Directory, newDirectory.dataValues.path, String(directoryId))
    newDirectory = await getNewDirectory(Directory)
  }
  observer.complete()
}

async function pushDirectoryDeletions (Directory: Directory, drive: drive_v3.Drive, rootPath: string, observer: any): Promise<void> {
  let oldDirectory = await getDeletedDirectory(Directory)
  while (oldDirectory != null) {
    observer.next(getRelativePath(rootPath, oldDirectory.dataValues.path))
    await deleteFile(oldDirectory.dataValues.driveId, drive)
    await saveDirectoryDeletion(Directory, oldDirectory.dataValues.path)
    oldDirectory = await getDeletedDirectory(Directory)
  }
  observer.complete()
}

async function pushFileAdditions (File: File, Directory: Directory, accessToken: string, drive: drive_v3.Drive, rootPath: string, observer: any): Promise<void> {
  let newFile = await getNewFile(File, Directory)
  while (newFile != null) {
    const filePath = path.join(newFile.dataValues.parent, newFile.dataValues.name)
    const fileSize = (await stat(filePath)).size
    // @ts-expect-error idk how to implement eager loading in ts
    const parentDriveId = newFile.dataValues.Directory.dataValues.driveId

    let fileId
    if (fileSize < 5 * 1024 * 1024) {
      observer.next(getRelativePath(rootPath, filePath))
      fileId = await createFile(newFile.dataValues.name, newFile.dataValues.parent, parentDriveId, drive)
    } else {
      fileId = await resumableUpload(rootPath, filePath, newFile.dataValues.name, parentDriveId, accessToken, drive, observer)
    }
    await saveFileDriveId(File, newFile.dataValues.id, String(fileId))
    newFile = await getNewFile(File, Directory)
  }
  observer.complete()
}

async function pushFileUpdations (FileUpdation: FileUpdation, Directory: Directory, File: File, drive: drive_v3.Drive, rootPath: string, observer: any): Promise<void> {
  let newFileUpdate = await getNewFileUpdation(FileUpdation)
  while (newFileUpdate != null) {
    const oldParent = newFileUpdate.dataValues.oldParent
    const newParent = newFileUpdate.dataValues.newParent
    const oldPath = getRelativePath(rootPath, path.join(oldParent, newFileUpdate.dataValues.oldName))
    const newPath = getRelativePath(rootPath, path.join(newParent, newFileUpdate.dataValues.newName))
    observer.next(`Update ${oldPath} -> ${newPath}`)
    const oldParentDriveId = await getDirectoryDriveId(Directory, oldParent)
    const newParentDriveId = await getDirectoryDriveId(Directory, newParent)
    const fileDriveId = await getFileDriveId(File, newFileUpdate.dataValues.id)
    await updateFile(fileDriveId, newFileUpdate.dataValues.newName, newParentDriveId, oldParentDriveId, drive)
    await saveFileUpdation(FileUpdation, File, newFileUpdate.dataValues.id, newFileUpdate.dataValues.newName, newFileUpdate.dataValues.newParent, newFileUpdate.dataValues.lastModified, newFileUpdate.dataValues.lastChanged)
    newFileUpdate = await getNewFileUpdation(FileUpdation)
  }
  observer.complete()
}

async function pushFileDeletions (File: File, drive: drive_v3.Drive, rootPath: string, observer: any): Promise<void> {
  let oldFile = await getDeletedFile(File)
  while (oldFile != null) {
    observer.next(getRelativePath(rootPath, path.join(oldFile.dataValues.parent, oldFile.dataValues.name)))
    await deleteFile(oldFile.dataValues.driveId, drive)
    await saveFileDeletion(File, oldFile.dataValues.id)
    oldFile = await getDeletedFile(File)
  }
  observer.complete()
}

async function init (sequelize: Sequelize, repoPath: string, drive: drive_v3.Drive): Promise<void> {
  const DirectoryModel = getDirectoryModel(sequelize)
  const root = await DirectoryModel.findOne({
    where: {
      path: repoPath
    }
  })

  if (root == null) {
    throw Error('initialization error')
  }

  if (root.dataValues.driveId == null) {
    const repoName = path.basename(repoPath)
    const folderId = await createFolder(repoName, null, drive)
    await DirectoryModel.update({
      driveId: String(folderId)
    }, {
      where: {
        path: repoPath
      }
    })
  }
}

/* async function push (sequelize: Sequelize, drive: drive_v3.Drive): Promise<void> { */
/* const DirectoryModel = getDirectoryModel(sequelize) */
/* const FileModel = getFileModel(sequelize) */
/* const FileUpdationModel = getFileUpdationModel(sequelize) */

/* // await pushDirectoryAdditions(DirectoryModel, drive) */
/* await pushFileAdditions(FileModel, DirectoryModel, drive) */
/* await pushFileUpdations(FileUpdationModel, DirectoryModel, FileModel, drive) */
/* await pushFileDeletions(FileModel, drive) */
/* await pushDirectoryDeletions(DirectoryModel, drive) */
/* } */

export { init, pushDirectoryAdditions, pushFileAdditions, pushFileUpdations, pushFileDeletions, pushDirectoryDeletions }
