import { promises as fs } from 'fs'
import path from 'path'
import process from 'process'
import { authenticate } from '@google-cloud/local-auth'
import { google } from 'googleapis'
import { type JSONClient } from 'google-auth-library/build/src/auth/googleauth'
import { type OAuth2Client } from 'google-auth-library'

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive']
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), './auth/token.json')
const CREDENTIALS_PATH = path.join(process.cwd(), './auth/credentials.json')

/**
* Reads previously authorized credentials from the save file.
*
* @return {Promise<OAuth2Client|null>}
*/
async function loadSavedCredentialsIfExist (): Promise<JSONClient | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH)
    const credentials = JSON.parse(content.toString())
    return google.auth.fromJSON(credentials)
  } catch (err) {
    return null
  }
}

/**
* Serializes credentials to a file comptible with GoogleAUth.fromJSON.
*
* @param {OAuth2Client} client
* @return {Promise<void>}
*/
async function saveCredentials (client: OAuth2Client): Promise<void> {
  const content = await fs.readFile(CREDENTIALS_PATH)
  const keys = JSON.parse(content.toString())
  let key
  if (keys.installed != null) key = keys.installed
  else key = keys.web
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token
  })
  await fs.writeFile(TOKEN_PATH, payload)
}

/**
* Load or request or authorization to call APIs.
*
*/
async function authorize (): Promise<JSONClient | OAuth2Client> {
  const client = await loadSavedCredentialsIfExist()
  if (client != null) {
    return client
  }
  const OAuthClient = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH
  })
  await saveCredentials(OAuthClient)
  return OAuthClient
}

export default authorize
