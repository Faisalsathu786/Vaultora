import { ethers } from "ethers";
import fs from "fs";

const RPC = "https://rpc.testnet.arc.network";
const PROXY_ADDR = "0xfc3E223210Ac97bE51BD75E3C414A5b6F21FeeE2";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error("Set PRIVATE_KEY env"); process.exit(1); }

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// Read compiled build artifacts (compile VaultoraPredictionV6.sol in Remix first)
const bytecode = "0x" + fs.readFileSync("build/v6_bytecode.txt", "utf8").trim();
const abi = JSON.parse(fs.readFileSync("build/v6_abi.json", "utf8"));

async function main() {
  console.log("1. Deploying V6 implementation...");
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const impl = await factory.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log("   V6 Implementation:", implAddr);

  console.log("2. Upgrading proxy...");
  const proxy = new ethers.Contract(PROXY_ADDR, [
    "function upgradeToAndCall(address newImpl, bytes calldata data) payable",
    "function owner() view returns (address)"
  ], signer);

  const owner = await proxy.owner();
  console.log("   Proxy owner:", owner);
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error("   NOT the owner! Aborting.");
    process.exit(1);
  }

  const tx = await proxy.upgradeToAndCall(implAddr, "0x");
  console.log("   Upgrade tx:", tx.hash);
  await tx.wait();
  console.log("   Upgraded!");

  console.log("3. Verifying...");
  // Read version via a known view function
  const newContract = new ethers.Contract(PROXY_ADDR, abi, provider);
  try {
    const count = await newContract.marketCount();
    console.log("   marketCount (works!):", count.toString());
    const tc = await newContract.getTraderCount();
    console.log("   getTraderCount:", tc.toString());
  } catch(e) {
    console.error("   Verify failed:", e.message);
  }

  console.log("\nDONE!");
  console.log("Proxy:", PROXY_ADDR);
  console.log("V6 Implementation:", implAddr);
}
main().catch(e => { console.error(e); process.exit(1); });
