import { type drive_v3 } from 'googleapis'
import path from 'path'
import getDirectoryModel, { type Directory, type DirectoryAttributes, type DirectoryCreationAttributes } from './models/directory'
import mime from 'mime-types'
import { createReadStream } from 'fs'
import { Op, type Model, type Sequelize } from 'sequelize'
import { statusConfig } from './config/status'
import getFileModel, { type File, type FileAttributes, type FileCreationAttributes } from './models/file'
import getFileUpdationModel, { type FileUpdation, type FileUpdationAttributes, type FileUpdationCreationAttributes } from './models/fileUpdation'
import Listr from 'listr'
import Observable from 'zen-observable'
import { type Observer } from 'rxjs'
// import { Observable } from 'rxjs'

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

async function saveFileUpdation (FileUpdation: FileUpdation, File: File, fileId: number, newName: string, newParent: string): Promise<void> {
  await FileUpdation.destroy({
    where: {
      id: fileId
    }
  })
  await File.update({
    name: newName,
    parent: newParent,
    status: statusConfig.DONE
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

async function pushDirectoryAdditions (Directory: Directory, drive: drive_v3.Drive, observer: Observer<any>): Promise<void> {
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

async function pushDirectoryDeletions (Directory: Directory, drive: drive_v3.Drive): Promise<void> {
  let oldDirectory = await getDeletedDirectory(Directory)
  while (oldDirectory != null) {
    await deleteFile(oldDirectory.dataValues.driveId, drive)
    await saveDirectoryDeletion(Directory, oldDirectory.dataValues.path)
    oldDirectory = await getDeletedDirectory(Directory)
  }
}

async function pushFileAdditions (File: File, Directory: Directory, drive: drive_v3.Drive): Promise<void> {
  let newFile = await getNewFile(File, Directory)
  while (newFile != null) {
    // @ts-expect-error idk how to implement eager loading in ts
    const fileId = await createFile(newFile.dataValues.name, newFile.dataValues.parent, newFile.dataValues.Directory.dataValues.driveId, drive)
    await saveFileDriveId(File, newFile.dataValues.id, String(fileId))
    newFile = await getNewFile(File, Directory)
  }
}

async function pushFileUpdations (FileUpdation: FileUpdation, Directory: Directory, File: File, drive: drive_v3.Drive): Promise<void> {
  let newFileUpdate = await getNewFileUpdation(FileUpdation)
  while (newFileUpdate != null) {
    const oldParentDriveId = await getDirectoryDriveId(Directory, newFileUpdate.dataValues.oldParent)
    const newParentDriveId = await getDirectoryDriveId(Directory, newFileUpdate.dataValues.newParent)
    const fileDriveId = await getFileDriveId(File, newFileUpdate.dataValues.id)
    await updateFile(fileDriveId, newFileUpdate.dataValues.newName, newParentDriveId, oldParentDriveId, drive)
    await saveFileUpdation(FileUpdation, File, newFileUpdate.dataValues.id, newFileUpdate.dataValues.newName, newFileUpdate.dataValues.newParent)
    newFileUpdate = await getNewFileUpdation(FileUpdation)
  }
}

async function pushFileDeletions (File: File, drive: drive_v3.Drive): Promise<void> {
  let oldFile = await getDeletedFile(File)
  while (oldFile != null) {
    await deleteFile(oldFile.dataValues.driveId, drive)
    await saveFileDeletion(File, oldFile.dataValues.id)
    oldFile = await getDeletedFile(File)
  }
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

async function push (sequelize: Sequelize, drive: drive_v3.Drive): Promise<void> {
  const DirectoryModel = getDirectoryModel(sequelize)
  const FileModel = getFileModel(sequelize)
  const FileUpdationModel = getFileUpdationModel(sequelize)

  // await pushDirectoryAdditions(DirectoryModel, drive)
  await pushFileAdditions(FileModel, DirectoryModel, drive)
  await pushFileUpdations(FileUpdationModel, DirectoryModel, FileModel, drive)
  await pushFileDeletions(FileModel, drive)
  await pushDirectoryDeletions(DirectoryModel, drive)
}

function getPushListr (sequelize: Sequelize, drive: drive_v3.Drive): Listr {
  const DirectoryModel = getDirectoryModel(sequelize)
  const FileModel = getFileModel(sequelize)
  const FileUpdationModel = getFileUpdationModel(sequelize)

  // @ts-expect-error idk wtf is happening here
  const pushListr = new Listr([
    {
      title: 'Creating new folders',
      task: () => {
        return new Observable(observer => {
          void pushDirectoryAdditions(DirectoryModel, drive, observer)
        })
      }
    }
  ])

  return pushListr
}

export { init, push, getPushListr }
