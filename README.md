# syncd
<p>
  <a href="https://www.npmjs.com/package/syncd" target="_blank">
    <img alt="Version" src="https://img.shields.io/npm/v/@ramanjs/syncd?style=for-the-badge">
  </a>
  <a href="https://www.npmjs.com/package/syncd" target="_blank">
    <img alt="Version" src="https://img.shields.io/npm/dt/%40ramanjs/syncd?style=for-the-badge">
  </a>
  <a href="#" target="_blank">
    <img alt="License: MIT" src="https://img.shields.io/npm/l/@ramanjs/syncd?style=for-the-badge" />
  </a>
  <a href="https://www.npmjs.com/package/syncd" target="_blank">
    <img alt="Version" src="https://img.shields.io/github/languages/top/ramanjs/syncd?style=for-the-badge">
  </a>
</p>

> A CLI tool to backup your local directory to Google Drive
<p align="center">
    <br>
        <img src="https://github.com/Ramanjs/syncd/blob/main/demo.gif?raw=true" width="100%">
    <br>
</p>

* [Installation](#installation)
  * [Prerequisites](#prerequisites)
  * [Installation Steps](#installation-steps)
* [Usage](#usage)
  * [Initializing a Syncd Repository](#initializing-a-syncd-repository)
  * [Scanning the directory for changes](#scanning-the-directory-for-changes)
  * [Uploading Changes to Google Drive](#uploading-changes-to-google-drive)

## Installation
To install the project, follow the steps below:

### Prerequisites

1. Before you begin, make sure you have the following dependencies installed on your system:
    * Node.js (including npm)
    * SQLite
2. Get Google OAuth Credentials to authenticate yourself from the terminal. Follow the 5 steps mentioned in this [Guide](https://developers.google.com/workspace/guides/get-started).

### Installation Steps


Install the project using npm by running the following command:

```bash
npm install -g @ramanjs/syncd
```

This command will install the project globally, making the syncd command available throughout your system.

Verify that syncd is installed correctly:

```bash
syncd --version
```

If you want to learn more about how to use syncd, you can refer to the project's documentation or run the following command to get help:

```bash
syncd --help
```

This command will display the available commands and options for syncd.

Note: If you haven't installed SQLite on your system, make sure to install it and start the server before running any command. The installation steps for SQLite may vary depending on your operating system. You can refer to the [SQLite documentation](https://www.sqlite.org/download.html) for detailed instructions.

## Usage

### Initializing a Syncd Repository

To initialize a syncd repository in your local directory, use the init command. This command sets up an empty folder on Google Drive for your backups and a hidden `.syncd` directory in your project root to store metadata.

```bash
syncd init [options] <path-to-credentials> [path-to-directory]
```

It will ask you to login to your Google account in your browser and grant access to your Drive.


Arguments:

    path-to-credentials    path to your Google Drive credentials file, must be in json format
    path-to-directory      path to the local directory you want to backup (default: ".")

Options:

    -h, --help             display help for command

### Scanning the directory for changes

The status command scans your local directory and identifies any changes that have not been uploaded to Google Drive. It saves all the changes to a local database.

```bash
syncd status
```

### Uploading changes to Google Drive

To upload new files and any changes to Google Drive, use the push command. This command initiates the synchronization process and handles uploading. It also supports resumable uploads for large files.

```bash
syncd push
```

Note: Before using the push command, make sure you have initialized the repository using `syncd init` and checked the status using `syncd status`.
