const fs = require('fs');
const p = 'packages/api-testing/src/__tests__/property-tests.test.ts';
let content = fs.readFileSync(p, 'utf8');
let lines = content.split('\n');

// Find fc.date({ after line 300 (0-indexed)
const targetLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('fc.date({') && i > 300) {
    targetLines.push(i);
  }
}

// Replace each occurrence in reverse order
for (const lineIdx of targetLines.reverse()) {
  // Find the closing }),  - trim \r and whitespace
  let endIdx = lineIdx;
  for (let j = lineIdx + 1; j < lineIdx + 5; j++) {
    const trimmed = lines[j].replace(/\r/g, '').trim();
    if (trimmed.startsWith('}')) {
      endIdx = j;
      break;
    }
  }
  // Get the indentation from the original line
  const indent = lines[lineIdx].replace(/\r/g, '').match(/^(\s*)/)[1];
  // Check if original had \r
  const cr = lines[lineIdx].includes('\r') ? '\r' : '';
  const replacement = indent + 'createdAt: fc.integer({ min: 0, max: 4102444799999 }).map((t) => new Date(t)),' + cr;
  lines.splice(lineIdx, endIdx - lineIdx + 1, replacement);
}

fs.writeFileSync(p, lines.join('\n'));
console.log('FIXED - replaced', targetLines.length, 'occurrences');
