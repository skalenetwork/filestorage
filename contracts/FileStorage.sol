/*
    FileStorage.sol - SKALE FileStorage
    Copyright (C) 2018-Present SKALE Labs
    @author Dmytro Nazarenko

    FileStorage is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FileStorage is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with FileStorage.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity ^0.5.3;
pragma experimental ABIEncoderV2;

import "./utils.sol";
import "./precompileds.sol";

contract FileStorage {
    using utils for *;
    using precompileds for *;

    uint internal MAX_STORAGE_SPACE;

    uint constant MAX_BLOCK_COUNT = 2 ** 15;
    uint constant MAX_FILESIZE = 10 ** 8;

    int constant STATUS_UNEXISTENT = 0;
    int constant STATUS_UPLOADING = 1;
    int constant STATUS_COMPLETED = 2;

    uint constant EMPTY_INDEX = 0;

    bool internal isInitialized = false;
    uint internal MAX_CONTENT_COUNT;
    uint internal MAX_CHUNK_SIZE;

    struct ContentInfo {
        string name;
        bool isFile;
        uint size;
        int status;
        bool[] isChunkUploaded;
    }

    struct Directory {
        ContentInfo[] contents;
        mapping(string => uint) contentIndexes;
        mapping(string => Directory) directories;
    }

    mapping(address => uint) occupiedStorageSpace;
    mapping(address => Directory) rootDirectories;

    modifier initializing() {
        if (!isInitialized) {
            MAX_CONTENT_COUNT = 2 ** 13;
            MAX_CHUNK_SIZE = 2 ** 20;
            isInitialized = true;
        }
        _;
    }

    function createDir(string memory directoryPath) public initializing {
        require(bytes(directoryPath).length > 0, "Invalid path");
        address owner = msg.sender;
        string[] memory dirs = utils.parseDirPath(directoryPath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDir.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        require(currentDir.contents.length < MAX_CONTENT_COUNT, "Directory is full");
        string memory newDir = (dirs.length > 1) ? dirs[dirs.length - 1] : directoryPath;
        require(currentDir.contentIndexes[newDir] == EMPTY_INDEX, "File or directory exists");
        require(utils.checkContentName(newDir), "Invalid directory name");
        bool success = precompileds.createDir(owner, directoryPath);
        require(success, "Directory not created");
        ContentInfo memory directoryInfo;
        directoryInfo.name = newDir;
        directoryInfo.isFile = false;
        currentDir.contents.push(directoryInfo);
        currentDir.contentIndexes[newDir] = currentDir.contents.length;
    }

    // TODO: delete dir with all content in it
    function deleteDir(string memory directoryPath) public {
        address owner = msg.sender;
        string[] memory dirs = utils.parseDirPath(directoryPath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDir.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        string memory targetDir = (dirs.length > 1) ? dirs[dirs.length - 1] : directoryPath;
        require(currentDir.contentIndexes[targetDir] > EMPTY_INDEX, "Invalid path");
        require(currentDir.directories[targetDir].contents.length == 0, "Directory is not empty");
        bool success = precompileds.deleteDir(owner, directoryPath);
        require(success, "Directory is not deleted");
        ContentInfo memory lastContent = currentDir.contents[currentDir.contents.length - 1];
        currentDir.contents[currentDir.contentIndexes[targetDir] - 1] = lastContent;
        currentDir.contentIndexes[lastContent.name] = currentDir.contentIndexes[targetDir];
        currentDir.contentIndexes[targetDir] = EMPTY_INDEX;
        currentDir.contents.length--;
        delete currentDir.directories[targetDir];
    }

    function startUpload(string memory filePath, uint256 fileSize) public initializing {
        address owner = msg.sender;
        require(fileSize <= MAX_FILESIZE, "File should be less than 100 MB");
        require(fileSize + occupiedStorageSpace[owner] <= MAX_STORAGE_SPACE, "Not enough free space in the Filestorage");
        string[] memory dirs = utils.parseDirPath(filePath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDir.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        require(currentDir.contents.length < MAX_CONTENT_COUNT, "Directory is full");
        string memory pureFileName = (dirs.length > 1) ?  dirs[dirs.length - 1] : filePath;
        require(currentDir.contentIndexes[pureFileName] == EMPTY_INDEX, "File or directory exists");
        require(utils.checkContentName(pureFileName), "Filename should be < 256");
        bool success = precompileds.startUpload(owner, filePath, fileSize);
        require(success, "File not created");
        bool[] memory isChunkUploaded = new bool[]((fileSize + MAX_CHUNK_SIZE - 1) / MAX_CHUNK_SIZE);
        currentDir.contents.push(ContentInfo({
            name : pureFileName,
            isFile : true,
            size : fileSize,
            status : STATUS_UPLOADING,
            isChunkUploaded : isChunkUploaded
        }));
        currentDir.contentIndexes[pureFileName] = currentDir.contents.length;
        occupiedStorageSpace[owner] += fileSize;
    }

    function uploadChunk(string memory filePath, uint position, bytes memory data) public {
        address owner = msg.sender;
        ContentInfo storage file = getContentInfo(owner, filePath);
        require(file.status == STATUS_UPLOADING, "File not found");
        require(position % MAX_CHUNK_SIZE == 0 && position < file.size, "Incorrect chunk position");
        require(file.size - position < MAX_CHUNK_SIZE &&
                data.length == file.size - position ||
                data.length == MAX_CHUNK_SIZE, "Incorrect chunk length");
        require(file.isChunkUploaded[position / MAX_CHUNK_SIZE] == false, "Chunk is already uploaded");
        bool success = precompileds.uploadChunk(owner, filePath, position, data);
        require(success, "Chunk wasn't uploaded");
        file.isChunkUploaded[position / MAX_CHUNK_SIZE] = true;
    }

    function finishUpload(string memory filePath) public {
        address owner = msg.sender;
        ContentInfo storage file = getContentInfo(owner, filePath);
        require(file.status == STATUS_UPLOADING, "File not found");
        bool isFileUploaded = true;
        uint chunkCount = file.isChunkUploaded.length;
        for (uint i = 0; i < chunkCount; ++i) {
            if (file.isChunkUploaded[i] == false) {
                isFileUploaded = false;
            }
        }
        require(isFileUploaded, "File hasn't been uploaded correctly");
        file.status = STATUS_COMPLETED;
        bool success = precompileds.calculateFileHash(owner, filePath);
        require(success, "Hash hasn't been calculated");
    }

    function deleteFile(string memory filePath) public {
        address owner = msg.sender;
        ContentInfo memory file = getContentInfo(owner, filePath);
        require(file.status != STATUS_UNEXISTENT, "File not exists");
        bool success = precompileds.deleteFile(owner, filePath);
        require(success, "File not deleted");
        string[] memory dirs = utils.parseDirPath(filePath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        uint idx = currentDir.contentIndexes[file.name] - 1;
        ContentInfo memory lastContent = currentDir.contents[currentDir.contents.length - 1];
        currentDir.contents[idx] = lastContent;
        currentDir.contents.length--;
        currentDir.contentIndexes[lastContent.name] = currentDir.contentIndexes[file.name];
        currentDir.contentIndexes[file.name] = EMPTY_INDEX;
        occupiedStorageSpace[owner] -= file.size;
    }

    function readChunk(string memory storagePath, uint position, uint length)
        public
        view
        returns (bytes32[MAX_BLOCK_COUNT] memory out)
    {
        address owner;
        string memory fileName;
        (owner, fileName) = utils.parseStoragePath(storagePath);
        ContentInfo memory file = getContentInfo(owner, fileName);
        require(file.status == STATUS_COMPLETED, "File hasn't been uploaded");
        require(length <= MAX_CHUNK_SIZE && length > 0, "Incorrect chunk length");
        require(position + length <= file.size, "Incorrect chunk position");
        bool success;
        (success, out) = precompileds.readChunk(owner,fileName, position, length);
        require(success, "Chunk wasn't read");
    }

    // TODO: handle root dir
    function listDir(string memory storagePath) public view returns (ContentInfo[] memory){
        address owner;
        string memory path;
        (owner, path) = utils.parseStoragePath(storagePath);
        string[] memory dirs = utils.parseDirPath(path);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 0; i < dirs.length; ++i) {
            require(currentDir.contentIndexes[dirs[i]] > EMPTY_INDEX, "Invalid path");
            currentDir = currentDir.directories[dirs[i]];
        }
        return currentDir.contents;
    }

    function getFileStatus(string memory storagePath) public view returns (int) {
        address owner;
        string memory fileName;
        (owner, fileName) = utils.parseStoragePath(storagePath);
        string[] memory dirs = utils.parseDirPath(fileName);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            if (currentDir.contentIndexes[dirs[i - 1]] == EMPTY_INDEX) {
                return STATUS_UNEXISTENT;
            }
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        string memory contentName = (dirs.length > 1) ? dirs[dirs.length - 1] : fileName;
        if (currentDir.contentIndexes[contentName] == EMPTY_INDEX) {
            return STATUS_UNEXISTENT;
        }
        ContentInfo memory file = currentDir.contents[currentDir.contentIndexes[contentName] - 1];
        return file.status;
    }

    function getFileSize(string memory storagePath) public view returns (uint fileSize) {
        address owner;
        string memory fileName;
        (owner, fileName) = utils.parseStoragePath(storagePath);
        ContentInfo memory file = getContentInfo(owner, fileName);
        require(file.status == STATUS_UPLOADING ||
                file.status == STATUS_COMPLETED, "File not found");
        bool success;
        (success, fileSize) = precompileds.getFileSize(owner, fileName);
        require(success);
    }

    function getStorageSpace() public view returns (uint) {
        return MAX_STORAGE_SPACE;
    }

    function getContentInfo(address owner, string memory contentPath) internal view returns (ContentInfo storage){
        string[] memory dirs = utils.parseDirPath(contentPath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDir.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        string memory contentName = (dirs.length > 1) ? dirs[dirs.length - 1] : contentPath;
        require(currentDir.contentIndexes[contentName] > EMPTY_INDEX, "Invalid path");
        ContentInfo storage result = currentDir.contents[currentDir.contentIndexes[contentName] - 1];
        return result;
    }
}
