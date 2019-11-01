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
##### startUpload

```solidity
function startUpload(string memory filePath, uint256 fileSize)
```
Creates empty file on EVM with specific name and size. Owner of the file - message sender. 
* Function is called by file owner.

##### uploadChunk

```solidity
function uploadChunk(string memory filePath, uint position, bytes memory data)
```
Uploads 1MB chunk of data from specific position in specific file by file owner.
* Function is called by file owner.

##### finishUpload

```solidity
function finishUpload(string memory filePath)
```
Finishes uploading of the file. Checks whether all chunks are uploaded correctly.
* Function is called by file owner.

##### deleteFile

```solidity
function deleteFile(string memory filePath)
```
Deletes file from Filestorage.
* Function is called by file owner.

##### readChunk

```solidity
function readChunk(string memory storagePath, uint position, uint length)
        public
        view
        returns (bytes32[MAX_BLOCK_COUNT] memory out)
```
Reads chunk from file from specific position with specific length. Returns `bytes32` array of fixed size with requested data.

##### getFileSize

```solidity
function getFileSize(string memory storagePath) 
        public 
        view 
        returns (uint fileSize)
```
Gets size of the requested file in bytes.

##### getFileStatus

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
**createDir**

**deleteDir**
