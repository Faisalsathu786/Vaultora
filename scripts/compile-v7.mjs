// Compile VaultoraPredictionV6.sol using solc-js
import solc from 'solc';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeModules = path.resolve(__dirname, '../node_modules');
const rootDir = path.resolve(__dirname, '..');

function findImports(importPath) {
  // Resolve from node_modules at root
  const fp = path.resolve(rootDir, 'node_modules', importPath);
  try {
    return { contents: fs.readFileSync(fp, 'utf8') };
  } catch {
    // Try the subdir node_modules
    try {
      const fp2 = path.resolve(nodeModules, importPath);
      return { contents: fs.readFileSync(fp2, 'utf8') };
    } catch {}
    console.error('Import not found:', importPath);
    return { error: `File not found: ${importPath}` };
  }
}

const contractPath = path.resolve(__dirname, '../contracts/VaultoraPredictionV6.sol');
const source = fs.readFileSync(contractPath, 'utf8');

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
      console.error('ERROR:', err.formattedMessage);
      process.exit(1);
    }
    console.warn('WARN:', err.formattedMessage);
  }
}

const name = 'VaultoraPredictionV6';
const contract = output.contracts['VaultoraPredictionV6.sol'][name];

const artifactsDir = path.resolve(__dirname, '../artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });
fs.writeFileSync(path.join(artifactsDir, name + '.abi.json'), JSON.stringify(contract.abi, null, 2));
fs.writeFileSync(path.join(artifactsDir, name + '.bytecode.txt'), '0x' + contract.evm.bytecode.object);

console.log('✅ Compiled!');
console.log('ABI:', contract.abi.length, 'entries');
console.log('Bytecode:', contract.evm.bytecode.object.length, 'hex chars');
