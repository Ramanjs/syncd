import SyncdRepository from '../SyncdRepository'
import path from 'path'
import authorize from '../drive/authClient'
import { type drive_v3, google } from 'googleapis'
import { init, pushDirectoryAdditions, pushFileAdditions, pushFileUpdations, pushFileDeletions, pushDirectoryDeletions } from '../drive/drive'
import { checkIfUploadPending, repoFind } from '../utils'
import getDirectoryModel from '../models/directory'
import getFileModel from '../models/file'
import getFileUpdationModel from '../models/fileUpdation'
import getSequelizeConnection from '../databaseConnection'
import hashAllFiles from '../checksums'
import Listr from 'listr'
import { type Sequelize } from 'sequelize'
import { type OAuth2Client } from 'google-auth-library'
import { type JSONClient } from 'google-auth-library/build/src/auth/googleauth'
import Observable from 'zen-observable'

function getInitListr (pathToCredentials: string, pathToDirectory: string): Listr {
  let repo: SyncdRepository
  let sequelize: Sequelize
  let authClient: OAuth2Client | JSONClient
  const initListr = new Listr([
    {
      title: 'Initializing local repository',
      task: async () => {
        try {
          repo = new SyncdRepository(pathToDirectory, true)
          sequelize = await repo.createRepo(pathToCredentials)
        } catch (err: any) {
          await repo.deleteRepo()
          throw Error(err.message)
        }
      }
    },
    {
      title: 'Authorize on Drive in browser',
      task: async () => {
        try {
          const credentialsPath = path.join(repo.syncddir, 'credentials.json')
          const tokenPath = path.join(repo.syncddir, 'token.json')
          authClient = await authorize(credentialsPath, tokenPath)
        } catch (err: any) {
          await repo.deleteRepo()
          throw Error(err.message)
        }
      }
    },
    {
      title: 'Creating empty folder on Drive',
      task: async () => {
        try {
          const drive = google.drive({ version: 'v3', auth: authClient })
          await init(sequelize, repo.worktree, drive)
        } catch (err: any) {
          await repo.deleteRepo()
          throw Error(err.message)
        }
      }
    }
  ])
  return initListr
}

function getStatusListr (): Listr {
  const repo = repoFind(process.cwd())
  const sequelize = getSequelizeConnection(path.join(repo.syncddir, 'db.sqlite'))
  const DirectoryModel = getDirectoryModel(sequelize)
  const FileModel = getFileModel(sequelize)

  // @ts-expect-error idk how to fix this
  const statusListr = new Listr([
    {
      title: 'Searching for pending operations',
      task: async (ctx, task) => {
        const isPending = await checkIfUploadPending(DirectoryModel, FileModel)
        ctx.isPending = isPending
        if (isPending) {
          task.title = 'There are pending uploads in your repository. Please run `syncd push` first to publish them to Drive.'
        }
      }
    },
    {
      title: 'Scanning repository for changes',
      enabled: ctx => ctx.isPending === false,
      task: async (ctx) => {
        await repo.loadDatabase()
        await repo.walkWorkdir(repo.worktree)

        if (repo.fileAdditions.length > 0) {
          ctx.newFiles = true
        }
      }
    },
    {
      title: 'Computing checksums',
      enabled: ctx => ctx.newFiles === true,
      task: () => {
        return new Observable(observer => {
          hashAllFiles(repo, observer)
        })
      }
    },
    {
      title: 'Saving changes to local database',
      enabled: ctx => ctx.isPending === false,
      task: async (ctx, task) => {
        const res = await repo.saveToDB()
        if (!res) {
          task.title = 'No changes found. Repo backed up successfully.'
        }
      }
    }
  ])

  return statusListr
}

function getPushListr (): Listr {
  const repo = repoFind(process.cwd())
  const sequelize = getSequelizeConnection(path.join(repo.syncddir, 'db.sqlite'))
  const credentialsPath = path.join(repo.syncddir, 'credentials.json')
  const tokenPath = path.join(repo.syncddir, 'token.json')

  const DirectoryModel = getDirectoryModel(sequelize)
  const FileModel = getFileModel(sequelize)
  const FileUpdationModel = getFileUpdationModel(sequelize)

  let drive: drive_v3.Drive

  // @ts-expect-error idk wtf is happening here
  const pushListr = new Listr([
    {
      title: 'Searching for pending operations',
      task: async (ctx, task) => {
        const isPending = await checkIfUploadPending(DirectoryModel, FileModel)
        ctx.isPending = isPending
        if (!isPending) {
          task.title = 'There are no pending changes. Please run `syncd status` first to scan your repository.'
        }
      }
    },
    {
      title: 'Authorizing',
      enabled: ctx => ctx.isPending,
      task: async (ctx) => {
        const authClient = await authorize(credentialsPath, tokenPath)
        drive = google.drive({ version: 'v3', auth: authClient })
        await drive.files.list({
          pageSize: 1
        })
        ctx.accessToken = String(authClient.credentials.access_token)
      }
    },
    {
      title: 'Creating new folders',
      enabled: ctx => ctx.isPending,
      task: () => {
        return new Observable(observer => {
          void pushDirectoryAdditions(DirectoryModel, drive, observer)
        })
      }
    },
    {
      title: 'Uploading new files',
      enabled: ctx => ctx.isPending,
      task: (ctx) => {
        return new Observable(observer => {
          void pushFileAdditions(FileModel, DirectoryModel, ctx.accessToken, drive, repo.worktree, observer)
        })
      }
    },
    {
      title: 'Updating file metadata (moving/renaming)',
      enabled: ctx => ctx.isPending,
      task: () => {
        return new Observable(observer => {
          void pushFileUpdations(FileUpdationModel, DirectoryModel, FileModel, drive, repo.worktree, observer)
        })
      }
    },
    {
      title: 'Deleting old files',
      enabled: ctx => ctx.isPending,
      task: () => {
        return new Observable(observer => {
          void pushFileDeletions(FileModel, drive, repo.worktree, observer)
        })
      }
    },
    {
      title: 'Cleaning empty folders',
      enabled: ctx => ctx.isPending,
      task: () => {
        return new Observable(observer => {
          void pushDirectoryDeletions(DirectoryModel, drive, repo.worktree, observer)
        })
      }
    }
  ])
  return pushListr
}

export { getInitListr, getStatusListr, getPushListr }
