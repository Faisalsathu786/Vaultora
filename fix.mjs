import fs from 'fs';
const c = fs.readFileSync('src/components/Predict.jsx', 'utf8');
const old = "{PAYMENT_TOKENS?.[tokenIdx]?.name || 'USDC'}";
const repl = "{(()=>{const t=(m.image||'').startsWith('__tok1__')||(m.image||'').startsWith('__img1')?1:0;return t===1?'EURC':'USDC';})()}";
let count = 0;
let result = '';
let idx = 0;
while (true) {
  const pos = c.indexOf(old, idx);
  if (pos === -1) { result += c.slice(idx); break; }
  result += c.slice(idx, pos) + repl;
  idx = pos + old.length;
  count++;
}
fs.writeFileSync('src/components/Predict.jsx', result);
console.log('Fixed', count, 'occurrences');
