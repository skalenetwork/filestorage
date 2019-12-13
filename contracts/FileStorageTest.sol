pragma solidity ^0.5.3;
pragma experimental ABIEncoderV2;
import "./FileStorage.sol";


contract FileStorageTest is FileStorage {
    uint constant TEST_BLOCK_COUNT = 2 ** 5;

    constructor() public {
        maxStorageSpace = 10 ** 10;
        maxContentCount = 2 ** 13;
        maxChunkSize = 2 ** 10;
        isInitialized = true;
    }

    function setContentCount(uint contentCount) public {
        maxContentCount = contentCount;
    }

    function setStorageSpace(uint storageSpace) public {
        maxStorageSpace = storageSpace;
    }

    function setChunkSize(uint chunkSize) public {
        maxChunkSize = chunkSize;
    }

    function getContentCount() public view returns (uint) {
        return maxContentCount;
    }
}
