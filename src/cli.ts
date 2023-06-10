import { Command } from 'commander'
import { getInitListr, getStatusListr, getPushListr } from './cliListrs'
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
    const pushListr = getPushListr()
    try {
      await pushListr.run()
    } catch (err) {
      console.error(err)
    }
    process.exit(0)
  })

export default program
