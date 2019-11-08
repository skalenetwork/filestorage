pragma solidity ^0.4.24;

contract FileStorageManager {
    address lastVersionAddress;
    address managerOwner;

    constructor(address _managerOwner){
        managerOwner = _managerOwner;
    }

    function setAddress(address _lastVersionAddress) public {
        require(msg.sender == getOwnerAddress(), "Invalid sender");
        lastVersionAddress = _lastVersionAddress;
    }

    function () public {
        require(msg.sig != 0x0);
        address _impl = lastVersionAddress;
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize)
            let result := delegatecall(gas, _impl, ptr, calldatasize, ptr, 0)
            let size := returndatasize
            returndatacopy(ptr, 0, size)
            switch result
            case 0 {revert(ptr, size)}
            default {return (ptr, size)}
        }
    }

    function getOwnerAddress() public view returns (address answer){
        address contextAddress = 0xD2001000000000000000000000000000000000D2;
        bytes4 sig = bytes4(sha3("getSchainOwnerAddress()"));
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, sig)
            let result := call(gas, contextAddress, 0, ptr, 0x20, ptr, 0x20)
            if eq(result, 0) {
                revert(0, 0)
            }
            answer := mload(ptr)
            mstore(0x40, add(ptr, 0x20))
        }
    }
}
