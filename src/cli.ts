import SyncdRepository from './SyncdRepository'
import path from 'path'
import authorize from './auth/authClient'
import { google } from 'googleapis'
import { Command } from 'commander'
import { getPushListr, init, push } from './drive'
import getSequelizeConnection from './databaseConnection'
import { checkIfUploadPending, repoFind } from './utils'
import getDirectoryModel from './models/directory'
import getFileModel from './models/file'
import hashAllFiles from './checksums'
const program = new Command()

program
  .name('syncd')
  .description('CLI to backup your local directory to Google Drive')
  .version('0.1.0')

program
  .command('init')
  .description('initialize an empty syncd repository on Drive')
  .argument('<path-to-credentials>', 'path to your credentials file, must be in json format')
  .argument('[path-to-directory]', 'path of directory you want to initialize', '.')
  .action(async (pathToCredentials, pathToDirectory) => {
    const repo = new SyncdRepository(pathToDirectory, true)
    const sequelize = await repo.createRepo(pathToCredentials)
    const credentialsPath = path.join(repo.syncddir, 'credentials.json')
    const tokenPath = path.join(repo.syncddir, 'token.json')
    const authClient = await authorize(credentialsPath, tokenPath)
    const drive = google.drive({ version: 'v3', auth: authClient })
    await init(sequelize, repo.worktree, drive)
    process.exit(0)
  })

program
  .command('status')
  .description('health check of the repo, returns if previous backup was successful or if there are any changes in the repository contents')
  .action(async () => {
    const repo = repoFind(process.cwd())
    const sequelize = getSequelizeConnection(path.join(repo.syncddir, 'db.sqlite'))
    const DirectoryModel = getDirectoryModel(sequelize)
    const FileModel = getFileModel(sequelize)
    const isPending = await checkIfUploadPending(DirectoryModel, FileModel)
    if (isPending) {
      console.log('There are pending uploads in your repository. Please run `syncd push` to publish them to Drive')
      process.exit(0)
    } else {
      console.log('Scanning folders for changes...')
      await repo.loadDatabase()
      await repo.walkWorkdir(repo.worktree)
      if (repo.fileAdditions.length > 0) {
        hashAllFiles(repo)
      } else {
        await repo.saveToDB()
      }
    }
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
    pushListr.run()
      .then(() => {
        process.exit(0)
      })
      .catch(err => { console.log(err) })
    // await push(sequelize, drive)
  })

export default program
