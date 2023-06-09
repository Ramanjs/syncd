import SyncdRepository from './SyncdRepository'
import path from 'path'
import authorize from './auth/authClient'
import { google } from 'googleapis'
import { init } from './drive'
import { checkIfUploadPending, repoFind } from './utils'
import getDirectoryModel from './models/directory'
import getFileModel from './models/file'
import hashAllFiles from './checksums'
import Listr from 'listr'
import { type Sequelize } from 'sequelize'
import { type OAuth2Client } from 'google-auth-library'
import { type JSONClient } from 'google-auth-library/build/src/auth/googleauth'

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

export { getInitListr }
