pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;
import "./FileStorage.sol";

contract FileStorageTest is FileStorage {
    uint constant TEST_BLOCK_COUNT = 2 ** 5;

    constructor() public {
        MAX_STORAGE_SPACE = 10 ** 10;
        MAX_CONTENT_COUNT = 2 ** 13;
        MAX_CHUNK_SIZE = 2 ** 10;
        isInitialized = true;
    }

    function setContentCount(uint maxContentCount) public {
        MAX_CONTENT_COUNT = maxContentCount;
    }

    function setStorageSpace(uint maxStorageSpace) public {
        MAX_STORAGE_SPACE = maxStorageSpace;
    }

    function setChunkSize(uint chunkSize) public {
        MAX_CHUNK_SIZE = chunkSize;
    }

    function getContentCount() public view returns (uint){
        return MAX_CONTENT_COUNT;
    }

    function readChunkTest(string memory storagePath, uint position, uint length)
    public
    view
    returns (bytes32[TEST_BLOCK_COUNT] memory out)
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
}
