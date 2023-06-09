import { promises as fs } from 'fs'
import { authenticate } from '@google-cloud/local-auth'
import { google } from 'googleapis'
import { type JSONClient } from 'google-auth-library/build/src/auth/googleauth'
import { type OAuth2Client } from 'google-auth-library'

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive']
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.

/**
* Reads previously authorized credentials from the save file.
*
* @return {Promise<OAuth2Client|null>}
*/
async function loadSavedCredentialsIfExist (tokenPath: string): Promise<JSONClient | null> {
  try {
    const content = await fs.readFile(tokenPath)
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
async function saveCredentials (client: OAuth2Client, credentialsPath: string, tokenPath: string): Promise<void> {
  const content = await fs.readFile(credentialsPath)
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
  await fs.writeFile(tokenPath, payload)
}

/**
* Load or request or authorization to call APIs.
*
*/
async function authorize (credentialsPath: string, tokenPath: string): Promise<JSONClient | OAuth2Client> {
  const client = await loadSavedCredentialsIfExist(tokenPath)
  if (client != null) {
    return client
  }
  const OAuthClient = await authenticate({
    scopes: SCOPES,
    keyfilePath: credentialsPath
  })
  await saveCredentials(OAuthClient, credentialsPath, tokenPath)
  return OAuthClient
}

export default authorize
