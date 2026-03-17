const fs = require('fs');
const p = '/home/bretuobay/prjts/web-loom-api/packages/api-testing/src/__tests__/property-tests.test.ts';
let content = fs.readFileSync(p, 'utf8');

// Simple string replacement approach - replace the exact multi-line pattern
const oldPattern = `fc.date({
            min: new Date('1970-01-01T00:00:00.000Z'),
            max: new Date('2100-12-31T23:59:59.999Z'),
          })`;
const newPattern = `fc.integer({ min: 0, max: 4102444799999 }).map((t) => new Date(t))`;

// Handle both \r\n and \n line endings
const oldPatternCRLF = oldPattern.replace(/\n/g, '\r\n');

let count = 0;
while (content.includes(oldPatternCRLF)) {
  content = content.replace(oldPatternCRLF, newPattern);
  count++;
}
while (content.includes(oldPattern)) {
  content = content.replace(oldPattern, newPattern);
  count++;
}

fs.writeFileSync(p, content);
console.log('Replaced', count, 'occurrences');
