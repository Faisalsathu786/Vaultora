/**
 * set-dispute-window.mjs
 *
 * Sets dispute window to 0 on the V6 proxy so existing markets
 * can be finalized immediately (no 24h wait).
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/set-dispute-window.mjs
 */

import { ethers } from "ethers";

const RPC = "https://rpc.testnet.arc.network";
const PROXY_ADDR = "0xfc3E223210Ac97bE51BD75E3C414A5b6F21FeeE2";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const ABI = [
  "function updateConfig(uint256 _disputeBondBps, uint256 _disputeWindowDuration, uint256 _minMarketDuration, uint256 _maxMarketDuration) external",
  "function disputeWindowDuration() view returns (uint256)",
  "function owner() view returns (address)",
  "function disputeBondBps() view returns (uint256)",
  "function minMarketDuration() view returns (uint256)",
  "function maxMarketDuration() view returns (uint256)",
];

async function main() {
  if (!PRIVATE_KEY) {
    console.error("ERROR: Set PRIVATE_KEY env var");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(PROXY_ADDR, ABI, signer);

  // Check owner
  const owner = await contract.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`ERROR: ${signer.address} is not the owner (${owner})`);
    process.exit(1);
  }
  console.log("Owner verified:", owner);

  // Read current values
  const bond = await contract.disputeBondBps();
  const window = await contract.disputeWindowDuration();
  const minD = await contract.minMarketDuration();
  const maxD = await contract.maxMarketDuration();
  console.log("\nCurrent config:");
  console.log("  disputeBondBps:", bond.toString());
  console.log("  disputeWindowDuration:", window.toString(), "seconds =", Number(window) / 3600, "hours");
  console.log("  minMarketDuration:", minD.toString());
  console.log("  maxMarketDuration:", maxD.toString());

  // Set dispute window to 0 (instant finalize), keep rest unchanged
  console.log("\nSetting disputeWindowDuration → 0 (instant finalize)...");
  const tx = await contract.updateConfig(bond, 0, minD, maxD);
  console.log("  Tx:", tx.hash);
  await tx.wait();
  console.log("  Confirmed!");

  // Verify
  const newWindow = await contract.disputeWindowDuration();
  console.log("  New disputeWindowDuration:", newWindow.toString(), "seconds");

  console.log("\nDONE! Now go to Admin Panel > Markets and press 'Finalize' — it will work instantly.");
}
main().catch(e => { console.error(e); process.exit(1); });