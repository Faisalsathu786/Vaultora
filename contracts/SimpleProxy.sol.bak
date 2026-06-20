// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleProxy {
    bytes32 private constant IMPL = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 private constant ADM  = 0xb53127684a568b31717ae13b2f6a76b5a98d14bb8e5224a6cb2c1aba2a4e5b34;

    constructor(address logic, bytes memory data) payable {
        assembly { sstore(IMPL.slot, caller()) sstore(ADM.slot, caller()) sstore(IMPL.slot, logic) }
        if (data.length > 0) {
            (bool success, ) = logic.delegatecall(data);
            require(success, "init failed");
        }
    }

    function upgradeTo(address newImpl) external {
        bytes32 a = ADM;
        address admin;
        assembly { admin := sload(a) }
        require(msg.sender == admin, "!admin");
        bytes32 implSlot = IMPL;
        assembly { sstore(implSlot, newImpl) }
    }

    fallback() external payable {
        bytes32 slot = IMPL;
        address impl;
        assembly { impl := sload(slot) }
        require(impl != address(0), "no impl");
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
