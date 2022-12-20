/*
    FileStorage.sol - SKALE FileStorage
    Copyright (C) 2022-Present SKALE Labs
    @author Vadim Yavorsky

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

pragma solidity 0.8.11;

import "@skalenetwork/ima-interfaces/IMessageReceiver.sol";

interface IImaMock {
    function postOutgoingMessage(
        bytes32 targetChainHash,
        address targetContract,
        bytes memory data
    ) external;
}

contract ImaMock is IImaMock {
    function postOutgoingMessage(
        bytes32 targetChainHash,
        address targetContract,
        bytes memory data
    ) external override {
        IMessageReceiver(targetContract).postMessage(
            targetChainHash,
            msg.sender,
            data
        );
    }
}
