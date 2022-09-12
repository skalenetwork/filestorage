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

pragma solidity ^0.8.9;

import "./Utils.sol";
import "./PrecompiledCaller.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StorageSlotUpgradeable.sol";


contract FileStorage is AccessControlEnumerableUpgradeable {

    bytes32 public constant ALLOCATOR_ROLE = keccak256("ALLOCATOR_ROLE");
    bytes32 public constant STORAGE_SPACE_SLOT = keccak256("STORAGE_SPACE_SLOT");

    string public version;

    uint public constant MEGABYTE = 2 ** 20;
    uint public constant MAX_BLOCK_COUNT = 2 ** 15;
    uint public constant EMPTY_INDEX = 0;

    uint internal constant MAX_CONTENT_COUNT = 2 ** 13;

    uint public constant MAX_FILESIZE = 100 * MEGABYTE;
    uint internal constant MAX_CHUNK_SIZE = 1 * MEGABYTE;


    enum FileStatus { NONEXISTENT, UPLOADING, COMPLETED }

    struct ContentInfo {
        string name;
        bool isFile;
        uint size;
        FileStatus status;
        bool[] isChunkUploaded;
    }

    struct DetailedInfo {
        bool isImmutable;
    }

    struct Directory {
        ContentInfo[] contents;
        mapping(string => uint) contentIndexes;
        mapping(string => Directory) directories;
        mapping(string => DetailedInfo) contentDetails;
    }

    mapping(address => uint) reservedStorageSpace;
    mapping(address => uint) occupiedStorageSpace;
    mapping(address => Directory) rootDirectories;
    uint totalReservedSpace = 0;

    function reserveSpace(address userAddress, uint reservedSpace) external {
        require(hasRole(ALLOCATOR_ROLE, msg.sender), "Caller is not allowed to reserve space");
        require(occupiedStorageSpace[userAddress] <= reservedSpace, "Could not reserve less than used space");
        totalReservedSpace -= reservedStorageSpace[userAddress];
        require(totalReservedSpace + reservedSpace <= storageSpace(), "Not enough memory in the Filestorage");
        reservedStorageSpace[userAddress] = reservedSpace;
        totalReservedSpace += reservedSpace;
    }

    function setVersion(string calldata newVersion) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not the admin");
        version = newVersion;
    }

    function createDirectory(string calldata directoryPath) external {
        address owner = msg.sender;
        uint directoryFsSize = Utils.calculateDirectorySize();
        require(directoryFsSize + occupiedStorageSpace[owner] <= reservedStorageSpace[owner], "Not enough reserved space");
        require(bytes(directoryPath).length > 0, "Invalid path");
        string[] memory dirs = Utils.parseDirectoryPath(directoryPath);
        Directory storage currentDirectory = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDirectory.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDirectory = currentDirectory.directories[dirs[i - 1]];
        }
        require(currentDirectory.contents.length < getMaxContentCount(), "Directory is full");
        string memory newDir = (dirs.length > 1) ? dirs[dirs.length - 1] : directoryPath;
        require(currentDirectory.contentIndexes[newDir] == EMPTY_INDEX, "File or directory exists");
        require(Utils.checkContentName(newDir), "Invalid directory name");
        bool success = PrecompiledCaller.createDirectory(owner, directoryPath);
        require(success, "Directory not created");
        ContentInfo memory directoryInfo = ContentInfo({
            name: newDir,
            isFile: false,
            size: 0,
            status: FileStatus.NONEXISTENT,
            isChunkUploaded: new bool[](0)
        });
        currentDirectory.contents.push(directoryInfo);
        currentDirectory.contentIndexes[newDir] = currentDirectory.contents.length;
        occupiedStorageSpace[owner] += directoryFsSize;
    }

    // TODO: delete dir with all content in it
    function deleteDirectory(string calldata directoryPath) external {
        address owner = msg.sender;
        string[] memory dirs = Utils.parseDirectoryPath(directoryPath);
        Directory storage currentDirectory = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDirectory.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDirectory = currentDirectory.directories[dirs[i - 1]];
        }
        string memory targetDirectory = (dirs.length > 1) ? dirs[dirs.length - 1] : directoryPath;
        require(currentDirectory.contentIndexes[targetDirectory] > EMPTY_INDEX, "Invalid path");
        require(currentDirectory.directories[targetDirectory].contents.length == 0, "Directory is not empty");
        require(!currentDirectory.contentDetails[targetDirectory].isImmutable, "Directory is immutable");
        bool success = PrecompiledCaller.deleteDirectory(owner, directoryPath);
        require(success, "Directory is not deleted");
        ContentInfo memory lastContent = currentDirectory.contents[currentDirectory.contents.length - 1];
        currentDirectory.contents[currentDirectory.contentIndexes[targetDirectory] - 1] = lastContent;
        currentDirectory.contentIndexes[lastContent.name] = currentDirectory.contentIndexes[targetDirectory];
        currentDirectory.contentIndexes[targetDirectory] = EMPTY_INDEX;
        currentDirectory.contents.pop();
        // slither-disable-next-line mapping-deletion
        delete currentDirectory.directories[targetDirectory];
        occupiedStorageSpace[owner] -= Utils.calculateDirectorySize();
    }

    function startUpload(string calldata filePath, uint256 fileSize) external {
        address owner = msg.sender;
        uint realFileSize = Utils.calculateFileSize(fileSize);
        require(fileSize <= MAX_FILESIZE, "File should be less than 100 MB");
        require(realFileSize + occupiedStorageSpace[owner] <= reservedStorageSpace[owner], "Not enough reserved space");
        string[] memory dirs = Utils.parseDirectoryPath(filePath);
        Directory storage currentDirectory = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDirectory.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDirectory = currentDirectory.directories[dirs[i - 1]];
        }
        require(currentDirectory.contents.length < getMaxContentCount(), "Directory is full");
        string memory pureFileName = (dirs.length > 1) ?  dirs[dirs.length - 1] : filePath;
        require(currentDirectory.contentIndexes[pureFileName] == EMPTY_INDEX, "File or directory exists");
        require(Utils.checkContentName(pureFileName), "Invalid filename");
        bool success = PrecompiledCaller.startUpload(owner, filePath, fileSize);
        require(success, "File not created");
        bool[] memory isChunkUploaded = new bool[]((fileSize + getMaxChunkSize() - 1) / getMaxChunkSize());
        currentDirectory.contents.push(ContentInfo({
            name : pureFileName,
            isFile : true,
            size : fileSize,
            status : FileStatus.UPLOADING,
            isChunkUploaded : isChunkUploaded
        }));
        currentDirectory.contentIndexes[pureFileName] = currentDirectory.contents.length;
        occupiedStorageSpace[owner] += realFileSize;
    }

    function uploadChunk(string calldata filePath, uint position, bytes calldata data) external {
        address owner = msg.sender;
        (ContentInfo storage file,) = getContentInfo(owner, filePath);
        require(file.status == FileStatus.UPLOADING, "File not found");
        require(position % getMaxChunkSize() == 0 && position < file.size, "Incorrect chunk position");
        require(
            file.size - position < getMaxChunkSize() &&
            data.length == file.size - position ||
            data.length == getMaxChunkSize(), "Incorrect chunk length"
        );
        require(!file.isChunkUploaded[position / getMaxChunkSize()], "Chunk is already uploaded");
        bool success = PrecompiledCaller.uploadChunk(
            owner,
            filePath,
            position,
            data
        );
        require(success, "Chunk wasn't uploaded");
        file.isChunkUploaded[position / getMaxChunkSize()] = true;
    }

    function finishUpload(string calldata filePath) external {
        address owner = msg.sender;
        (ContentInfo storage file,) = getContentInfo(owner, filePath);
        require(file.status == FileStatus.UPLOADING, "File not found");
        bool isFileUploaded = true;
        uint chunkCount = file.isChunkUploaded.length;
        for (uint i = 0; i < chunkCount; ++i) {
            if (!file.isChunkUploaded[i]) {
                isFileUploaded = false;
            }
        }
        require(isFileUploaded, "File hasn't been uploaded correctly");
        file.status = FileStatus.COMPLETED;
        bool success = PrecompiledCaller.calculateFileHash(owner, filePath);
        require(success, "Hash hasn't been calculated");
    }

    function deleteFile(string calldata filePath) external {
        address owner = msg.sender;
        (ContentInfo memory file, DetailedInfo memory details) = getContentInfo(owner, filePath);
        require(file.status != FileStatus.NONEXISTENT, "File not exists");
        require(!details.isImmutable, "File is immutable");
        bool success = PrecompiledCaller.deleteFile(owner, filePath);
        require(success, "File not deleted");
        string[] memory dirs = Utils.parseDirectoryPath(filePath);
        Directory storage currentDirectory = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            currentDirectory = currentDirectory.directories[dirs[i - 1]];
        }
        uint idx = currentDirectory.contentIndexes[file.name] - 1;
        ContentInfo memory lastContent = currentDirectory.contents[currentDirectory.contents.length - 1];
        currentDirectory.contents[idx] = lastContent;
        currentDirectory.contents.pop();
        currentDirectory.contentIndexes[lastContent.name] = currentDirectory.contentIndexes[file.name];
        currentDirectory.contentIndexes[file.name] = EMPTY_INDEX;
        occupiedStorageSpace[owner] -= Utils.calculateFileSize(file.size);
    }

    function setImmutable(string calldata contentPath) external {
        address owner = msg.sender;
        (,DetailedInfo memory content) = getContentInfo(owner, contentPath);
        require(!content.isImmutable, "Content is already immutable");
        content.isImmutable = true;
    }

    function readChunk(string calldata storagePath, uint position, uint length)
        external
        view
        returns (bytes32[MAX_BLOCK_COUNT] memory chunk)
    {
        (address owner, string memory filePath) = Utils.parseStoragePath(storagePath);
        (ContentInfo memory file,) = getContentInfo(owner, filePath);
        require(file.status == FileStatus.COMPLETED, "File hasn't been uploaded");
        require(length <= getMaxChunkSize() && length > 0, "Incorrect chunk length");
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
    function listDirectory(string calldata storagePath) external view returns (ContentInfo[] memory) {
        (address owner, string memory directoryPath) = Utils.parseStoragePath(storagePath);
        string[] memory dirs = Utils.parseDirectoryPath(directoryPath);
        Directory storage currentDirectory = rootDirectories[owner];
        for (uint i = 0; i < dirs.length; ++i) {
            require(currentDirectory.contentIndexes[dirs[i]] > EMPTY_INDEX, "Invalid path");
            currentDirectory = currentDirectory.directories[dirs[i]];
        }
        return currentDirectory.contents;
    }

    function getFileStatus(string calldata storagePath) external view returns (FileStatus) {
        (address owner, string memory filePath) = Utils.parseStoragePath(storagePath);
        string[] memory dirs = Utils.parseDirectoryPath(filePath);
        Directory storage currentDirectory = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            if (currentDirectory.contentIndexes[dirs[i - 1]] == EMPTY_INDEX) {
                return FileStatus.NONEXISTENT;
            }
            currentDirectory = currentDirectory.directories[dirs[i - 1]];
        }
        string memory contentName = (dirs.length > 1) ? dirs[dirs.length - 1] : filePath;
        if (currentDirectory.contentIndexes[contentName] == EMPTY_INDEX) {
            return FileStatus.NONEXISTENT;
        }
        ContentInfo memory file = currentDirectory.contents[currentDirectory.contentIndexes[contentName] - 1];
        return file.status;
    }

    function getFileSize(string calldata storagePath) external view returns (uint fileSize) {
        (address owner, string memory filePath) = Utils.parseStoragePath(storagePath);
        (ContentInfo memory file,) = getContentInfo(owner, filePath);
        require(
            file.status == FileStatus.UPLOADING ||
            file.status == FileStatus.COMPLETED, "File not found"
        );
        bool success;
        (success, fileSize) = PrecompiledCaller.getFileSize(owner, filePath);
        require(success, "EVM error in getFileSize");
    }

    function isImmutable(string calldata storagePath) external view returns (bool) {
        (address owner, string memory contentPath) = Utils.parseStoragePath(storagePath);
        (,DetailedInfo memory content) = getContentInfo(owner, contentPath);
        return content.isImmutable;
    }

    function getTotalStorageSpace() external view returns (uint) {
        return storageSpace();
    }

    function getTotalReservedSpace() external view returns (uint) {
        return totalReservedSpace;
    }

    function getReservedSpace(address owner) external view returns (uint) {
        return reservedStorageSpace[owner];
    }

    function getOccupiedSpace(address owner) external view returns (uint) {
        return occupiedStorageSpace[owner];
    }

    function getMaxContentCount() public virtual view returns (uint) {
        return MAX_CONTENT_COUNT;
    }

    function getMaxChunkSize() public virtual view returns (uint) {
        return MAX_CHUNK_SIZE;
    }

    function getContentInfo(address owner, string memory contentPath) internal view returns (ContentInfo storage, DetailedInfo storage) {
        string[] memory dirs = Utils.parseDirectoryPath(contentPath);
        Directory storage currentDirectory = rootDirectories[owner];
        for (uint i = 1; i < dirs.length; ++i) {
            require(currentDirectory.contentIndexes[dirs[i - 1]] > EMPTY_INDEX, "Invalid path");
            currentDirectory = currentDirectory.directories[dirs[i - 1]];
        }
        string memory contentName = (dirs.length > 1) ? dirs[dirs.length - 1] : contentPath;
        require(currentDirectory.contentIndexes[contentName] > EMPTY_INDEX, "Invalid path");
        ContentInfo storage contentInfo = currentDirectory.contents[currentDirectory.contentIndexes[contentName] - 1];
        DetailedInfo storage detailedInfo = currentDirectory.contentDetails[contentName];
        return (contentInfo, detailedInfo);
    }

    function storageSpace() internal view returns (uint) {
        return StorageSlotUpgradeable.getUint256Slot(STORAGE_SPACE_SLOT).value;
    }
}
