pragma solidity ^0.5.3;
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

    function getContentCount() public view returns (uint) {
        return MAX_CONTENT_COUNT;
    }
}
