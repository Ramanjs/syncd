# Syncd

A CLI tool to sync your local directory with Google Drive.

## Development

- [ ] SQLite
    - [x] Setup SQLite
    - [x] Define a SQLite schema
    - [x] Research Node libraries for SQLite
    - [ ] Research about aquiring locks and transactions in SQLite

- [ ] Research CLI prettifying libraries

- [ ] Define features and options to support

- [ ] Define and write business logic
    - [x] Define business logic
    - [ ] Implement

- [ ] Research about Node Workers and checksums

- [ ] Explore possibility of using caching: Redis and node-cache

- [ ] Explore Cron jobs and inotifywait for running periodic checks in the directory

- [ ] Research about Webhooks and explore how to use ngrok or other similar tools

- [ ] Checkout log-updates and similar packages for displaying progress bars

## Business logic

All possible operations inside a directory are:
* add (U)
* delete (U)
* modify (U)
* move (C)
* copy (C)
* rename (C)

Diffing a directory efficiently is a tough task. A simple algorithm to detect changes in a directory would be:

1. Fetch a list of all the files and directories from the database into memory (we'll call this list the `deletions` list).
2. Start walking the directory starting from the root.
3. Check if the file or directory inside the current directory exists in the list.
    1. If yes, check whether it has been modified or changed using lstat. Then add all the files that have been modified into a separate `additions` list to track all the new uploads we *might* need to make. For each file that hasn't been modified, remove it from the `deletions` list.
    2. If the file does not exist in the list, simply append it to the `additions` list.
4. Now that we have separate `additions` and `deletions` lists, we can filter out the files that have been moved or renamed. To do this, calculate the checksum of every file in the `additions` list. Check if the checksum exists in the `deletions` list as well.
    1. If yes, then the file has either been moved or renamed. Checks for both these changes are trivial.
    2. Otherwise, the file is indeed a new addition to the repository. A copy operation would simply be considered a new addition to the repository.
5. Handle changes in file metadata by making a separate list of `updates`. We will be populating this list during step 4.1. Remove the files that have same hashes in both `additions` and `deletions` lists and add a single entry to the `updates` list.
6. Finally start syncing all the changes with google drive. Before that we need to write all the pending changes to the database incase of unexpected failure. There is also a possibility of incomplete uploads/interruption/system failure.
    1. To counter this, we could add a new column for each file inside the database. For instance, use `PENDING_ADDITION`, `PENDING_DELETION` and `PENDING_UPDATE` to denate starting state of each file in the 3 lists.
    2. On completion of their repective operations, change the state to `DONE`. While we can use the same tables for pending addition and deletion operations, we need a separate table to store the pending updates to any file or directory (for example, a new table that stores, the previous and new, folder and name of a file).This step allows us to check the state of a database before doing any action and apply pending operations.
