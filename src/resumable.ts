import { type drive_v3 } from 'googleapis'
import axios from 'axios'
import { createReadStream, type ReadStream } from 'fs'
import mime from 'mime-types'
import { stat } from 'fs/promises'
import { getRelativePath } from './utils'

const CHUNK_SIZE = 1024 * 1024

function getUploadProgress (path: string, progress: number, size: number): string {
  let uploadProgress = path
  uploadProgress += ' ['

  for (let i = 0; i < size; i++) {
    if (i < progress) {
      uploadProgress += '█'
    } else {
      uploadProgress += '▁'
    }
  }

  uploadProgress += ']'

  return uploadProgress
}

async function getResumableUri (filePath: string, fileName: string, parentDriveId: string, accessToken: string, drive: drive_v3.Drive): Promise<string> {
  const res = await drive.files.generateIds({
    count: 1
  })

  const mimeType = mime.lookup(filePath) !== false ? String(mime.lookup(filePath)) : '[*/*]'
  const fileId = (res.data.ids != null) ? res.data.ids[0] : ''
  const metadata = {
    id: fileId,
    name: fileName
  }
  const contentLength = Buffer.byteLength(JSON.stringify(metadata))
  const resumableUriRes = await axios
    .post('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      metadata,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Upload-Content-Type': mimeType,
          'Content-Type': 'application/json; charset=UTF-8',
          'Content-Length': contentLength
        }
      })

  // @ts-expect-error wtf
  const resumableUri = resumableUriRes.headers.get('Location')

  return resumableUri
}

async function upload (resumableUri: string, chunk: ReadStream, accessToken: string, start: number, end: number, size: number): Promise<string> {
  const res = await axios
    .put(resumableUri,
      chunk,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${size}`
        },
        validateStatus: status => (status === 308 || status === 200)
      })

  if (res.status === 200) {
    return res.data.id
  }
  // @ts-expect-error wtf
  return res.headers.get('Range')
}

async function uploadFile (resumableUri: string, rootPath: string, filePath: string, accessToken: string, observer: any): Promise<string> {
  const size = (await stat(filePath)).size
  let range
  let start = 0; let end = 0
  const relativePath = getRelativePath(rootPath, filePath)
  const bars = size / CHUNK_SIZE
  let progress = 0
  while (true) {
    if (start + CHUNK_SIZE > size) {
      end = size - 1
    } else {
      end = start + CHUNK_SIZE - 1
    }

    const stream = createReadStream(filePath, {
      highWaterMark: CHUNK_SIZE,
      start,
      end
    })

    const uploadProgress = getUploadProgress(relativePath, progress, bars)
    observer.next(uploadProgress)
    range = await upload(resumableUri, stream, accessToken, start, end, size)
    progress += 1

    if (end === size - 1) {
      break
    }

    start = Number(range.slice(range.lastIndexOf('-') + 1)) + 1
  }

  return range
}

async function resumableUpload (rootPath: string, filePath: string, fileName: string, parentDriveId: string, accessToken: string, drive: drive_v3.Drive, observer: any): Promise<string> {
  const resumableUri = await getResumableUri(filePath, fileName, parentDriveId, accessToken, drive)
  const fileId = await uploadFile(resumableUri, rootPath, filePath, accessToken, observer)
  return fileId
}

export default resumableUpload
