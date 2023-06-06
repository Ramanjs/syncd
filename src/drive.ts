import authorize from './auth/authClient'
import { google } from 'googleapis'
import path from 'path'
import Directory from './models/directory'
import type SyncdRepository from './SyncdRepository'

async function init (repo: string): Promise<string | null | undefined> {
  const authClient = await authorize()
  const drive = google.drive({ version: 'v3', auth: authClient })
  const fileMetadata = {
    name: repo,
    mimeType: 'application/vnd.google-apps.folder'
  }
  try {
    const folder = await drive.files.create({
      requestBody: fileMetadata
    })
    console.log('Folder Id:', folder.data.id)
    return folder.data.id
  } catch (err) {
    console.log(err)
  }
}

async function push (repo: SyncdRepository): Promise<void> {
  const repoName = path.basename(path.resolve(repo.workdir))
  const repoFolderId = await init(repoName)
  console.log(repoFolderId)
}

export { init, push }
