pragma solidity ^0.5.3;

contract FileStorageManager {
    address lastVersionAddress;
    address managerOwner;

    constructor(address _managerOwner) public {
        managerOwner = _managerOwner;
    }

    function setAddress(address _lastVersionAddress) public {
        require(msg.sender == managerOwner, "Invalid sender");
        lastVersionAddress = _lastVersionAddress;
    }

    function () external {
        require(msg.sig != 0x0);
        address _impl = lastVersionAddress;
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize)
            let result := delegatecall(gas, _impl, ptr, calldatasize, ptr, 0)
            let size := returndatasize
            returndatacopy(ptr, 0, size)
            switch result
            case 0 { revert(ptr, size) }
            default { return(ptr, size) }
        }
    }
}