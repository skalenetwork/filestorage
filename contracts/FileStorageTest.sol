pragma solidity ^0.8.0;
import "./FileStorage.sol";


contract FileStorageTest is FileStorage {
    constructor() public {
        maxStorageSpace = 10 ** 10;
        maxContentCount = 2 ** 13;
        maxChunkSize = 2 ** 10;
        isInitialized = true;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function reserveSpaceStub(address userAddress, uint reservedSpace) public {
        reservedStorageSpace[userAddress] = reservedSpace;
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
