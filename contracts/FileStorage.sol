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

    uint constant MAX_CHUNK_SIZE = 2 ** 20;
    uint constant MAX_BLOCK_COUNT = 2 ** 15;
    uint constant MAX_FILENAME_LENGTH = 255;
    uint constant MAX_FILESIZE = 10 ** 8;

    uint constant MAX_STORAGE_SPACE = 10 ** 10;

    int constant STATUS_UNEXISTENT = 0;
    int constant STATUS_UPLOADING = 1;
    int constant STATUS_COMPLETED = 2;

    int constant EMPTY = 0;
    int constant FILE_TYPE = 1;
    int constant DIRECTORY_TYPE = 2;

    struct FileInfo {
        string name;
        uint size;
        bool[] isChunkUploaded;
    }

    mapping(address => mapping(string => int)) fileStatus;
    mapping(address => FileInfo[]) fileInfoLists;
    mapping(address => mapping(string => uint)) fileInfoIndex;
    mapping(address => uint) occupiedStorageSpace;

    struct Directory {
        string[] contentNames;
        mapping(string => int) contentTypes;
        mapping(string => Directory) directories;
    }

    mapping(address => Directory) rootDirectories;
    using strings for *;

    function parseDirPath(string memory path) public pure returns (string[] memory decreasePart) {
        var pathSlice = path.toSlice();
        var delimiter = "/".toSlice();
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

    function createDir(string memory path) public {
        address owner = msg.sender;
        string[] memory dirs = parseDirPath(path);
        Directory currentDir = rootDirectories[owner];
        for (uint i = 0; i < dirs.length - 1; ++i) {
            require(currentDir.contentTypes[dirs[i]] > EMPTY, "Invalid path");
            currentDir = currentDir.directories[dirs[i]];
        }
        string memory newDir = dirs[dirs.length - 1];
        require(currentDir.contentTypes[newDir] == EMPTY, "File or directory exists");
        require(checkFileName(newDir), "Invalid directory name");
        uint blocks = (bytes(path).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(path, mul(32, i))))
            }
            success := call(not(0), 0x0F, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
        require(success, "Directory not created");
        currentDir.contentNames.push(newDir);
        currentDir.contentTypes[newDir] = int(currentDir.contentNames.length);
    }

    // TODO: handle root dir
    // TODO: goToDir
    // TODO: return content types
    function listDir(string memory storagePath) public constant returns (string[]){
        address owner;
        string memory path;
        (owner, path) = parseStoragePath(storagePath);
        string[] memory dirs = parseDirPath(path);
        Directory currentDir = rootDirectories[owner];
        for (uint i = 0; i < dirs.length; ++i) {
            require(currentDir.contentTypes[dirs[i]] > EMPTY, "Invalid path");
            currentDir = currentDir.directories[dirs[i]];
        }
        return currentDir.contentNames;
    }

    function deleteDir(string memory path) public {
        address owner = msg.sender;
        string[] memory dirs = parseDirPath(path);
        Directory currentDir = rootDirectories[owner];
        for (uint i = 0; i < dirs.length - 1; ++i) {
            require(currentDir.contentTypes[dirs[i]] > EMPTY, "Invalid path");
            currentDir = currentDir.directories[dirs[i]];
        }
        string memory targetDir = dirs[dirs.length - 1];
        require(currentDir.contentTypes[targetDir] > EMPTY, "Invalid path");
        require(currentDir.directories[targetDir].contentNames.length == 0, "Directory is not empty");
        uint blocks = (bytes(path).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(path, mul(32, i))))
            }
            success := call(not(0), 0x10, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
        require(success, "Directory is not deleted");
        string memory lastContentName = currentDir.contentNames[currentDir.contentNames.length - 1];
        currentDir.contentNames[uint(currentDir.contentTypes[targetDir])-1] = lastContentName;
        if (currentDir.contentTypes[lastContentName] * currentDir.contentTypes[targetDir] < 0) {
            currentDir.contentTypes[lastContentName] = -currentDir.contentTypes[targetDir];
        } else {
            currentDir.contentTypes[lastContentName] = currentDir.contentTypes[targetDir];
        }
        currentDir.contentTypes[targetDir] = EMPTY;
        currentDir.contentNames.length--;
        delete currentDir.directories[targetDir];
    }

    function startUpload(string memory fileName, uint256 fileSize) public {
        address owner = msg.sender;
        require(fileStatus[owner][fileName] == STATUS_UNEXISTENT, "File already exists");
        require(checkFileName(fileName), "Filename should be < 256");
        require(fileSize <= MAX_FILESIZE, "File should be less than 100 MB");
        require(fileSize + occupiedStorageSpace[owner] <= MAX_STORAGE_SPACE, "Not enough free space in the Filestorage");
        string[] memory dirs = parseDirPath(fileName);
        Directory currentDir = rootDirectories[owner];
        for (uint i = 0; i < dirs.length - 1; ++i) {
            require(currentDir.contentTypes[dirs[i]] > EMPTY, "Invalid path");
            currentDir = currentDir.directories[dirs[i]];
        }
        require(currentDir.contentTypes[fileName] == EMPTY, "File or directory exists");
        uint blocks = (bytes(fileName).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(fileName, mul(32, i))))
            }
            mstore(add(ptr, mul(blocks, 32)), fileSize)
            success := call(not(0), 0x0B, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
        require(success, "File not created");
        string memory pureFileName = dirs[dirs.length-1];
        currentDir.contentNames.push(pureFileName);
        currentDir.contentTypes[pureFileName] = -int(currentDir.contentNames.length);
        bool[] memory isChunkUploaded = new bool[]((fileSize + MAX_CHUNK_SIZE - 1) / MAX_CHUNK_SIZE);
        fileStatus[owner][fileName] = STATUS_UPLOADING;
        fileInfoLists[owner].push(FileInfo({
            name : fileName,
            size : fileSize,
            isChunkUploaded : isChunkUploaded
            }));
        fileInfoIndex[owner][fileName] = fileInfoLists[owner].length - 1;
        occupiedStorageSpace[owner] += fileSize;
    }

    function uploadChunk(string memory fileName, uint position, bytes memory data) public {
        address owner = msg.sender;
        require(fileStatus[owner][fileName] == STATUS_UPLOADING, "File not found");
        uint idx = fileInfoIndex[owner][fileName];
        uint fileSize = fileInfoLists[owner][idx].size;
        require(position % MAX_CHUNK_SIZE == 0 && position < fileSize, "Incorrect chunk position");
        require(fileSize - position < MAX_CHUNK_SIZE &&
                data.length == fileSize - position ||
                data.length == MAX_CHUNK_SIZE, "Incorrect chunk length");
        require(fileInfoLists[owner][idx].isChunkUploaded[position / MAX_CHUNK_SIZE] == false, "Chunk is already uploaded");
        uint dataBlocks = (data.length + 31) / 32 + 1;
        uint fileNameBlocks = (bytes(fileName).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, fileNameBlocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(fileName, mul(32, i))))
            }
            mstore(add(ptr, mul(32, fileNameBlocks)), position)
            for {let i := 0} lt(i, dataBlocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, add(add(1, fileNameBlocks), i))), mload(add(data, mul(32, i))))
            }
            success := call(not(0), 0x0C, 0, p, add(96, mul(32, add(dataBlocks, fileNameBlocks))), p, 32)
        }
        require(success, "Chunk wasn't uploaded");
        fileInfoLists[msg.sender][idx].isChunkUploaded[position / MAX_CHUNK_SIZE] = true;
    }

    function finishUpload(string memory fileName) public {
        address owner = msg.sender;
        require(fileStatus[owner][fileName] == STATUS_UPLOADING, "File not found");
        bool isFileUploaded = true;
        uint idx = fileInfoIndex[msg.sender][fileName];
        uint chunkCount = fileInfoLists[msg.sender][idx].isChunkUploaded.length;
        for (uint i = 0; i < chunkCount; ++i) {
            if (fileInfoLists[msg.sender][idx].isChunkUploaded[i] == false) {
                isFileUploaded = false;
            }
        }
        require(isFileUploaded, "File hasn't been uploaded correctly");
        fileStatus[owner][fileName] = STATUS_COMPLETED;
    }

    function deleteFile(string memory fileName) public {
        address owner = msg.sender;
        require(fileStatus[owner][fileName] != STATUS_UNEXISTENT, "File not exists");
        uint blocks = (bytes(fileName).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(fileName, mul(32, i))))
            }
            success := call(not(0), 0x0E, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
        require(success, "File not deleted");
        string[] memory dirs = parseDirPath(fileName);
        Directory currentDir = rootDirectories[owner];
        for (uint i = 0; i < dirs.length - 1; ++i) {
            currentDir = currentDir.directories[dirs[i]];
        }
        string memory pureFileName = dirs[dirs.length-1];
        string memory lastContentName = currentDir.contentNames[currentDir.contentNames.length - 1];
        uint idx = uint(-(currentDir.contentTypes[pureFileName]))-1;
        currentDir.contentNames[idx] = lastContentName;
        if (currentDir.contentTypes[lastContentName] * currentDir.contentTypes[pureFileName] < 0) {
            currentDir.contentTypes[lastContentName] = -currentDir.contentTypes[pureFileName];
        } else {
            currentDir.contentTypes[lastContentName] = currentDir.contentTypes[pureFileName];
        }
        currentDir.contentTypes[pureFileName] = EMPTY;
        currentDir.contentNames.length--;
        fileStatus[owner][fileName] = STATUS_UNEXISTENT;
        uint deletePosition = fileInfoIndex[owner][fileName];
        occupiedStorageSpace[owner] -= fileInfoLists[owner][deletePosition].size;
        FileInfo memory tempInfo = fileInfoLists[owner][fileInfoLists[owner].length - 1];
        fileInfoLists[owner][deletePosition] = tempInfo;
        fileInfoIndex[owner][tempInfo.name] = deletePosition;
        fileInfoIndex[owner][fileName] = 0;
        fileInfoLists[owner].length--;
    }

    function readChunk(string memory storagePath, uint position, uint length)
        public
        view
        returns (bytes32[MAX_BLOCK_COUNT] memory out)
    {
        address owner;
        string memory fileName;
        (owner, fileName) = parseStoragePath(storagePath);
        uint idx = fileInfoIndex[owner][fileName];
        uint fileSize = fileInfoLists[owner][idx].size;
        require(fileStatus[owner][fileName] == STATUS_COMPLETED, "File hasn't been uploaded");
        require(length <= MAX_CHUNK_SIZE && length > 0, "Incorrect chunk length");
        require(position + length <= fileSize, "Incorrect chunk position");

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

    function getFileStatus(string memory storagePath) public view returns (int) {
        address owner;
        string memory fileName;
        (owner, fileName) = parseStoragePath(storagePath);
        return fileStatus[owner][fileName];
    }

    // TODO: Update for directories
    function getFileInfoList(address userAddress) public view returns (FileInfo[] memory) {
        return fileInfoLists[userAddress];
    }

    function getFileSize(string memory storagePath) public view returns (uint fileSize) {
        address owner;
        string memory fileName;
        (owner, fileName) = parseStoragePath(storagePath);
        require(fileStatus[owner][fileName] == STATUS_UPLOADING ||
                fileStatus[owner][fileName] == STATUS_COMPLETED, "File not found");
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

    function parseStoragePath(string memory storagePath) private pure returns (address owner, string memory fileName) {
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
        fileName = new string(fileNameLength);
        for (i = 0; i < fileNameLength; i++) {
            byte char = bytes(storagePath)[i + addressLength + 1];
            bytes(fileName)[i] = char;
        }
    }

    function checkFileName(string memory name) private pure returns (bool) {
        if (keccak256(abi.encodePacked(name)) == keccak256(abi.encodePacked("..")) ||
            keccak256(abi.encodePacked(name)) == keccak256(abi.encodePacked(".")) ||
            bytes(name).length == 0) {
            return false;
        }
        uint nameLength = bytes(name).length;
        if (nameLength > MAX_FILENAME_LENGTH) {
            return false;
        }
        return true;
    }
}
