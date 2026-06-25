// === Vaultora V7 Upgrade — Hardhat deploy script ===
// 1. Compiles VaultoraPredictionV6 (with our V7 fixes)
// 2. Deploys as new implementation
// 3. Upgrades the proxy to point to it
// 4. Sets marketTokenIdx for existing EURC markets
//
// Usage:
//   export PRIVATE_KEY=0x...
//   npx hardhat run scripts/deploy-v7-upgrade.js --network arc
//
// Or add to hardhat.config.js networks section:
//   arc: { url: "https://rpc.testnet.arc.network", chainId: 5042002, accounts: [process.env.PRIVATE_KEY] }

const hre = require("hardhat");

// Current proxy address — frontend V3_ADDRESS
const PROXY_ADDRESS = "0xd4Da13Dcf7A375940b3DE3d0f45783706f5Ec27e";

// EURC market IDs — set marketTokenIdx=1 for these
// CHANGE THIS to the EURC market ID(s) you created
const EURC_MARKET_IDS = [];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1. Deploy new implementation
  console.log("\n--- Deploying VaultoraPredictionV6 (V7 fix) ---");
  const Factory = await hre.ethers.getContractFactory("VaultoraPredictionV6");
  const impl = await Factory.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log("New implementation:", implAddr);

  // 2. Upgrade proxy
  console.log("\n--- Upgrading proxy ---");
  const proxy = await hre.ethers.getContractAt("VaultoraPredictionV6", PROXY_ADDRESS, deployer);
  const upTx = await proxy.upgradeToAndCall(implAddr, "0x");
  await upTx.wait();
  console.log("Proxy upgraded. Tx:", upTx.hash);

  // Verify proxy now points to new impl
  const owner = await proxy.owner();
  console.log("Proxy owner:", owner);
  console.log("Contract at proxy is:", await proxy.getAddress());

  // 3. Set marketTokenIdx for EURC markets
  for (const mId of EURC_MARKET_IDS) {
    const tx = await proxy.setMarketTokenIdx(mId, 1);
    await tx.wait();
    const idx = await proxy.marketTokenIdx(mId);
    console.log(`Market #${mId}: tokenIdx = ${idx} (1=EURC)`);
  }

  console.log("\n✅ Done! Verify on ArcScan:");
  console.log(`  Impl: https://testnet.arcscan.app/address/${implAddr}`);
  console.log(`  Proxy: https://testnet.arcscan.app/address/${PROXY_ADDRESS}`);
}

main().catch(e => { console.error(e); process.exit(1); });
