// === VAULTORA V7 UPGRADE — BROWSER CONSOLE ===
// 1. First compile locally: npx hardhat compile
// 2. Copy artifacts/VaultoraPredictionV6.abi.json + .bytecode.txt to /artifacts/
// 3. Open vaultora app in browser (MetaMask connected)
// 4. Paste this in console (F12)

const EURC_MARKET_IDS = []; // <<< SET YOUR EURC MARKET ID HERE
const PROXY_ADDRESS = "0xd4Da13Dcf7A375940b3DE3d0f45783706f5Ec27e";

(async () => {
  if (!window.ethereum) { console.error("Need MetaMask"); return; }
  const p = new ethers.providers.Web3Provider(window.ethereum);
  const s = p.getSigner();
  const addr = await s.getAddress();
  console.log("Wallet:", addr);

  // Fetch artifacts from GitHub
  const base = "https://raw.githubusercontent.com/Faisalsathu786/Vaultora/main/artifacts";
  let abi, bytecode;
  try {
    abi = await (await fetch(base + "/VaultoraPredictionV6.abi.json")).json();
    bytecode = (await (await fetch(base + "/VaultoraPredictionV6.bytecode.txt")).text()).trim();
    console.log("Artifacts loaded. ABI:", abi.length, "| Bytecode:", bytecode.length, "chars");
  } catch(e) {
    console.error("Failed to fetch artifacts:", e);
    console.log("Compile locally first: npx hardhat compile");
    return;
  }

  // 1. Deploy new implementation
  console.log("\n=== Deploying V7 implementation ===");
  const Factory = new ethers.ContractFactory(abi, bytecode, s);
  const impl = await Factory.deploy();
  await impl.deployed();
  console.log("✅ New impl:", impl.address);

  // 2. Upgrade proxy
  console.log("\n=== Upgrading proxy ===");
  const proxy = new ethers.Contract(PROXY_ADDRESS, abi, s);
  if ((await proxy.owner()).toLowerCase() !== addr.toLowerCase()) {
    console.error("❌ Not proxy owner! Aborting.");
    return;
  }
  const upTx = await proxy.upgradeToAndCall(impl.address, "0x");
  await upTx.wait();
  console.log("✅ Proxy upgraded! Tx:", upTx.hash);

  // 3. Set EURC market tokens
  for (const mId of EURC_MARKET_IDS) {
    const tx = await proxy.setMarketTokenIdx(mId, 1);
    await tx.wait();
    console.log(`✅ Market #${mId}: tokenIdx = 1 (EURC)`);
  }

  console.log("\n✅ All done!");
  console.log("Impl:", impl.address);
  console.log("ArcScan impl: https://testnet.arcscan.app/address/" + impl.address);
  console.log("ArcScan proxy: https://testnet.arcscan.app/address/" + PROXY_ADDRESS);
})();
