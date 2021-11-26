/*
    Utils.sol - SKALE FileStorage
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

import "./thirdparty/strings.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";


library Utils {

    using strings for *;
    using MathUpgradeable for uint;

    uint constant MAX_FILENAME_LENGTH = 255;
    uint constant FILESYSTEM_BLOCK_SIZE = 2 ** 12;
    uint constant DIRECTORY_FS_SIZE = FILESYSTEM_BLOCK_SIZE;

    function checkContentName(string memory contentName) internal pure returns (bool) {
        if (keccak256(abi.encodePacked(contentName)) == keccak256(abi.encodePacked("..")) ||
        keccak256(abi.encodePacked(contentName)) == keccak256(abi.encodePacked(".")) ||
        bytes(contentName).length == 0) {
            return false;
        }
        uint nameLength = bytes(contentName).length;
        if (nameLength > MAX_FILENAME_LENGTH) {
            return false;
        }
        return true;
    }

    function parseDirectoryPath(string memory directoryPath) internal pure returns (string[] memory decreasePart) {
        strings.slice memory pathSlice = directoryPath.toSlice();
        strings.slice memory delimiter = string("/").toSlice();
        string[] memory parts = new string[](pathSlice.count(delimiter) + 1);
        for (uint i = 0; i < parts.length; i++) {
            parts[i] = pathSlice.split(delimiter).toString();
        }
        if (bytes(parts[parts.length - 1]).length == 0) {
            delete parts[parts.length - 1];
            decreasePart = new string[](parts.length - 1);

        } else {
            decreasePart = new string[](parts.length);
        }
        for (uint i = 0; i < decreasePart.length; i++) {
            decreasePart[i] = parts[i];
        }
    }

    function parseStoragePath(string memory storagePath) internal pure returns (address owner, string memory filePath) {
        uint addressLength = 40;
        require(bytes(storagePath).length > addressLength, "Invalid storagePath");
        bytes memory ownerAddress = new bytes(addressLength);
        for (uint i = 0; i < addressLength; i++) {
            ownerAddress[i] = bytes(storagePath)[i];
        }
        uint160 result = 0;
        for (uint i = 0; i < addressLength; i++) {
            uint c = uint160(uint8(ownerAddress[i]));
            require((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 102), "Invalid storagePath");
            if (c >= 48 && c <= 57) {
                result = result * 16 + uint160(c - 48);
            }
            if (c >= 65 && c <= 90) {
                result = result * 16 + uint160(c - 55);
            }
            if (c >= 97 && c <= 102) {
                result = result * 16 + uint160(c - 87);
            }
        }
        owner = address(result);
        require(bytes(storagePath)[addressLength] == "/", "Invalid storagePath");
        uint fileNameLength = bytes(storagePath).length - addressLength - 1;
        filePath = new string(fileNameLength);
        for (uint i = 0; i < fileNameLength; i++) {
            bytes1 char = bytes(storagePath)[i + addressLength + 1];
            bytes(filePath)[i] = char;
        }
    }

    function calculateFilesystemSize(uint size) internal pure returns (uint) {
        return size.ceilDiv(FILESYSTEM_BLOCK_SIZE) * FILESYSTEM_BLOCK_SIZE;
    }
}
