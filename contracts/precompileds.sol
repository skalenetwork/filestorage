pragma solidity ^0.5.3;

library precompileds {

    uint constant FREE_MEM_PTR = 0x40;
    uint constant READ_CHUNK_ADDRESS = 0x0A;
    uint constant CREATE_FILE_ADDRESS = 0x0B;
    uint constant UPLOAD_CHUNK_ADDRESS = 0x0C;
    uint constant GET_FILE_SIZE_ADDRESS = 0x0D;
    uint constant DELETE_FILE_ADDRESS = 0x0E;
    uint constant CREATE_DIRECTORY_ADDRESS = 0x0F;
    uint constant DELETE_DIRECTORY_ADDRESS = 0x10;
    uint constant CALCULATE_FILE_HASH = 0x11;

    function createDir(address owner, string memory directoryPath) internal returns (bool success){
        uint blocks = (bytes(directoryPath).length + 31) / 32 + 1;
        assembly {
            let p := mload(FREE_MEM_PTR)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(directoryPath, mul(32, i))))
            }
            success := call(not(0), CREATE_DIRECTORY_ADDRESS, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
    }

    function deleteDir(address owner, string memory directoryPath) internal returns (bool success){
        uint blocks = (bytes(directoryPath).length + 31) / 32 + 1;
        assembly {
            let p := mload(FREE_MEM_PTR)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(directoryPath, mul(32, i))))
            }
            success := call(not(0), DELETE_DIRECTORY_ADDRESS, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
    }

    function startUpload(address owner, string memory filePath, uint256 fileSize) internal returns (bool success){
        uint blocks = (bytes(filePath).length + 31) / 32 + 1;
        assembly {
            let p := mload(FREE_MEM_PTR)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(filePath, mul(32, i))))
            }
            mstore(add(ptr, mul(blocks, 32)), fileSize)
            success := call(not(0), CREATE_FILE_ADDRESS, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
    }
}
