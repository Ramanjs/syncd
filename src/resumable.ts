import { google } from 'googleapis'
import axios from 'axios'
import authorize from './auth/authClient'
import { createReadStream, type ReadStream } from 'fs'
import mime from 'mime-types'
import { stat } from 'fs/promises'

const CHUNK_SIZE = 5 * 1024 * 1024

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

  // @ts-expect-error wtf
  return res.headers.get('Range')
}

async function uploadFile (resumableUri: string, filePath: string, accessToken: string): Promise<void> {
  const size = (await stat(filePath)).size
  let start = 0; let end = 0
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

    const range = await upload(resumableUri, stream, accessToken, start, end, size)

    if (end === size - 1) {
      break
    }

    start = Number(range.slice(range.lastIndexOf('-') + 1)) + 1
  }
}

async function main (): Promise<void> {
  try {
    const client = await authorize('./credentials.json', '/home/raman/Documents/github-projects/syncd/src/auth/token.json')
    const drive = google.drive({ version: 'v3', auth: client })

    const res = await drive.files.generateIds({
      count: 1
    })

    const filePath = './video.mp4'
    const mimeType = mime.lookup(filePath) !== false ? String(mime.lookup(filePath)) : '[*/*]'
    const accessToken = String(client.credentials.access_token)
    const fileId = (res.data.ids != null) ? res.data.ids[0] : ''
    const metadata = {
      id: fileId,
      name: 'hehe.mp4'
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

    await uploadFile(resumableUri, filePath, accessToken)
  } catch (err: any) {
    console.log(err)
  }
}

void main()
