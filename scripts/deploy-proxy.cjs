const { ethers } = require("ethers");
const fs = require("fs");
const solc = require("solc");

const RPC = "https://rpc.testnet.arc.network";
const USDC = "0x3600000000000000000000000000000000000000";
const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const PRIV_KEY = process.env.PRIVATE_KEY;

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(PRIV_KEY, provider);
  
  // 1. Deploy Implementation
  console.log("1. Deploying implementation...");
  const implAbi = JSON.parse(fs.readFileSync("build/impl_abi.json", "utf8"));
  const implBc = "0x" + fs.readFileSync("build/impl_bytecode.txt", "utf8").trim();
  const ImplF = new ethers.ContractFactory(implAbi, implBc, signer);
  const impl = await ImplF.deploy();
  await impl.waitForDeployment();
  console.log("   Implementation:", await impl.getAddress());

  // 2. Compile minimal proxy
  console.log("2. Compiling proxy...");
  const proxySrc = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Proxy {
    bytes32 private constant IMPL_SLOT = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
    bytes32 private constant ADMIN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1);
    
    constructor(address _logic, bytes memory _data) payable {
        assembly { sstore(ADMIN_SLOT, caller()) }
        _upgradeToAndCall(_logic, _data);
    }
    
    function _upgradeToAndCall(address _newImpl, bytes memory _data) internal {
        assembly { sstore(IMPL_SLOT, _newImpl) }
        if (_data.length > 0) {
            (bool ok,) = _newImpl.delegatecall(_data);
            require(ok, "init failed");
        }
    }

    // Admin can upgrade
    function upgradeTo(address _newImpl) external {
        address admin;
        assembly { admin := sload(ADMIN_SLOT) }
        require(msg.sender == admin, "!admin");
        assembly { sstore(IMPL_SLOT, _newImpl) }
    }

    fallback() external payable {
        address impl;
        assembly { impl := sload(IMPL_SLOT) }
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
`;

  const input = {
    language: "Solidity",
    sources: { "Proxy.sol": { content: proxySrc } },
    settings: { outputSelection: { "*": { "*": ["evm.bytecode.object", "abi"] } }, optimizer: { enabled: true, runs: 200 } }
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const proxyData = out.contracts["Proxy.sol"]["Proxy"];
  
  // 3. Deploy Proxy with init data
  console.log("3. Deploying proxy...");
  const initData = new ethers.Interface(["function initialize(address,address)"]).encodeFunctionData("initialize", [USDC, EURC]);
  const proxyBc = "0x" + proxyData.evm.bytecode.object;
  const ProxyF = new ethers.ContractFactory(proxyData.abi, proxyBc, signer);
  const proxy = await ProxyF.deploy(await impl.getAddress(), initData);
  await proxy.waitForDeployment();
  console.log("   Proxy:", await proxy.getAddress());
  
  // 4. Verify proxy works by calling owner()
  console.log("4. Verifying...");
  const proxyContract = new ethers.Contract(await proxy.getAddress(), implAbi, signer);
  const owner = await proxyContract.owner();
  console.log("   Owner:", owner);
  console.log("   Matches signer:", owner.toLowerCase() === signer.address.toLowerCase());
  
  console.log("\n✅ DEPLOY COMPLETE!");
  console.log("Proxy (use this):", await proxy.getAddress());
  console.log("Implementation:", await impl.getAddress());
}
main().catch(e => { console.error(e); process.exit(1); });
