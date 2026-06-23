import solc from 'solc';
import fs from 'fs';
import path from 'path';

// Read all required source files
function findImports(p) {
  try {
    // Check node_modules for @openzeppelin imports
    const fullPath = path.resolve('node_modules', p);
    if (fs.existsSync(fullPath)) {
      return { contents: fs.readFileSync(fullPath, 'utf8') };
    }
  } catch(e) {}
  return { error: 'File not found: ' + p };
}

const v6Path = path.resolve('contracts/VaultoraPredictionV6.sol');
const v6Source = fs.readFileSync(v6Path, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'contracts/VaultoraPredictionV6.sol': { content: v6Source }
  },
  settings: {
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris", viaIR: true
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

// Check for errors
if (output.errors) {
  for (const err of output.errors) {
    if (err.severity === 'error') {
      console.error('ERROR:', err.formattedMessage);
    } else {
      console.warn('WARN:', err.formattedMessage);
    }
  }
}

const contract = output.contracts['contracts/VaultoraPredictionV6.sol']['VaultoraPredictionV6'];
if (!contract) {
  console.error('Compilation failed - no VaultoraPredictionV6 output');
  process.exit(1);
}

const abi = JSON.stringify(contract.abi);
const bytecode = contract.evm.bytecode.object;

fs.writeFileSync('build/v6_abi.json', abi);
fs.writeFileSync('build/v6_bytecode.txt', bytecode);

console.log('Compiled successfully!');
console.log('ABI:', abi.slice(0, 100) + '...');
console.log('Bytecode length:', bytecode.length, 'chars');
