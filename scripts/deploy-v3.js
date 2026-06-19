// VaultoraPredictionV3 Deploy Script
// Run after compiling in Remix
//
// 1. npx hardhat compile (optional)
// 2. PRIVATE_KEY=0x... node scripts/deploy-v3.js

const { ethers } = require("ethers");

const ARC_RPC = "https://rpc.testnet.arc.network";
const USDC    = "0x3600000000000000000000000000000000000000";
const EURC    = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

// Paste compiled ABI + Bytecode here from Remix compile tab
const ABI = [];
const BYTECODE = "0x";

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error("Set PRIVATE_KEY in .env or export PRIVATE_KEY=0x...");
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider(ARC_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const bal = await provider.getBalance(wallet.address);
  console.log("Deploying from:", wallet.address, "| Balance:", ethers.formatEther(bal), "ARC");

  if (bal < 1000000000000000n) { // 0.001 ARC
    console.error("Insufficient ARC for gas. Get testnet ARC from faucet.");
    process.exit(1);
  }

  const factory = new ethers.ContractFactory(ABI, BYTECODE, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("Deployed at:", addr);

  // Initialize with USDC + EURC
  const tx = await contract.initialize(USDC, EURC);
  await tx.wait();
  console.log("Initialized");
  console.log("Add to src/constants/contracts.js:");
  console.log('export const V3_ADDRESS = "' + addr + '";');
}

main().catch(console.error);
