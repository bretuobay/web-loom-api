const fs = require('fs');
const p = 'packages/api-testing/src/__tests__/property-tests.test.ts';
let lines = fs.readFileSync(p, 'utf8').split('\n');

// Replace all fc.date({ with min/max }) blocks with safe integer-based date generator
// We need to find the multi-line pattern and replace it
let i = 0;
while (i < lines.length) {
  if (lines[i].includes('fc.date({')) {
    // Check if this is a multi-line date generator
    let endIdx = i;
    for (let j = i; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j].includes('})')) {
        endIdx = j;
        break;
      }
    }
    // Get the indentation
    const indent = lines[i].match(/^\s*/)[0];
    // Replace the multi-line block with a safe generator
    const replacement = indent + "fc.integer({ min: 0, max: 4102444799999 }).map((t) => new Date(t)),";
    lines.splice(i, endIdx - i + 1, replacement);
  }
  i++;
}

fs.writeFileSync(p, lines.join('\n'));
console.log('FIXED');
