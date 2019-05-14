pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

interface Validator{
    function validate(address owner, string fileName) external view returns(bool);
}

contract FileStorage {

    uint constant MAX_CHUNK_SIZE = 2 ** 20;
    uint constant MAX_BLOCK_COUNT = 2 ** 15;
    uint constant MAX_FILENAME_LENGTH = 256;
    uint constant MAX_FILESIZE = 10 ** 8;

    uint constant MAX_STORAGE_SPACE = 10 ** 10;

    int constant STATUS_UNEXISTENT = 0;
    int constant STATUS_UPLOADING = 1;
    int constant STATUS_COMPLETED = 2;

    struct FileInfo {
        string name;
        uint size;
        bool[] isChunkUploaded;
    }

    mapping(address => mapping(string => int)) fileStatus;
    mapping(address => FileInfo[]) fileInfoLists;
    mapping(address => mapping(string => uint)) fileInfoIndex;
    mapping(address => uint) occupiedStorageSpace;

    address validatorAddress;

    function setValidator(address newValidatorAddress) public {
        validatorAddress = newValidatorAddress;
    }

    function startUpload(string memory fileName, uint256 fileSize) public {
        address owner = msg.sender;
        require(fileStatus[owner][fileName] == STATUS_UNEXISTENT, "File already exists");
        require(checkFileName(fileName), "Filename should be <= 256 and not contains '/'");
        require(fileSize <= MAX_FILESIZE, "File should be less than 100 MB");
        require(fileSize + occupiedStorageSpace[owner] <= MAX_STORAGE_SPACE, "Not enough free space in the Filestorage");
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
        require(data.length <= MAX_CHUNK_SIZE, "Chunk is too big");
        require(position % MAX_CHUNK_SIZE == 0, "Incorrect position of chunk");
        uint idx = fileInfoIndex[owner][fileName];
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
        if (validatorAddress != address(0)){
            bool isValid = Validator(validatorAddress).validate(owner, fileName);
            if (!isValid){
                deleteFile(fileName);
                return;
            }
        }
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
        require(fileStatus[owner][fileName] == STATUS_COMPLETED);
        require(length <= MAX_CHUNK_SIZE);
        require(length > 0);

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
        require(success);
    }

    function getFileStatus(string memory storagePath) public view returns (int) {
        address owner;
        string memory fileName;
        (owner, fileName) = parseStoragePath(storagePath);
        return fileStatus[owner][fileName];
    }

    function getFileInfoList(address userAddress) public view returns (FileInfo[] memory) {
        return fileInfoLists[userAddress];
    }

    function getFileSize(string memory storagePath) public view returns (uint fileSize) {
        address owner;
        string memory fileName;
        (owner, fileName) = parseStoragePath(storagePath);
        require(fileStatus[owner][fileName] == STATUS_UPLOADING || fileStatus[owner][fileName] == STATUS_COMPLETED);
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
        require(bytes(storagePath).length > addressLength);
        bytes memory ownerAddress = new bytes(addressLength);
        for (uint i = 0; i < addressLength; i++) {
            ownerAddress[i] = bytes(storagePath)[i];
        }
        uint result = 0;
        for (i = 0; i < addressLength; i++) {
            uint c = uint(ownerAddress[i]);
            require((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 102));
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
        require(bytes(storagePath)[addressLength] == '/');
        uint fileNameLength = bytes(storagePath).length - addressLength - 1;
        fileName = new string(fileNameLength);
        for (i = 0; i < fileNameLength; i++) {
            byte char = bytes(storagePath)[i + addressLength + 1];
            require(char != '/');
            bytes(fileName)[i] = char;
        }
    }

    function checkFileName(string memory fileName) private pure returns (bool) {
        uint fileNameLength = bytes(fileName).length;
        if (fileNameLength == 0 || fileNameLength > MAX_FILENAME_LENGTH) {
            return false;
        }
        for (uint i = 0; i < fileNameLength; i++) {
            byte char = bytes(fileName)[i];
            if (char == '/') {
                return false;
            }
        }
        return true;
    }

    address public SML_CONTRACT_ADDRESS;

    function setSMLAddress() public returns(address) {
        if (SML_CONTRACT_ADDRESS == address(0)) {
            SML_CONTRACT_ADDRESS = msg.sender;
        }
        return SML_CONTRACT_ADDRESS;
    }

    modifier onlySML() {
        require(msg.sender == SML_CONTRACT_ADDRESS);
        _;
    }

    function addSMLOutput(string memory outputFileName) public onlySML {
        fileStatus[msg.sender][outputFileName] = STATUS_COMPLETED;
    }

    function removeSMLOutput(string memory outputFileName) public onlySML {
        address owner = msg.sender;
        require(fileStatus[owner][outputFileName] != STATUS_UNEXISTENT, "File not exists");
        uint blocks = (bytes(outputFileName).length + 31) / 32 + 1;
        bool success;
        assembly {
            let p := mload(0x40)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(outputFileName, mul(32, i))))
            }
            success := call(not(0), 0x0E, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
        require(success, "File not deleted");
        fileStatus[owner][outputFileName] = STATUS_UNEXISTENT;
    }
}
