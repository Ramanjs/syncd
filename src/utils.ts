import path from 'path'
import SyncdRepository from './SyncdRepository'
import { statSync } from 'fs'
import { type File } from './models/file'
import { type Directory } from './models/directory'
import { statusConfig } from './config/status'
import { Op } from 'sequelize'

function repoFind (curPath: string): SyncdRepository {
  curPath = path.resolve(curPath)

  if (statSync(path.join(curPath, '.syncd')).isDirectory()) {
    return new SyncdRepository(curPath)
  }

  const parentPath = path.resolve(path.join(curPath, '..'))

  if (parentPath === curPath) {
    throw Error('Not a syncd directory')
  }

  return repoFind(parentPath)
}

async function checkIfUploadPending (Directory: Directory, File: File): Promise<boolean> {
  const pendingDirectories = await Directory.findOne({
    where: {
      status: {
        [Op.ne]: statusConfig.DONE
      }
    }
  })

  if (pendingDirectories != null) {
    return true
  }

  const pendingFiles = await File.findOne({
    where: {
      status: {
        [Op.ne]: statusConfig.DONE
      }
    }
  })

  if (pendingFiles != null) {
    return true
  }

  return false
}

function getRelativePath (root: string, filePath: string): string {
  return filePath.slice(root.length + 1)
}

export { repoFind, checkIfUploadPending, getRelativePath }
