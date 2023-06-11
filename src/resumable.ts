import { type drive_v3 } from 'googleapis'
import axios, { type AxiosInstance } from 'axios'
import { createReadStream, type ReadStream } from 'fs'
import mime from 'mime-types'
import { stat } from 'fs/promises'
import { getRelativePath } from './utils'
import { updateFile } from './drive'

function bitCount (n: number): number {
  n = n - ((n >> 1) & 0x55555555)
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333)
  return ((n + (n >> 4) & 0xF0F0F0F) * 0x1010101) >> 24
}

function nearestValidChunk (n: number): number {
  while (bitCount(n) !== 1) {
    n++
  }
  const minChunk = 256 * 1024
  return minChunk * Math.floor(n / minChunk)
}

function setUpAxiosInterceptors (): AxiosInstance {
  const instance = axios.create()
  instance.interceptors.request.use((config) => {
    config.headers['request-startTime'] = process.hrtime()
    return config
  }, async (error) => {
    return await Promise.reject(error)
  })

  instance.interceptors.response.use((response) => {
    const start = response.config.headers['request-startTime']
    const end = process.hrtime(start)
    const milliseconds = Math.round((end[0] * 1000) + (end[1] / 1000000))
    response.headers['request-duration'] = milliseconds
    return response
  }, async (error) => {
    return await Promise.reject(error)
  })

  return instance
}

function getUploadProgress (path: string, speed: number, progress: number, size: number, bars: number): string {
  let uploadProgress = path
  uploadProgress += ` ${Math.round(progress / 1024)} KiB ${Math.round(speed / 1024)} K/s`
  uploadProgress += ' ['

  const progressBars = Math.round(bars * progress / size)

  for (let i = 0; i < bars; i++) {
    if (i < progressBars) {
      // uploadProgress += '▄'
      uploadProgress += '■'
    } else {
      // uploadProgress += '▁'
      // uploadProgress += '◼'
      uploadProgress += '⬝'
    }
  }

  uploadProgress += `] ${Math.round(100 * progress / size)}%`

  return uploadProgress
}

async function getResumableUri (filePath: string, accessToken: string, drive: drive_v3.Drive): Promise<string> {
  const mimeType = mime.lookup(filePath) !== false ? String(mime.lookup(filePath)) : '[*/*]'

  const resumableUriRes = await axios
    .post('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      null,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Upload-Content-Type': mimeType,
          'Content-Type': 'application/json; charset=UTF-8',
          'Content-Length': 0
        }
      })

  // @ts-expect-error wtf
  const resumableUri = resumableUriRes.headers.get('Location')

  return resumableUri
}

async function upload (resumableUri: string, axiosInstance: AxiosInstance, chunk: ReadStream, accessToken: string, start: number, end: number, size: number): Promise<{ range: string, time: number }> {
  const res = await axiosInstance
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
    return {
      range: res.data.id,
      time: res.headers['request-duration']
    }
  }

  return {
  // @ts-expect-error wtf
    range: res.headers.get('Range'),
    time: res.headers['request-duration']
  }
}

async function uploadFile (resumableUri: string, rootPath: string, filePath: string, accessToken: string, axiosInstance: AxiosInstance, observer: any): Promise<string> {
  const CHUNK_SIZE = 5 * 1024 * 1024
  const size = (await stat(filePath)).size
  let res
  let start = 0; let end = 0
  const relativePath = getRelativePath(rootPath, filePath)
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

    const uploadProgress = getUploadProgress(relativePath, CHUNK_SIZE, progress, size, 20)
    observer.next(uploadProgress)
    res = await upload(resumableUri, axiosInstance, stream, accessToken, start, end, size)

    if (end === size - 1) {
      break
    }

    start = Number(res.range.slice(res.range.lastIndexOf('-') + 1)) + 1
    // CHUNK_SIZE = Math.max(256 * 1024, nearestValidChunk(Math.round(CHUNK_SIZE / ((res.time / 2) / 1000))))
    progress += CHUNK_SIZE
  }

  return res.range
}

async function resumableUpload (rootPath: string, filePath: string, fileName: string, parentDriveId: string, accessToken: string, drive: drive_v3.Drive, observer: any): Promise<string> {
  const resumableUri = await getResumableUri(filePath, accessToken, drive)
  const axiosInstance = setUpAxiosInterceptors()
  const fileId = await uploadFile(resumableUri, rootPath, filePath, accessToken, axiosInstance, observer)
  await updateFile(fileId, fileName, parentDriveId, '', drive)
  return fileId
}

export default resumableUpload
