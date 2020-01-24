pragma solidity ^0.5.3;
pragma experimental ABIEncoderV2;
import "./FileStorage.sol";


contract FileStorageTest is FileStorage {
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

    function getReservedSpace(address _address) public view returns (uint) {
        return reservedStorageSpace[_address];
    }

    function getTotalReservedSpace() public view returns (uint) {
        return totalReservedSpace;
    }
}
