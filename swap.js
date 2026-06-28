const fs = require('fs');
const content = fs.readFileSync('src/app/page.tsx', 'utf-8');
const lines = content.split('\n');

const groupStart = lines.findIndex(l => l.includes('<Layers className="w-5 h-5 text-indigo-500" /> Group Stage')) - 2;
let groupEnd = lines.findIndex((l, i) => i > groupStart && l.includes('</section>'));

const knockoutStart = lines.findIndex(l => l.includes('{/* Knockout Stage Bracket */}'));
let knockoutEnd = lines.findIndex((l, i) => i > knockoutStart && l.includes('</section>'));

if (groupStart > -1 && groupEnd > -1 && knockoutStart > -1 && knockoutEnd > -1) {
  const groupBlock = lines.slice(groupStart, groupEnd + 1);
  const knockoutBlock = lines.slice(knockoutStart, knockoutEnd + 1);
  
  lines.splice(knockoutStart, knockoutEnd - knockoutStart + 1);
  lines.splice(groupStart, groupEnd - groupStart + 1, ...knockoutBlock, '', ...groupBlock);
  
  fs.writeFileSync('src/app/page.tsx', lines.join('\n'));
  console.log('Swapped successfully!');
} else {
  console.log('Could not find sections');
}
