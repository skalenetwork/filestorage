pragma solidity ^0.8.9;
import "../FileStorage.sol";


contract FileStorageTest is FileStorage {
    uint internal maxContentCount = MAX_CONTENT_COUNT;
    uint internal maxChunkSize = MAX_CHUNK_SIZE;

    constructor() public {
        maxContentCount = 2 ** 13;
        maxChunkSize = 2 ** 10;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        version = "1.0.0";
    }

    function reserveSpaceStub(address userAddress, uint reservedSpace) external {
        reservedStorageSpace[userAddress] = reservedSpace;
    }

    function setStorageSpace(uint newStorageSpace) external {
        StorageSlotUpgradeable.getUint256Slot(STORAGE_SPACE_SLOT).value = newStorageSpace;
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

    function getMaxContentCount() public override view returns (uint) {
        return maxContentCount;
    }

    function getMaxChunkSize() public override view returns (uint) {
        return maxChunkSize;
    }
}
