// === VAULTORA V7 UPGRADE SCRIPT ===
// Uses solc (already installed) to compile VaultoraPredictionV6.sol,
// then ethers to deploy + upgrade proxy.
// 
// Usage:
//   export PRIVATE_KEY=0x...
//   export RPC_URL=https://rpc.testnet.arc.network
//   node scripts/deploy-v7.mjs

import solc from 'solc';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EURC_MARKET_IDS = []; // <<-- SET YOUR EURC MARKET ID(s) HERE
const PROXY_ADDRESS = '0xd4Da13Dcf7A375940b3DE3d0f45783706f5Ec27e';

async function compileContract() {
  console.log('--- Compiling VaultoraPredictionV6.sol ---');
  
  const contractPath = path.resolve(__dirname, '../contracts/VaultoraPredictionV6.sol');
  const source = fs.readFileSync(contractPath, 'utf8');

  function findImports(importPath) {
    const nodeModules = path.resolve(__dirname, '../node_modules');
    const fullPath = path.join(nodeModules, importPath);
    try {
      return { contents: fs.readFileSync(fullPath, 'utf8') };
    } catch {
      // Try alternate paths
      const alt = importPath.replace(/^@openzeppelin\//, 'node_modules/@openzeppelin/');
      const altPath = path.resolve(__dirname, '..', alt);
      try {
        return { contents: fs.readFileSync(altPath, 'utf8') };
      } catch {}
      return { error: `File not found: ${importPath}` };
    }
  }

  const input = JSON.stringify({
    language: 'Solidity',
    sources: { 'VaultoraPredictionV6.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  });

  const output = JSON.parse(solc.compile(input, { import: findImports }));
  
  if (output.errors) {
    for (const err of output.errors) {
      if (err.severity === 'error') {
        console.error('Compile error:', err.formattedMessage);
        process.exit(1);
      }
      console.warn('Warning:', err.formattedMessage);
    }
  }

  const contract = output.contracts['VaultoraPredictionV6.sol']['VaultoraPredictionV6'];
  return { abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object };
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) { console.error('Set PRIVATE_KEY env var'); process.exit(1); }

  const rpc = process.env.RPC_URL || 'https://rpc.testnet.arc.network';
  const provider = new ethers.JsonRpcProvider(rpc);
  const deployer = new ethers.Wallet(privateKey, provider);
  const balance = await provider.getBalance(deployer.address);
  console.log('Deployer:', deployer.address, '| Balance:', ethers.formatEther(balance), 'ARC');

  // 1. Compile
  const { abi, bytecode } = await compileContract();
  console.log('ABI methods:', abi.length);

  // 2. Deploy new implementation
  console.log('\n--- Deploying new implementation ---');
  const Factory = new ethers.ContractFactory(abi, bytecode, deployer);
  const impl = await Factory.deploy();
  await impl.waitForDeployment();
  const implAddr = impl.target;
  console.log('New impl deployed:', implAddr);

  // 3. Upgrade proxy
  console.log('\n--- Upgrading proxy at', PROXY_ADDRESS, '---');
  const proxy = new ethers.Contract(PROXY_ADDRESS, abi, deployer);
  const upTx = await proxy.upgradeToAndCall(implAddr, '0x');
  const upRec = await upTx.wait();
  console.log('Proxy upgraded! Tx:', upRec.hash);

  // Verify
  const owner = await proxy.owner();
  console.log('Owner:', owner);
  console.log('Proxy OK:', await proxy.getAddress());

  // 4. Set EURC market tokens
  if (EURC_MARKET_IDS.length > 0) {
    console.log('\n--- Setting marketTokenIdx for EURC markets ---');
    for (const mId of EURC_MARKET_IDS) {
      const tx = await proxy.setMarketTokenIdx(mId, 1);
      await tx.wait();
      const idx = await proxy.marketTokenIdx(mId);
      console.log(`Market #${mId}: tokenIdx = ${Number(idx)}`);
    }
  }

  console.log('\n✅ Done!');
  console.log('New impl:', implAddr);
  console.log('ArcScan impl:', `https://testnet.arcscan.app/address/${implAddr}`);
  console.log('ArcScan proxy:', `https://testnet.arcscan.app/address/${PROXY_ADDRESS}`);
}

main().catch(e => { console.error(e); process.exit(1); });
