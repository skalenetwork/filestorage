/*
    PrecompiledCaller.sol - SKALE FileStorage
    Copyright (C) 2018-Present SKALE Labs
    @author Dmytro Nazarenko

    FileStorage is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FileStorage is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with FileStorage.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";


library PrecompiledCaller {
    using MathUpgradeable for uint;

    uint constant MAX_BLOCK_COUNT = 2 ** 15;
    uint constant FREE_MEM_PTR = 0x40;
    uint constant READ_CHUNK_ADDRESS = 0x0A;
    uint constant CREATE_FILE_ADDRESS = 0x0B;
    uint constant UPLOAD_CHUNK_ADDRESS = 0x0C;
    uint constant GET_FILE_SIZE_ADDRESS = 0x0D;
    uint constant DELETE_FILE_ADDRESS = 0x0E;
    uint constant CREATE_DIRECTORY_ADDRESS = 0x0F;
    uint constant DELETE_DIRECTORY_ADDRESS = 0x10;
    uint constant CALCULATE_FILE_HASH = 0x11;

    function createDirectory(address owner, string memory directoryPath) internal returns (bool success) {
        uint blocks = bytes(directoryPath).length.ceilDiv(32) + 1;
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

    function deleteDirectory(address owner, string memory directoryPath) internal returns (bool success) {
        uint blocks = bytes(directoryPath).length.ceilDiv(32) + 1;
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

    function startUpload(address owner, string memory filePath, uint256 fileSize) internal returns (bool success) {
        uint blocks = bytes(filePath).length.ceilDiv(32) + 1;
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

    function uploadChunk(
        address owner,
        string memory filePath,
        uint position,
        bytes memory data
    )
        internal
        returns (bool success)
    {
        uint dataBlocks = data.length.ceilDiv(32) + 1;
        uint filePathBlocks = bytes(filePath).length.ceilDiv(32) + 1;
        assembly {
            let p := mload(FREE_MEM_PTR)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, filePathBlocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(filePath, mul(32, i))))
            }
            mstore(add(ptr, mul(32, filePathBlocks)), position)
            for {let i := 0} lt(i, dataBlocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, add(add(1, filePathBlocks), i))), mload(add(data, mul(32, i))))
            }
            success := call(not(0), UPLOAD_CHUNK_ADDRESS, 0, p, add(96, mul(32, add(dataBlocks, filePathBlocks))), p, 32)
        }
    }

    function calculateFileHash(address owner, string memory filePath) internal returns (bool success) {
        uint blocks = bytes(filePath).length.ceilDiv(32) + 1;
        assembly {
            let p := mload(FREE_MEM_PTR)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(filePath, mul(32, i))))
            }
            success := call(not(0), CALCULATE_FILE_HASH, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
    }

    function deleteFile(address owner, string memory filePath) internal returns (bool success) {
        uint blocks = bytes(filePath).length.ceilDiv(32) + 1;
        assembly {
            let p := mload(FREE_MEM_PTR)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(filePath, mul(32, i))))
            }
            success := call(not(0), DELETE_FILE_ADDRESS, 0, p, add(64, mul(blocks, 32)), p, 32)
        }
    }

    function readChunk(
        address owner,
        string memory filePath,
        uint position,
        uint length
    )
        internal
        view
        returns (bool success, bytes32[MAX_BLOCK_COUNT] memory chunk)
    {
        uint filePathBlocks = bytes(filePath).length.ceilDiv(32) + 1;
        uint returnedDataBlocks = length.ceilDiv(32);
        assembly {
            let p := mload(FREE_MEM_PTR)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, filePathBlocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(filePath, mul(32, i))))
            }
            let p_position := add(ptr, mul(32, filePathBlocks))
            mstore(p_position, position)
            mstore(add(32, p_position), length)
            success := staticcall(not(0), READ_CHUNK_ADDRESS, p, mul(32, add(3, filePathBlocks)), chunk, mul(32, returnedDataBlocks))
        }
    }

    function getFileSize(address owner, string memory filePath)
        internal
        view
        returns (bool success, uint fileSize)
    {
        uint blocks = bytes(filePath).length.ceilDiv(32) + 1;
        assembly {
            let p := mload(FREE_MEM_PTR)
            mstore(p, owner)
            let ptr := add(p, 32)
            for {let i := 0} lt(i, blocks) {i := add(1, i)} {
                mstore(add(ptr, mul(32, i)), mload(add(filePath, mul(32, i))))
            }
            success := staticcall(not(0), GET_FILE_SIZE_ADDRESS, p, add(32, mul(blocks, 32)), p, 32)
            fileSize := mload(p)
        }
    }
}
