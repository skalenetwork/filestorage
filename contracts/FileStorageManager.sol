pragma solidity ^0.4.24;

contract FileStorageManager {
    address impl;
    address owner;

    constructor(address _owner){
        owner = _owner;
    }

    function setAddress(address _impl) public {
        require(msg.sender == owner, "Invalid sender");
        impl = _impl;
    }

    function () public {
        require(msg.sig != 0x0);
        address _impl = impl;
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
