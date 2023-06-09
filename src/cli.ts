import SyncdRepository from './SyncdRepository'
import path from 'path'
import authorize from './auth/authClient'
import { google } from 'googleapis'
import { Command } from 'commander'
import { init } from './drive'
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
  })

export default program
