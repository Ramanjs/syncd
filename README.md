# Syncd

A CLI tool to sync your local directory with Google Drive.

## Development

- [ ] SQLite
    - [x] Setup SQLite
    - [x] Define a SQLite schema
    - [x] Research Node libraries for SQLite
    - [ ] Research about aquiring locks and transactions in SQLite

- [ ] Research CLI prettifying libraries

- [x] Define features and options to support

- [ ] Define and write business logic
    - [x] Define logic for local diffing
    - [x] Implement local diffing
    - [ ] Define logic for handling uploads
    - [ ] Implement file uploads

- [x] Research about Node Workers and checksums

- [ ] Explore possibility of using caching: Redis and node-cache

- [ ] Explore Cron jobs and inotifywait for running periodic checks in the directory

- [ ] Research about Webhooks and explore how to use ngrok or other similar tools

- [ ] Checkout log-updates and similar packages for displaying progress bars

## SQLite Schema 

**Directory schema**:

`path`: string, unique, primary key: includes directory name

`lastModified`: Timestamp

`lastChanged`: Timestamp

`parent`: string, self-referential foreign key: `path` of parent directory

**File schema**:

`name`: string

`hash`: string

`lastModified`: Timestamp

`lastChanged`: Timestamp

`parent`: string: foreign key to Directory table

## Supported features

1. Backup any local directory to Google Drive on command or automatically (schedule a regular backup)
2. Pull a backed up repository from Drive to your local machine
3. Watch for changes to repository on Drive ?? Do we want a single source of truth or multiple? NOT CLEAR. If for instance we support multiple sources of truth then it will be pretty similar to git and GitHub.
4. In order to justify usage of Webhooks and reverse tunneling, we NEED to support pulling a repo and watching for any changes.

Initialization of repository on local computer and drive needs to be defined in more detail.

### Initialization

**When creating a new repository**:
A local directory can be initialized by providing the path to that directory and the path to the Drive authentication credentials file.
The `init` command should login the user using the OAuth consent screen, initialize the local SQLite database and create a folder on Drive with the same name as the provided argument.

**When pulling/cloning an existing repository from Drive**:
We could `clone` an existing repository when provided with the drive `id` of that folder. Following that, we could internally execute a `pull` command that fetches all the content inside that folder.

### Commands supported

#### `syncd init`

#### `syncd status`

Check the health of the repository.

Possible damages a repo can take:
1. Some local files have not been backed up or failed to upload during previous backup.
   * Check if any file or directory in the database has a `PENDING` status.
2. Database file missing / Credentials file missing.
3. Folder gets deleted from drive.
4. Conflict in local tree structure and Drive.

#### `syncd clone`

#### `syncd push`

#### `syncd pull`

## Business logic

All possible operations inside a directory are:
* add (U)
* delete (U)
* modify (U)
* move (C)
* copy (C)
* rename (C)

### Diffing the local directory
Diffing a directory efficiently is a tough task. A simple algorithm to detect changes in a directory would be:

1. Fetch a list of all the files and directories from the database into memory.
2. Start walking the directory starting from the root.
3. Check if the file or directory inside the current directory exists in the list.
    1. If yes, check whether it has been modified or changed using lstat. Then add all the files that have been modified into a separate `additions` list to track all the new uploads we *might* need to make. Also add each modified file into the `deletions` list.
    2. If the file does not exist in the list, simply append it to the `additions` list.
4. Now that we have separate `additions` and `deletions` lists, we can filter out the files that have been moved or renamed. To do this, calculate the checksum of every file in the `additions` list. Check if the checksum exists in the `deletions` list as well.
    1. If yes, then the file has either been moved or renamed. Checks for both these changes are trivial.
    2. Otherwise, the file is indeed a new addition to the repository. A copy operation would simply be considered a new addition.
5. Handle changes in file metadata by making a separate list of `updates`. We will be populating this list during step 4.1. Remove the files that have same hashes in both `additions` and `deletions` lists and add a single entry to the `updates` list.
6. Finally start syncing all the changes with google drive. Before that we need to write all the pending changes to the database incase of unexpected failure. There is also a possibility of incomplete uploads/interruption/system failure.
    1. To counter this, we could add a new column for each file inside the database. For instance, use `PENDING_ADDITION`, `PENDING_DELETION` and `PENDING_UPDATE` to denate starting state of each file in the 3 lists.
    2. On completion of their repective operations, change the state to `DONE`. While we can use the same tables for pending addition and deletion operations, we need a separate table to store the pending updates to any file or directory (for example, a new table that stores, the previous and new, folder and name of a file).This step allows us to check the state of a database before doing any action and apply pending operations.

### Upload to Drive

Proposed algorithm to handle file uploads to Google Drive:

1. Order in which operations should be processed:
    1. Directory additions
    2. File additions
    3. File updates
    4. File deletions
    5. Directory deletions

2. Directory additions: this part is relatively simple. Just creaete a file with a mime type of `folder` using the API.

3. File addition (complex): Depending upon the size of the file, we might need to apply different upload algorithms.
    1. For small files (size < 5 MB), implement a simple upload.
    2. For files bigger than 5 MB, perform a resumable upload in chunks of 5 MBs using file streams and the Drive resumable upload API.

4. File updates: Use the update method of the API to add/remove parents and rename files. 

5. File deletions (simple)
6. Directory deletions (simple)
