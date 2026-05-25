import { readFileSync, writeFileSync } from 'fs';
const html = readFileSync('dist/index.html', 'utf8');
const fixed = html.replace(/ crossorigin/g, '');
writeFileSync('dist/index.html', fixed);
console.log('Removed crossorigin attributes from HTML');
