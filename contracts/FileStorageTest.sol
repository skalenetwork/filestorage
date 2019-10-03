pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;
import "./FileStorage.sol";

contract FileStorageTest is FileStorage{
    
    constructor() public {
        MAX_STORAGE_SPACE = 10 ** 10;
    }
}
