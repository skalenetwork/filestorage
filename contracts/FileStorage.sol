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

import "./Utils.sol";
import "./PrecompiledCaller.sol";


contract FileStorage {
    using Utils for *;
    using PrecompiledCaller for *;

    uint internal maxStorageSpace;

    uint constant MAX_BLOCK_COUNT = 2 ** 15;
    uint constant MAX_FILESIZE = 10 ** 8;
    uint constant EMPTY_INDEX = 0;

    bool internal isInitialized;
    uint internal maxContentCount;
    uint internal maxChunkSize;

    enum FileStatus { NONEXISTENT, UPLOADING, COMPLETED }

    struct ContentInfo {
        string name;
        bool isFile;
        uint size;
        FileStatus status;
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
            maxContentCount = 2 ** 13;
            maxChunkSize = 2 ** 20;
            isInitialized = true;
        }
        _;
    }

    function createDirectory(string memory directoryPath) public initializing {
        require(bytes(directoryPath).length > 0, "Invalid path");
        address owner = msg.sender;
        string[] memory dirs = Utils.parseDirPath(directoryPath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDir.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        require(currentDir.contents.length < maxContentCount, "Directory is full");
        string memory newDir = (dirs.length > 1) ? dirs[dirs.length - 1] : directoryPath;
        require(currentDir.contentIndexes[newDir] == EMPTY_INDEX, "File or directory exists");
        require(Utils.checkContentName(newDir), "Invalid directory name");
        bool success = PrecompiledCaller.createDirectory(owner, directoryPath);
        require(success, "Directory not created");
        ContentInfo memory directoryInfo;
        directoryInfo.name = newDir;
        directoryInfo.isFile = false;
        currentDir.contents.push(directoryInfo);
        currentDir.contentIndexes[newDir] = currentDir.contents.length;
    }

    // TODO: delete dir with all content in it
    function deleteDirectory(string memory directoryPath) public {
        address owner = msg.sender;
        string[] memory dirs = Utils.parseDirPath(directoryPath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDir.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        string memory targetDir = (dirs.length > 1) ? dirs[dirs.length - 1] : directoryPath;
        require(currentDir.contentIndexes[targetDir] > EMPTY_INDEX, "Invalid path");
        require(currentDir.directories[targetDir].contents.length == 0, "Directory is not empty");
        bool success = PrecompiledCaller.deleteDirectory(owner, directoryPath);
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
        require(fileSize + occupiedStorageSpace[owner] <= maxStorageSpace, "Not enough free space in the Filestorage");
        string[] memory dirs = Utils.parseDirPath(filePath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDir.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        require(currentDir.contents.length < maxContentCount, "Directory is full");
        string memory pureFileName = (dirs.length > 1) ?  dirs[dirs.length - 1] : filePath;
        require(currentDir.contentIndexes[pureFileName] == EMPTY_INDEX, "File or directory exists");
        require(Utils.checkContentName(pureFileName), "Filename should be < 256");
        bool success = PrecompiledCaller.startUpload(owner, filePath, fileSize);
        require(success, "File not created");
        bool[] memory isChunkUploaded = new bool[]((fileSize + maxChunkSize - 1) / maxChunkSize);
        currentDir.contents.push(ContentInfo({
            name : pureFileName,
            isFile : true,
            size : fileSize,
            status : FileStatus.UPLOADING,
            isChunkUploaded : isChunkUploaded
        }));
        currentDir.contentIndexes[pureFileName] = currentDir.contents.length;
        occupiedStorageSpace[owner] += fileSize;
    }

    function uploadChunk(string memory filePath, uint position, bytes memory data) public {
        address owner = msg.sender;
        ContentInfo storage file = getContentInfo(owner, filePath);
        require(file.status == FileStatus.UPLOADING, "File not found");
        require(position % maxChunkSize == 0 && position < file.size, "Incorrect chunk position");
        require(
            file.size - position < maxChunkSize &&
            data.length == file.size - position ||
            data.length == maxChunkSize, "Incorrect chunk length"
        );
        require(file.isChunkUploaded[position / maxChunkSize] == false, "Chunk is already uploaded");
        bool success = PrecompiledCaller.uploadChunk(
            owner,
            filePath,
            position,
            data
        );
        require(success, "Chunk wasn't uploaded");
        file.isChunkUploaded[position / maxChunkSize] = true;
    }

    function finishUpload(string memory filePath) public {
        address owner = msg.sender;
        ContentInfo storage file = getContentInfo(owner, filePath);
        require(file.status == FileStatus.UPLOADING, "File not found");
        bool isFileUploaded = true;
        uint chunkCount = file.isChunkUploaded.length;
        for (uint i = 0; i < chunkCount; ++i) {
            if (file.isChunkUploaded[i] == false) {
                isFileUploaded = false;
            }
        }
        require(isFileUploaded, "File hasn't been uploaded correctly");
        file.status = FileStatus.COMPLETED;
        bool success = PrecompiledCaller.calculateFileHash(owner, filePath);
        require(success, "Hash hasn't been calculated");
    }

    function deleteFile(string memory filePath) public {
        address owner = msg.sender;
        ContentInfo memory file = getContentInfo(owner, filePath);
        require(file.status != FileStatus.NONEXISTENT, "File not exists");
        bool success = PrecompiledCaller.deleteFile(owner, filePath);
        require(success, "File not deleted");
        string[] memory dirs = Utils.parseDirPath(filePath);
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
        returns (bytes32[MAX_BLOCK_COUNT] memory chunk)
    {
        (address owner, string memory filePath) = Utils.parseStoragePath(storagePath);
        ContentInfo memory file = getContentInfo(owner, filePath);
        require(file.status == FileStatus.COMPLETED, "File hasn't been uploaded");
        require(length <= maxChunkSize && length > 0, "Incorrect chunk length");
        require(position + length <= file.size, "Incorrect chunk position");
        bool success;
        (success, chunk) = PrecompiledCaller.readChunk(
            owner,
            filePath,
            position,
            length
        );
        require(success, "Chunk wasn't read");
    }

    // TODO: handle root dir
    function listDirectory(string memory storagePath) public view returns (ContentInfo[] memory) {
        (address owner, string memory directoryPath) = Utils.parseStoragePath(storagePath);
        string[] memory dirs = Utils.parseDirPath(directoryPath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 0; i < dirs.length; ++i) {
            require(currentDir.contentIndexes[dirs[i]] > EMPTY_INDEX, "Invalid path");
            currentDir = currentDir.directories[dirs[i]];
        }
        return currentDir.contents;
    }

    function getFileStatus(string memory storagePath) public view returns (FileStatus) {
        (address owner, string memory filePath) = Utils.parseStoragePath(storagePath);
        string[] memory dirs = Utils.parseDirPath(filePath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            if (currentDir.contentIndexes[dirs[i - 1]] == EMPTY_INDEX) {
                return FileStatus.NONEXISTENT;
            }
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        string memory contentName = (dirs.length > 1) ? dirs[dirs.length - 1] : filePath;
        if (currentDir.contentIndexes[contentName] == EMPTY_INDEX) {
            return FileStatus.NONEXISTENT;
        }
        ContentInfo memory file = currentDir.contents[currentDir.contentIndexes[contentName] - 1];
        return file.status;
    }

    function getFileSize(string memory storagePath) public view returns (uint fileSize) {
        (address owner, string memory filePath) = Utils.parseStoragePath(storagePath);
        ContentInfo memory file = getContentInfo(owner, filePath);
        require(
            file.status == FileStatus.UPLOADING ||
            file.status == FileStatus.COMPLETED, "File not found"
        );
        bool success;
        (success, fileSize) = PrecompiledCaller.getFileSize(owner, filePath);
        require(success, "EVM error in getFileSize");
    }

    function getStorageSpace() public view returns (uint) {
        return maxStorageSpace;
    }

    function getContentInfo(address owner, string memory contentPath) internal view returns (ContentInfo storage) {
        string[] memory dirs = Utils.parseDirPath(contentPath);
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
