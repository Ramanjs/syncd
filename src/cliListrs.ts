import SyncdRepository from './SyncdRepository'
import path from 'path'
import authorize from './auth/authClient'
import { google } from 'googleapis'
import { init } from './drive'
import { checkIfUploadPending, repoFind } from './utils'
import getDirectoryModel from './models/directory'
import getFileModel from './models/file'
import getSequelizeConnection from './databaseConnection'
import hashAllFiles from './checksums'
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
        repo = new SyncdRepository(pathToDirectory, true)
        sequelize = await repo.createRepo(pathToCredentials)
      }
    },
    {
      title: 'Authorize on Drive in browser',
      task: async () => {
        const credentialsPath = path.join(repo.syncddir, 'credentials.json')
        const tokenPath = path.join(repo.syncddir, 'token.json')
        authClient = await authorize(credentialsPath, tokenPath)
      }
    },
    {
      title: 'Creating empty folder on Drive',
      task: async () => {
        const drive = google.drive({ version: 'v3', auth: authClient })
        await init(sequelize, repo.worktree, drive)
      }
    }
  ])
  return initListr
}

function getStatusListr (): Listr {
  let repo: SyncdRepository

  // @ts-expect-error idk how to fix this
  const statusListr = new Listr([
    {
      title: 'Searching for pending operations',
      task: async (ctx) => {
        repo = repoFind(process.cwd())
        const sequelize = getSequelizeConnection(path.join(repo.syncddir, 'db.sqlite'))
        const DirectoryModel = getDirectoryModel(sequelize)
        const FileModel = getFileModel(sequelize)
        const isPending = await checkIfUploadPending(DirectoryModel, FileModel)
        ctx.isPending = isPending

        if (isPending) {
          console.log('There are pending uploads in your repository. Please run `syncd push` to publish them to Drive.')
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
      task: async () => {
        await repo.saveToDB()
      }
    }
  ])

  return statusListr
}

export { getInitListr, getStatusListr }
