# SKALE Filestorage

[![Build Status](https://travis-ci.com/skalenetwork/filestorage.js.svg?branch=develop)](https://travis-ci.com/skalenetwork/filestorage.js)
[![codecov](https://codecov.io/gh/skalenetwork/filestorage/branch/develop/graph/badge.svg?token=2wkF3kZTXh)](https://codecov.io/gh/skalenetwork/filestorage)
[![Discord](https://img.shields.io/discord/534485763354787851.svg)](https://discord.gg/vvUtWJB)

Filestorage - smart contract, that controls decentralized file storage on SKALE chains.

## Description

Filestorage is a cost-effective storage layer within Ethereum capable of handling files up to 100MB. Filestorage uses unix-based filesystem of 
SKALE chains. Smart contract is a set of functions to interact with files on EVM. This contract is predeployed on each SKALE chain. It contains functions to 
work with Filestorage precompiled smart contracts. Smart contract language - Solidity 0.4.24

## API Reference
### File interaction methods

To begin the uploading process, the file should be broken into chunks of 1MB (< 1MB for the last chunk) which are uploaded as separate transactions to FileStorage.sol. 
The pipeline of uploading file is: creating empty file of fixed size on EVM by calling `startUpload`, uploading data chunk by chunk with
`uploadChunk`, checking the file validity and finishing process with `finishUpload`.

#### startUpload

```solidity
function startUpload(string memory filePath, uint256 fileSize)
```
Creates empty file on EVM with specific name and size. Owner of the file - message sender. 
* Function is called by file owner
* Maximum amount of directories and files in one directory is **8196**
* Maximum filesize is **100,000,000** bytes
* Owner should have enough free space

#### uploadChunk

```solidity
function uploadChunk(string memory filePath, uint position, bytes memory data)
```
Uploads 1MB chunk of data from specific position in specific file by file owner.
* Function is called by file owner.

#### finishUpload

```solidity
function finishUpload(string memory filePath)
```
Finishes uploading of the file. Checks whether all chunks are uploaded correctly.
* Function is called by file owner.

#### deleteFile

```solidity
function deleteFile(string memory filePath)
```
Deletes file from Filestorage.
* Function is called by file owner.

#### readChunk

```solidity
function readChunk(string memory storagePath, uint position, uint length)
        public
        view
        returns (bytes32[MAX_BLOCK_COUNT] memory out)
```
Reads chunk from file from specific position with specific length. Returns `bytes32` array of fixed size with requested data.

#### getFileSize

```solidity
function getFileSize(string memory storagePath) 
        public 
        view 
        returns (uint fileSize)
```
Gets size of the requested file in bytes.

#### getFileStatus

```solidity
function getFileStatus(string memory storagePath) 
        public 
        view 
        returns (int)
``` 
Returns status of the requested file:
* 0 - file does not exist
* 1 - file is created but uploading not finished yet
* 2 - file is fully uploaded

### Directory interaction methods

Filestorage is represented with unix-based filesystem that consisted of files and directories. Directories are stored 
in `Directory` structure that contains information about its content in `ContentInfo` structure. Maximum amount of content
in separate directory is **8196**.

#### createDir

```solidity
function createDir(string memory directoryPath)
```
Creates directory in Filestorage. Owner of the directory - message sender. 
* Function is called by directory owner
* Maximum amount of directories and files in one directory is **8196**

#### deleteDir

```solidity
function deleteDir(string memory directoryPath)
```
Deletes directory from Filestorage.
* Function is called by directory owner

#### listDir

```solidity
function listDir(string memory storagePath) 
        public 
        view 
        returns (ContentInfo[])
```
List information about content of the specific directory.
