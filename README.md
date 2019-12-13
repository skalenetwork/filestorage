# SKALE Filestorage

[![Build Status](https://travis-ci.com/skalenetwork/filestorage.svg?token=HYnwEPctUzUdXVcsecA6&branch=develop)](https://travis-ci.com/skalenetwork/filestorage)
[![codecov](https://codecov.io/gh/skalenetwork/filestorage/branch/develop/graph/badge.svg?token=2wkF3kZTXh)](https://codecov.io/gh/skalenetwork/filestorage)
[![Discord](https://img.shields.io/discord/534485763354787851.svg)](https://discord.gg/vvUtWJB)

Filestorage - smart contract, that controls decentralized file storage on SKALE chains.

## Description

Filestorage is a cost-effective storage layer within Ethereum capable of handling files up to 100MB. Filestorage uses UNIX-based filesystem of SKALE chains. Filestorage smart contract is a set of functions to interact with files on EVM. This contract may be predeployed on SKALE chains. It contains functions to work with Filestorage precompiled smart contracts. 

Smart contract language - Solidity 0.5.3

## API Reference

### File interaction methods

To begin the uploading process, the file should be broken into chunks of 1MB (&lt; 1MB for the last chunk) which are uploaded as separate transactions to FileStorage.sol. 
The pipeline of the uploading file is:

1.  creating empty file of fixed size on EVM by calling `startUpload`,
2.  uploading data chunk by chunk with `uploadChunk`,
3.  checking the file validity and finishing process with `finishUpload`.

#### startUpload

```solidity
function startUpload(string memory filePath, uint256 fileSize)
```

Creates empty file on EVM with specific name and size. Owner of the file - message sender. 

-   Function is called by file owner
-   Maximum amount of directories and files in one directory is **8196**
-   Maximum filesize is **100,000,000** bytes
-   Owner should have enough free space

**Parameters:**

| Parameter          | Description                           |
| ------------------ | ------------------------------------- |
| `string` filePath  | Path to the file in account directory |
| `uint256` fileSize | Uploaded file size in bytes           |

#### uploadChunk

```solidity
function uploadChunk(string memory filePath, uint position, bytes memory data)
```

Uploads 1MB chunk of data from specific position in specific file by file owner.

-   Function is called by file owner.

**Parameters:**

| Parameter         | Description                           |
| ----------------- | ------------------------------------- |
| `string` filePath | Path to the file in account directory |
| `uint` position   | Uploaded chunk position               |
| `bytes` data      | Uploaded chunk data                   |

#### finishUpload

```solidity
function finishUpload(string memory filePath)
```

Finishes uploading of the file. Checks whether all chunks are uploaded correctly.

-   Function is called by file owner.

**Parameters:**

| Parameter         | Description                           |
| ----------------- | ------------------------------------- |
| `string` filePath | Path to the file in account directory |

#### deleteFile

```solidity
function deleteFile(string memory filePath)
```

Deletes file from Filestorage.

-   Function is called by file owner.

**Parameters:**

| Parameter         | Description                           |
| ----------------- | ------------------------------------- |
| `string` filePath | Path to the file in account directory |

#### readChunk

```solidity
function readChunk(string memory storagePath, uint position, uint length)
        public
        view
        returns (bytes32[MAX_BLOCK_COUNT] memory out)
```

Reads chunk from file from specific position with specific length. Returns `bytes32` array of fixed size with requested data.

-   Maximum length of the chunk to read is 1Mb

**Parameters:**

| Parameter            | Description                          |
| -------------------- | ------------------------------------ |
| `string` storagePath | Full path of the file in Filestorage |
| `uint` position      | First byte to read from              |
| `uint` length        | Uploaded chunk length                |

**Returns:**

| Parameter       | Description                                      |
| --------------- | ------------------------------------------------ |
| `bytes32[]` out | Requested chunk data splitted on `bytes32` array |

#### getFileSize

```solidity
function getFileSize(string memory storagePath) 
        public 
        view 
        returns (uint fileSize)
```

Gets size of the requested file in bytes.

**Parameters:**

| Parameter            | Description                          |
| -------------------- | ------------------------------------ |
| `string` storagePath | Full path of the file in Filestorage |

**Returns:**

| Parameter       | Description            |
| --------------- | ---------------------- |
| `uint` fileSize | Size of requested file |

#### getFileStatus

```solidity
function getFileStatus(string memory storagePath) 
        public 
        view 
        returns (int)
```

Returns status of the requested file:

-   0 - file does not exist
-   1 - file is created but has not finished uploading
-   2 - file is fully uploaded

**Parameters:**

| Parameter            | Description                          |
| -------------------- | ------------------------------------ |
| `string` storagePath | Full path of the file in Filestorage |

**Returns:**

| Parameter         | Description              |
| ----------------- | ------------------------ |
| `uint` fileStatus | Status of requested file |

### Directory interaction methods

Filestorage is represented with UNIX-based filesystem that consisted of files and directories. Directories are stored in `Directory` structure that contains information about its content in `ContentInfo` structure. Maximum amount of content in separate directory is **8196**.

#### createDirectory

```solidity
function createDirectory(string memory directoryPath)
```

Creates directory in Filestorage. Owner of the directory - message sender. 

-   Function is called by directory owner
-   Maximum amount of directories and files in one directory is **8196**

**Parameters:**

| Parameter              | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `string` directoryPath | Path to the directory in account root directory |

#### deleteDirectory

```solidity
function deleteDirectory(string memory directoryPath)
```

Deletes directory from Filestorage.

-   Function is called by directory owner

**Parameters:**

| Parameter              | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `string` directoryPath | Path to the directory in account root directory |

#### listDirectory

```solidity
function listDirectory(string memory storagePath) 
        public 
        view 
        returns (ContentInfo[])
```

List information about content of the specific directory.

**Parameters:**

| Parameter            | Description                               |
| -------------------- | ----------------------------------------- |
| `string` storagePath | Full path of the directory in Filestorage |

**Returns:**

| Parameter       | Description                          |
| --------------- | ------------------------------------ |
| `ContentInfo[]` | Array of content stored in directory |

Object `ContentInfo` can be file or directory and contains:

| Field                    | Description                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| `string` name            | Content name                                                                     |
| `bool` isFile            | Whether content is file                                                          |
| `uint` size              | File size, in bytes                                                              |
| `int` status             | File uploading status                                                            |
| `bool[]` isChunkUploaded | Array with statuses of each chunk (`true` - chunk uploaded, `false` - otherwise) |

## Build

Create an .env file with following data:

```bash
ENTRYPOINT='SKALE endpoint'
PRIVATEKEY='Private key for test account'
```

Compile `FileStorage.sol`:

```bash
truffle compile
```

## Test

Tests run only on SKALE chains. Create an .env file with following data:

```bash
ENTRYPOINT='SKALE endpoint'
SCHAIN_OWNER_PK='Private key of SKALE endpoint owner (or account with money)'
PRIVATEKEY='Private key for test account'
```

Run tests:

```bash
truffle test --network skaled
```
