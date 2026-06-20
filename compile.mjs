import solc from "solc";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const OZ = path.join(process.cwd(), "node_modules", "@openzeppelin");

function resolve(name, content, resolved, seen) {
  resolved[name] = { content };
  seen.add(name);
  const re = /(?:import|from)\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(content))) {
    const imp = m[1];
    const imf = imp.endsWith(".sol") ? imp : imp + ".sol";
    if (seen.has(imf)) continue;
    let abs;
    if (imf.startsWith("./") || imf.startsWith("../")) {
      let parent = name.startsWith("@openzeppelin/")
        ? path.dirname(path.join(OZ, name.slice("@openzeppelin/".length)))
        : process.cwd();
      abs = path.resolve(parent, imf);
    } else if (imf.startsWith("@openzeppelin/")) {
      abs = path.join(OZ, imf.slice("@openzeppelin/".length));
    } else continue;
    if (!fs.existsSync(abs)) continue;
    try {
      resolve(imf, fs.readFileSync(abs, "utf8"), resolved, seen);
    } catch (e) { /* skip */ }
  }
}

async function main() {
  const source = fs.readFileSync("contracts/VaultoraPredictionV4.sol", "utf8");
  const resolved = {};
  const seen = new Set();
  resolve("VaultoraPredictionV4.sol", source, resolved, seen);
  console.log("Resolved", Object.keys(resolved).length, "files");

  const output = JSON.parse(solc.compile(JSON.stringify({
    language: "Solidity",
    sources: resolved,
    settings: {
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    }
  })));

  for (const e of output.errors || []) {
    if (e.severity === "error") { console.error(e.formattedMessage); process.exit(1); }
  }

  for (const [fname, contracts] of Object.entries(output.contracts)) {
    for (const [cname, cdata] of Object.entries(contracts)) {
      const bc = cdata.evm.bytecode.object;
      console.log(`${cname}: ${bc.length / 2} bytes`);
      if (cname === "VaultoraPredictionV4") {
        if (bc.length / 2 > 24576) { console.log("TOO LARGE:", bc.length/2); process.exit(1); }
        fs.writeFileSync("abi_v4.json", JSON.stringify(cdata.abi));
        fs.writeFileSync("bytecode_v4.txt", "0x" + bc);
        console.log("  -> Saved");
      }
      if (cname === "VaultoraOutcomeToken") {
        fs.writeFileSync("ot_bytecode.txt", "0x" + bc);
        fs.writeFileSync("ot_abi.json", JSON.stringify(cdata.abi));
        console.log("  OT saved");
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
