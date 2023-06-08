import authorize from './auth/authClient'
import { type drive_v3, google } from 'googleapis'
import path from 'path'
import Directory, { type DirectoryAttributes, type DirectoryCreationAttributes } from './models/directory'
import type SyncdRepository from './SyncdRepository'
import mime from 'mime-types'
import { createReadStream } from 'fs'
import { type Model, Op } from 'sequelize'
import { statusConfig } from './config/status'
import File, { type FileAttributes, type FileCreationAttributes } from './models/file'
import FileUpdation, { type FileUpdationAttributes, type FileUpdationCreationAttributes } from './models/fileUpdation'

async function getNewDirectory (): Promise<Model<DirectoryAttributes, DirectoryCreationAttributes
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

async function getDeletedDirectory (): Promise<Model<DirectoryAttributes, DirectoryCreationAttributes> | null> {
  const oldDirectory = await Directory.findOne({
    where: {
      status: statusConfig.PENDING_DELETION
    }
  })

  return oldDirectory
}

async function saveDirectoryDriveId (directoryPath: string, fileId: string): Promise<void> {
  await Directory.update({
    driveId: fileId,
    status: statusConfig.DONE
  }, {
    where: {
      path: directoryPath
    }
  })
}

async function saveDirectoryDeletion (directoryPath: string): Promise<void> {
  await Directory.destroy({
    where: {
      path: directoryPath
    }
  })
}

async function getNewFile (): Promise<Model<FileAttributes, FileCreationAttributes
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

async function getDeletedFile (): Promise<Model<FileAttributes, FileCreationAttributes> | null> {
  const oldFile = await File.findOne({
    where: {
      status: statusConfig.PENDING_DELETION
    }
  })

  return oldFile
}

async function saveFileDriveId (fileId: number, fileDriveId: string): Promise<void> {
  await File.update({
    driveId: fileDriveId,
    status: statusConfig.DONE
  }, {
    where: {
      id: fileId
    }
  })
}

async function saveFileDeletion (fileId: number): Promise<void> {
  await File.destroy({
    where: {
      id: fileId
    }
  })
}

async function getNewFileUpdation (): Promise<Model<FileUpdationAttributes, FileUpdationCreationAttributes> | null> {
  const newFileUpdate = await FileUpdation.findOne()
  return newFileUpdate
}

async function saveFileUpdation (fileId: number, newName: string, newParent: string): Promise<void> {
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

async function getDirectoryDriveId (directoryPath: string): Promise<string> {
  const directory = await Directory.findOne({
    where: {
      path: directoryPath
    }
  })

  return String(directory?.dataValues.driveId)
}

async function getFileDriveId (fileId: number): Promise<string> {
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

async function pushDirectoryAdditions (drive: drive_v3.Drive): Promise<void> {
  let newDirectory = await getNewDirectory()
  while (newDirectory != null) {
    const directoryName = path.basename(newDirectory.dataValues.path)
    // @ts-expect-error idk how to implement eager loading in ts
    const parentDriveId = newDirectory.dataValues.Parent.dataValues.driveId
    const directoryId = await createFolder(directoryName, parentDriveId, drive)
    await saveDirectoryDriveId(newDirectory.dataValues.path, String(directoryId))
    newDirectory = await getNewDirectory()
  }
}

async function pushDirectoryDeletions (drive: drive_v3.Drive): Promise<void> {
  let oldDirectory = await getDeletedDirectory()
  while (oldDirectory != null) {
    await deleteFile(oldDirectory.dataValues.driveId, drive)
    await saveDirectoryDeletion(oldDirectory.dataValues.path)
    oldDirectory = await getDeletedDirectory()
  }
}

async function pushFileAdditions (drive: drive_v3.Drive): Promise<void> {
  let newFile = await getNewFile()
  while (newFile != null) {
    // @ts-expect-error idk how to implement eager loading in ts
    const fileId = await createFile(newFile.dataValues.name, newFile.dataValues.parent, newFile.dataValues.Directory.dataValues.driveId, drive)
    await saveFileDriveId(newFile.dataValues.id, String(fileId))
    newFile = await getNewFile()
  }
}

async function pushFileUpdations (drive: drive_v3.Drive): Promise<void> {
  let newFileUpdate = await getNewFileUpdation()
  while (newFileUpdate != null) {
    const oldParentDriveId = await getDirectoryDriveId(newFileUpdate.dataValues.oldParent)
    const newParentDriveId = await getDirectoryDriveId(newFileUpdate.dataValues.newParent)
    const fileDriveId = await getFileDriveId(newFileUpdate.dataValues.id)
    await updateFile(fileDriveId, newFileUpdate.dataValues.newName, newParentDriveId, oldParentDriveId, drive)
    await saveFileUpdation(newFileUpdate.dataValues.id, newFileUpdate.dataValues.newName, newFileUpdate.dataValues.newParent)
    newFileUpdate = await getNewFileUpdation()
  }
}

async function pushFileDeletions (drive: drive_v3.Drive): Promise<void> {
  let oldFile = await getDeletedFile()
  while (oldFile != null) {
    await deleteFile(oldFile.dataValues.driveId, drive)
    await saveFileDeletion(oldFile.dataValues.id)
    oldFile = await getDeletedFile()
  }
}

async function init (repo: string, drive: drive_v3.Drive): Promise<void> {
  try {
    const root = await Directory.findOne({
      where: {
        path: '.'
      }
    })
    if (root?.dataValues.driveId == null) {
      const folderId = await createFolder(repo, null, drive)
      await Directory.update({
        driveId: String(folderId)
      }, {
        where: {
          path: '.'
        }
      })
    }
  } catch (err) {
    console.log(err)
  }
}

async function push (repo: SyncdRepository): Promise<void> {
  const repoName = path.basename(path.resolve(repo.workdir))
  const authClient = await authorize()
  const drive = google.drive({ version: 'v3', auth: authClient })
  await init(repoName, drive)
  await pushDirectoryAdditions(drive)
  await pushFileAdditions(drive)
  await pushFileUpdations(drive)
  await pushFileDeletions(drive)
  await pushDirectoryDeletions(drive)
}

export { init, push }
