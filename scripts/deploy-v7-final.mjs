// Vaultora V7 deploy — uses compiled artifacts + user's private key
import { ethers } from 'ethers';
import fs from 'fs';

const RPC = 'https://rpc.testnet.arc.network';
const PROXY = '0xd4Da13Dcf7A375940b3DE3d0f45783706f5Ec27e';
const EURC_MARKET_IDS = []; // set if you know the EURC market ID

const PRIVATE_KEY = process.env.PK || '';
if (!PRIVATE_KEY) { console.error('Set PK env var'); process.exit(1); }

const ABI = JSON.parse(fs.readFileSync('artifacts/VaultoraPredictionV6.abi', 'utf8'));
const BYTECODE = '0x' + fs.readFileSync('artifacts/VaultoraPredictionV6.bin', 'utf8').trim();

console.log('ABI entries:', ABI.length);
console.log('Bytecode:', BYTECODE.length, 'chars');

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const addr = await wallet.getAddress();
  const balance = await provider.getBalance(addr);
  console.log('Wallet:', addr);
  console.log('Balance:', ethers.formatEther(balance), 'ARC');

  // 1. Deploy implementation
  console.log('\n--- Deploying V7 implementation ---');
  const Factory = new ethers.ContractFactory(ABI, BYTECODE, wallet);
  const gasPrice = (await provider.getFeeData()).gasPrice;
  const impl = await Factory.deploy({ gasPrice });
  await impl.waitForDeployment();
  const implAddr = impl.target;
  console.log('✅ Impl deployed:', implAddr);

  // 2. Upgrade proxy
  console.log('\n--- Upgrading proxy ---');
  const proxy = new ethers.Contract(PROXY, ABI, wallet);
  const owner = await proxy.owner();
  console.log('Proxy owner:', owner);
  if (owner.toLowerCase() !== addr.toLowerCase()) {
    console.error('❌ Deployer is not proxy owner!');
    process.exit(1);
  }
  const upTx = await proxy.upgradeToAndCall(implAddr, '0x', { gasPrice });
  const upRec = await upTx.wait();
  console.log('✅ Proxy upgraded. Tx:', upRec.hash);

  // 3. Set EURC market tokens
  for (const mId of EURC_MARKET_IDS) {
    const tx = await proxy.setMarketTokenIdx(mId, 1, { gasPrice });
    await tx.wait();
    const idx = await proxy.marketTokenIdx(mId);
    console.log(`✅ Market #${mId}: tokenIdx = ${Number(idx)} (1=EURC)`);
  }

  console.log('\n✅ Done!');
  console.log('Impl:', implAddr);
  console.log('ArcScan impl:', `https://testnet.arcscan.app/address/${implAddr}`);
  console.log('ArcScan proxy:', `https://testnet.arcscan.app/address/${PROXY}`);
}

main().catch(e => { console.error(e); process.exit(1); });
