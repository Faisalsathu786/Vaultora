/**
 * retro-track-users.mjs
 *
 * Extracts existing user data from on-chain Bought/Sold/Claimed events,
 * computes per-user stats, and calls retroTrackUsers() on the proxy.
 *
 * Usage:
 *   PRIVATE_KEY=your-admin-key node scripts/retro-track-users.mjs
 *
 * Or with a CSV output (no tx):
 *   node scripts/retro-track-users.mjs --dry-run > users.csv
 */

import { ethers } from "ethers";
import fs from "fs";

const RPC = "https://rpc.testnet.arc.network";
const PROXY_ADDR = "0xfc3E223210Ac97bE51BD75E3C414A5b6F21FeeE2"; // UUPS proxy
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const IS_DRY_RUN = process.argv.includes("--dry-run");

// Minimal ABI for events + retroTrackUsers
const ABI = [
  "event Bought(uint256 indexed marketId, address indexed buyer, uint256 amount, uint256[] tokensReceived)",
  "event Sold(uint256 indexed marketId, address indexed seller, uint256 grossReturn, uint256 tax, uint256 netReturn)",
  "event Claimed(uint256 indexed marketId, address indexed claimant, uint256 amount)",
  "event Resolved(uint256 indexed marketId, uint256 winningOutcome, uint256 resolvedAt)",
  "function retroTrackUsers(address[] calldata users, uint256[] calldata totalVolumes, uint256[] calldata wins, uint256[] calldata losses, uint256[] calldata claims, uint256[] calldata marketCounts) external",
  "function owner() view returns (address)",
  "function getTraderCount() view returns (uint256)",
  "function getUserStats(address user) view returns (uint256 totalVolume, uint256 wins, uint256 losses, uint256 claimed, uint256 marketCount)",
];

const provider = new ethers.JsonRpcProvider(RPC);
const contract = new ethers.Contract(PROXY_ADDR, ABI, provider);

async function main() {
  console.error("Fetching events from proxy:", PROXY_ADDR);

  // --- 1. Get total block range ---
  const latestBlock = await provider.getBlockNumber();
  const deployBlock = 0; // scan from genesis
  const BATCH = 2000;    // batch size for event queries

  // --- 2. Aggregate per-user data ---
  const userMap = new Map(); // address -> { volume, wins, losses, claims, markets: Set }

  function addTrade(user, amount, type) {
    let entry = userMap.get(user);
    if (!entry) {
      entry = { volume: 0n, wins: 0, losses: 0, claims: 0, markets: new Set() };
      userMap.set(user, entry);
    }
    entry.volume += amount;
    if (type === "claim") entry.claims++;
  }

  function recordMarket(user, mktId) {
    let entry = userMap.get(user);
    if (!entry) {
      entry = { volume: 0n, wins: 0, losses: 0, claims: 0, markets: new Set() };
      userMap.set(user, entry);
    }
    entry.markets.add(Number(mktId));
  }

  // Bought events
  console.error("Scanning Bought events...");
  const boughtFilter = contract.getFilter("Bought");
  for (let from = deployBlock; from <= latestBlock; from += BATCH) {
    const to = Math.min(from + BATCH - 1, latestBlock);
    const events = await contract.queryFilter(boughtFilter, from, to);
    for (const e of events) {
      const user = e.args.buyer.toLowerCase();
      addTrade(user, e.args.amount, "buy");
      recordMarket(user, e.args.marketId);
    }
    if (events.length > 0) console.error(`  Blocks ${from}-${to}: ${events.length} Bought events`);
  }

  // Sold events
  console.error("Scanning Sold events...");
  const soldFilter = contract.getFilter("Sold");
  for (let from = deployBlock; from <= latestBlock; from += BATCH) {
    const to = Math.min(from + BATCH - 1, latestBlock);
    const events = await contract.queryFilter(soldFilter, from, to);
    for (const e of events) {
      const user = e.args.seller.toLowerCase();
      addTrade(user, e.args.grossReturn, "sell");
    }
    if (events.length > 0) console.error(`  Blocks ${from}-${to}: ${events.length} Sold events`);
  }

  // Claimed events
  console.error("Scanning Claimed events...");
  const claimedFilter = contract.getFilter("Claimed");
  for (let from = deployBlock; from <= latestBlock; from += BATCH) {
    const to = Math.min(from + BATCH - 1, latestBlock);
    const events = await contract.queryFilter(claimedFilter, from, to);
    for (const e of events) {
      const user = e.args.claimant.toLowerCase();
      addTrade(user, e.args.amount, "claim");
      recordMarket(user, e.args.marketId);
    }
    if (events.length > 0) console.error(`  Blocks ${from}-${to}: ${events.length} Claimed events`);
  }

  // --- 3. Build arrays ---
  const users = [];
  const volumes = [];
  const winsList = [];
  const lossesList = [];
  const claimsList = [];
  const marketCounts = [];

  for (const [addr, data] of userMap) {
    // Get on-chain stats to augment (wins/losses from resolved markets)
    let onChainWins = 0, onChainLosses = 0;
    try {
      const stats = await contract.getUserStats(addr);
      onChainWins = Number(stats.wins);
      onChainLosses = Number(stats.losses);
    } catch {}

    users.push(addr);
    volumes.push(data.volume.toString());
    winsList.push(String(onChainWins + data.claims)); // claim = won market
    lossesList.push(String(onChainLosses + Math.max(0, data.markets.size - data.claims))); // estimate
    claimsList.push(String(data.claims));
    marketCounts.push(String(data.markets.size));
  }

  console.error(`\nFound ${users.length} unique users.`);

  // --- 4. Output ---
  if (IS_DRY_RUN) {
    // CSV format: address,volume,wins,losses,claims,markets
    console.log("address,totalVolume,wins,losses,claims,marketsCount");
    for (let i = 0; i < users.length; i++) {
      console.log(`${users[i]},${volumes[i]},${winsList[i]},${lossesList[i]},${claimsList[i]},${marketCounts[i]}`);
    }
    console.error("\nDry run complete. To execute: remove --dry-run");
    return;
  }

  if (!PRIVATE_KEY) {
    console.error("ERROR: Set PRIVATE_KEY env var to execute transactions.");
    console.error("Or use --dry-run to just view the data.");
    process.exit(1);
  }

  // --- 5. Execute retroTrackUsers ---
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const signerContract = new ethers.Contract(PROXY_ADDR, ABI, signer);

  const owner = await signerContract.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`ERROR: ${signer.address} is not the owner (${owner}). Aborting.`);
    process.exit(1);
  }

  // Split into batches of 50 to avoid gas issues
  const BATCH_SIZE = 50;
  let total = 0;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batchUsers = users.slice(i, i + BATCH_SIZE);
    const batchVolumes = volumes.slice(i, i + BATCH_SIZE);
    const batchWins = winsList.slice(i, i + BATCH_SIZE);
    const batchLosses = lossesList.slice(i, i + BATCH_SIZE);
    const batchClaims = claimsList.slice(i, i + BATCH_SIZE);
    const batchMarkets = marketCounts.slice(i, i + BATCH_SIZE);

    console.error(`\nSubmitting batch ${i / BATCH_SIZE + 1} (${batchUsers.length} users)...`);
    const tx = await signerContract.retroTrackUsers(
      batchUsers, batchVolumes, batchWins, batchLosses, batchClaims, batchMarkets
    );
    await tx.wait();
    total += batchUsers.length;
    console.error(`  Tx ${tx.hash} confirmed. ${total}/${users.length} users tracked.`);
  }

  console.error("\nDone! Verifying...");
  const traderCount = await contract.getTraderCount();
  console.error(`getTraderCount(): ${traderCount.toString()}`);

  // Print stats for first user
  if (users.length > 0) {
    const stats = await contract.getUserStats(users[0]);
    console.error(`First user ${users[0].slice(0, 8)}... totalVolume=${stats.totalVolume} wins=${stats.wins} losses=${stats.losses} claimed=${stats.claimed}`);
  }

  console.error("\nSUCCESS!");
}
main().catch(e => { console.error(e); process.exit(1); });
