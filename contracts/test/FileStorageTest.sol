pragma solidity ^0.8.9;
import "../FileStorage.sol";


contract FileStorageTest is FileStorage {
    constructor() public {
        maxContentCount = 2 ** 13;
        maxChunkSize = 2 ** 10;
        isInitialized = true;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function reserveSpaceStub(address userAddress, uint reservedSpace) external {
        reservedStorageSpace[userAddress] = reservedSpace;
    }

    function setStorageSpace(uint storageSpace) external {
        StorageSlotUpgradeable.getUint256Slot(STORAGE_SPACE_SLOT).value = storageSpace;
    }

    function setContentCount(uint contentCount) external {
        maxContentCount = contentCount;
    }

    function setChunkSize(uint chunkSize) external {
        maxChunkSize = chunkSize;
    }

    function getContentCount() external view returns (uint) {
        return maxContentCount;
    }
}
