import { ArgumentParser } from 'argparse'

const parser = new ArgumentParser({
  description: 'A CLI tool to sync your local directory with Google Drive'
})

const subparsers = parser.add_subparsers({
  title: 'Commands',
  dest: 'command',
  required: true
})

const argsp = subparsers.add_parser('init', {
  help: 'Initialize a new, empty repository'
})

argsp.add_argument('path', {
  metavar: 'directory',
  nargs: '?',
  default: '.',
  help: 'where to create the repository'
})

function main (): void {
  const args = parser.parse_args()
  if (args.command === 'init') {
    //
  }
}

main()
