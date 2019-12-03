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


pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./strings.sol";

// TODO: Add constraints
contract FileStorage {
    address lastVersionAddress;
    address managerOwner;

    using strings for *;

    uint constant MAX_BLOCK_COUNT = 2 ** 15;
    uint constant MAX_FILENAME_LENGTH = 255;
    uint constant MAX_FILESIZE = 100 * (2 ** 20);

    int constant STATUS_UNEXISTENT = 0;
    int constant STATUS_UPLOADING = 1;
    int constant STATUS_COMPLETED = 2;

    uint constant EMPTY_INDEX = 0;

    bool internal isInitialized = false;
    uint internal MAX_CONTENT_COUNT;
    uint internal MAX_CHUNK_SIZE;
    uint internal MAX_STORAGE_SPACE;

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

    function createDir(string memory directoryPath) public initializing {
        require(bytes(directoryPath).length > 0, "Invalid path");
        address owner = msg.sender;
        string[] memory dirs = parseDirPath(directoryPath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDir.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        require(currentDir.contents.length < MAX_CONTENT_COUNT, "Directory is full");
        string memory newDir = (dirs.length > 1) ? dirs[dirs.length - 1] : directoryPath;
        require(currentDir.contentIndexes[newDir] == EMPTY_INDEX, "File or directory exists");
        require(checkContentName(newDir), "Invalid directory name");
        uint blocks = (bytes(directoryPath).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(directoryPath, mul(32, i))))
            }
            success := call(not(0), 0x0F, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
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
        string[] memory dirs = parseDirPath(directoryPath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDir.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        string memory targetDir = (dirs.length > 1) ? dirs[dirs.length - 1] : directoryPath;
        require(currentDir.contentIndexes[targetDir] > EMPTY_INDEX, "Invalid path");
        require(currentDir.directories[targetDir].contents.length == 0, "Directory is not empty");
        uint blocks = (bytes(directoryPath).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(directoryPath, mul(32, i))))
            }
            success := call(not(0), 0x10, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
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
        string[] memory dirs = parseDirPath(filePath);
        Directory storage currentDir = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDir.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDir = currentDir.directories[dirs[i - 1]];
        }
        require(currentDir.contents.length < MAX_CONTENT_COUNT, "Directory is full");
        string memory pureFileName = (dirs.length > 1) ?  dirs[dirs.length - 1] : filePath;
        require(currentDir.contentIndexes[pureFileName] == EMPTY_INDEX, "File or directory exists");
        require(checkContentName(pureFileName), "Filename should be < 256");
        uint blocks = (bytes(filePath).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(filePath, mul(32, i))))
            }
            mstore(add(ptr, mul(blocks, 32)), fileSize)
            success := call(not(0), 0x0B, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
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
        uint dataBlocks = (data.length + 31) / 32 + 1;
        uint filePathBlocks = (bytes(filePath).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, filePathBlocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(filePath, mul(32, i))))
            }
            mstore(add(ptr, mul(32, filePathBlocks)), position)
            for {let i := 0} lt(i, dataBlocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, add(add(1, filePathBlocks), i))), mload(add(data, mul(32, i))))
            }
            success := call(not(0), 0x0C, 0, p, add(96, mul(32, add(dataBlocks, filePathBlocks))), p, 32)
        }
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
        uint blocks = (bytes(filePath).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(filePath, mul(32, i))))
            }
            success := call(not(0), 0x11, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
        require(success, "Hash hasn't been calculated");
    }

    function deleteFile(string memory filePath) public {
        address owner = msg.sender;
        ContentInfo memory file = getContentInfo(owner, filePath);
        require(file.status != STATUS_UNEXISTENT, "File not exists");
        uint blocks = (bytes(filePath).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(filePath, mul(32, i))))
            }
            success := call(not(0), 0x0E, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
        require(success, "File not deleted");
        string[] memory dirs = parseDirPath(filePath);
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
        (owner, fileName) = parseStoragePath(storagePath);
        ContentInfo memory file = getContentInfo(owner, fileName);
        require(file.status == STATUS_COMPLETED, "File hasn't been uploaded");
        require(length <= MAX_CHUNK_SIZE && length > 0, "Incorrect chunk length");
        require(position + length <= file.size, "Incorrect chunk position");
        uint fileNameBlocks = (bytes(fileName).length + 31) / 32 + 1;
        uint returnedDataBlocks = (length + 31) / 32;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, fileNameBlocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(fileName, mul(32, i))))
            }
            let p_position := add(ptr, mul(32, fileNameBlocks))
            mstore(p_position, position)
            mstore(add(32, p_position), length)
            success := call(not(0), 0x0A, 0, p, mul(32, add(3, fileNameBlocks)), out, mul(32, returnedDataBlocks))
        }
        require(success, "Chunk wasn't read");
    }

    // TODO: handle root dir
    function listDir(string memory storagePath) public view returns (ContentInfo[]){
        address owner;
        string memory path;
        (owner, path) = parseStoragePath(storagePath);
        string[] memory dirs = parseDirPath(path);
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
        (owner, fileName) = parseStoragePath(storagePath);
        string[] memory dirs = parseDirPath(fileName);
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
        (owner, fileName) = parseStoragePath(storagePath);
        ContentInfo memory file = getContentInfo(owner, fileName);
        require(file.status == STATUS_UPLOADING ||
                file.status == STATUS_COMPLETED, "File not found");
        uint blocks = (bytes(fileName).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(fileName, mul(32, i))))
            }
            success := call(not(0), 0x0D, 0, p, add(32, mul(blocks, 32)), p, 32)
            fileSize := mload(p)
        }
        require(success);
    }

    function getStorageSpace() public view returns (uint) {
        return MAX_STORAGE_SPACE;
    }

    function setStorageSpace() private {
        uint configStorageSpace;
        uint MAX_STORAGE_SPACE_PTR = 0;
        assembly {
            configStorageSpace := sload(MAX_STORAGE_SPACE_PTR)
        }
        MAX_STORAGE_SPACE = configStorageSpace;
    }

    function getContentInfo(address owner, string contentPath) internal view returns (ContentInfo storage){
        string[] memory dirs = parseDirPath(contentPath);
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

    function parseStoragePath(string memory storagePath) internal pure returns (address owner, string memory filePath) {
        uint addressLength = 40;
        require(bytes(storagePath).length > addressLength, "Invalid storagePath");
        bytes memory ownerAddress = new bytes(addressLength);
        for (uint i = 0; i < addressLength; i++) {
            ownerAddress[i] = bytes(storagePath)[i];
        }
        uint result = 0;
        for (i = 0; i < addressLength; i++) {
            uint c = uint(ownerAddress[i]);
            require((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 102), "Invalid storagePath");
            if (c >= 48 && c <= 57) {
                result = result * 16 + (c - 48);
            }
            if (c >= 65 && c <= 90) {
                result = result * 16 + (c - 55);
            }
            if (c >= 97 && c <= 102) {
                result = result * 16 + (c - 87);
            }
        }
        owner = address(result);
        require(bytes(storagePath)[addressLength] == '/', "Invalid storagePath");
        uint fileNameLength = bytes(storagePath).length - addressLength - 1;
        filePath = new string(fileNameLength);
        for (i = 0; i < fileNameLength; i++) {
            byte char = bytes(storagePath)[i + addressLength + 1];
            bytes(filePath)[i] = char;
        }
    }

    function parseDirPath(string memory directoryPath) internal pure returns (string[] memory decreasePart) {
        strings.slice memory pathSlice = directoryPath.toSlice();
        strings.slice memory delimiter = "/".toSlice();
        string[] memory parts = new string[](pathSlice.count(delimiter) + 1);
        for (uint i = 0; i < parts.length; i++) {
            parts[i] = pathSlice.split(delimiter).toString();
        }
        if (bytes(parts[parts.length - 1]).length == 0) {
            delete parts[parts.length - 1];
            decreasePart = new string[](parts.length - 1);

        } else {
            decreasePart = new string[](parts.length);
        }
        for (i = 0; i < decreasePart.length; i++) {
            decreasePart[i] = parts[i];
        }
    }

    function checkContentName(string memory contentName) private pure returns (bool) {
        if (keccak256(abi.encodePacked(contentName)) == keccak256(abi.encodePacked("..")) ||
        keccak256(abi.encodePacked(contentName)) == keccak256(abi.encodePacked(".")) ||
        bytes(contentName).length == 0) {
            return false;
        }
        uint nameLength = bytes(contentName).length;
        if (nameLength > MAX_FILENAME_LENGTH) {
            return false;
        }
        return true;
    }

    modifier initializing() {
        if (!isInitialized) {
            MAX_CONTENT_COUNT = 2 ** 13;
            MAX_CHUNK_SIZE = 2 ** 20;
            uint configStorageSpace;
            uint MAX_STORAGE_SPACE_PTR = 0;
            assembly {
                configStorageSpace := sload(MAX_STORAGE_SPACE_PTR)
            }
            MAX_STORAGE_SPACE = configStorageSpace;
            isInitialized = true;
        }
        _;
    }
}
