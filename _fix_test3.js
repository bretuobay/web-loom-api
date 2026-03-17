const fs = require('fs');
const p = 'packages/api-testing/src/__tests__/property-tests.test.ts';
let lines = fs.readFileSync(p, 'utf8').split('\n');

// Line 352 (0-indexed: 351) has "createdAt: fc.date({"
// Lines 352-355 need to be replaced with a single line
// Find the exact line numbers
const targetLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('fc.date({') && i > 300) {
    targetLines.push(i);
  }
}

console.log('Found fc.date at lines:', targetLines.map(l => l + 1));

// Replace each occurrence (only the one after line 300)
for (const lineIdx of targetLines.reverse()) {
  // Find the closing })
  let endIdx = lineIdx;
  for (let j = lineIdx + 1; j < lineIdx + 5; j++) {
    if (lines[j].trim().startsWith('}')) {
      endIdx = j;
      break;
    }
  }
  console.log('Replacing lines', lineIdx + 1, 'to', endIdx + 1);
  const indent = lines[lineIdx].match(/^(\s*)/)[1];
  const replacement = indent + "createdAt: fc.integer({ min: 0, max: 4102444799999 }).map((t) => new Date(t)),";
  lines.splice(lineIdx, endIdx - lineIdx + 1, replacement);
}

fs.writeFileSync(p, lines.join('\n'));
console.log('FIXED');
