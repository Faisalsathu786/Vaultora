import { ethers } from "ethers";
import fs from "fs";

const RPC = "https://rpc.testnet.arc.network";
const USDC = "0x3600000000000000000000000000000000000000";
const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error("Set PRIVATE_KEY env"); process.exit(1); }

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const bytecode = "0x" + fs.readFileSync("build/bytecode.txt", "utf8").trim();
const abi = JSON.parse(fs.readFileSync("build/abi.json", "utf8"));

const factory = new ethers.ContractFactory(abi, bytecode, signer);
console.log("Deploying VaultoraMarkets to Arc Testnet...");
const c = await factory.deploy(USDC, EURC);
await c.waitForDeployment();
const addr = await c.getAddress();
console.log(`\nNEW CONTRACT: ${addr}`);
