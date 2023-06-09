import SyncdRepository from './SyncdRepository'
import path from 'path'
import authorize from './auth/authClient'
import { google } from 'googleapis'
import { Command } from 'commander'
import { getPushListr, init } from './drive'
import getSequelizeConnection from './databaseConnection'
import { checkIfUploadPending, repoFind } from './utils'
import getDirectoryModel from './models/directory'
import getFileModel from './models/file'
import hashAllFiles from './checksums'
import { getInitListr, getStatusListr } from './cliListrs'
const program = new Command()

program
  .name('syncd')
  .description('a cli tool to backup your local directory to Google Drive')
  .version('0.1.0')

program
  .command('init')
  .description('initialize an empty syncd repository on Drive')
  .argument('<path-to-credentials>', 'path to your credentials file, must be in json format')
  .argument('[path-to-directory]', 'path of directory you want to initialize', '.')
  .action(async (pathToCredentials, pathToDirectory) => {
    const initListr = getInitListr(pathToCredentials, pathToDirectory)
    try {
      await initListr.run()
    } catch (err) {
      console.error(err)
    }
    process.exit(0)
  })

program
  .command('status')
  .description('health check of the repo, returns if previous backup was successful or if there are any changes in the repository contents')
  .action(async () => {
    const statusListr = getStatusListr()
    try {
      await statusListr.run()
    } catch (err) {
      console.error(err)
    }
    process.exit(0)
  })

program
  .command('push')
  .description('push repository\'s contents to Drive')
  .action(async () => {
    const repo = repoFind(process.cwd())
    const sequelize = getSequelizeConnection(path.join(repo.syncddir, 'db.sqlite'))
    const credentialsPath = path.join(repo.syncddir, 'credentials.json')
    const tokenPath = path.join(repo.syncddir, 'token.json')
    const authClient = await authorize(credentialsPath, tokenPath)
    const drive = google.drive({ version: 'v3', auth: authClient })
    const pushListr = getPushListr(sequelize, drive)
    try {
      await pushListr.run()
      process.exit(0)
    } catch (err) {
      console.error(err)
    }
  })

export default program
