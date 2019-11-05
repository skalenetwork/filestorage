pragma solidity ^0.4.23;

contract DummyMaster {
    // resolver needs to be the first in storage to match the Proxy contract storage ordering
    address impl;
    uint count=0;

    function increment() public {
        count = count + 25;
    }
    
    function get() external view returns (uint) {
        return count;
    }
    
    function getAddress() public view returns (address) {
        return msg.sender;
    } 
}

contract Dummy {
    address impl=0x61b2c4244b531a4fd87140be835be40a02eae38a;

    function setAddress(address _impl) public {
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

//This is simply used to easier create contract calls with web3js/ethersjs
contract DummyInterface {
    function increment() external;
    function get() external view returns (uint);
}
