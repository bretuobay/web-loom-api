const fs = require('fs');
const p = 'packages/api-testing/src/__tests__/property-tests.test.ts';
let content = fs.readFileSync(p, 'utf8');
let lines = content.split('\n');

// Find ALL fc.date({ occurrences and replace them
const targetLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('fc.date({')) {
    targetLines.push(i);
  }
}

console.log('Found fc.date at lines:', targetLines.map(l => l + 1));

// Replace each occurrence in reverse order to preserve line numbers
for (const lineIdx of targetLines.reverse()) {
  // Find the closing }),  - trim \r and whitespace
  let endIdx = lineIdx;
  for (let j = lineIdx + 1; j < lineIdx + 6; j++) {
    const trimmed = lines[j].replace(/\r/g, '').trim();
    if (trimmed === '}),' || trimmed === '})') {
      endIdx = j;
      break;
    }
  }
  console.log('Replacing lines', lineIdx + 1, 'to', endIdx + 1);
  // Get the indentation from the original line
  const origLine = lines[lineIdx].replace(/\r/g, '');
  const indent = origLine.match(/^(\s*)/)[1];
  // Extract the field name (e.g., "createdAt: ")
  const fieldMatch = origLine.match(/(\w+:\s*)/);
  const fieldPrefix = fieldMatch ? fieldMatch[1] : '';
  // Check if original had \r
  const cr = lines[lineIdx].includes('\r') ? '\r' : '';
  const replacement = indent + fieldPrefix + 'fc.integer({ min: 0, max: 4102444799999 }).map((t) => new Date(t)),' + cr;
  lines.splice(lineIdx, endIdx - lineIdx + 1, replacement);
}

fs.writeFileSync(p, lines.join('\n'));
console.log('FIXED -', targetLines.length, 'occurrences replaced');
