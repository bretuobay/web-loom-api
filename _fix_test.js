const fs = require('fs');
const p = 'packages/api-testing/src/__tests__/property-tests.test.ts';
let c = fs.readFileSync(p, 'utf8');

// Replace all multi-line fc.date({ min, max }) patterns with a safe integer-based date generator
const datePattern = /fc\.date\(\{\s*\n\s*min: new Date\('1970-01-01T00:00:00\.000Z'\),\s*\n\s*max: new Date\('2100-12-31T23:59:59\.999Z'\),\s*\n\s*\}\)/g;
const safeDateGen = "fc.integer({ min: 0, max: 4102444799999 }).map((t) => new Date(t))";

c = c.replace(datePattern, safeDateGen);

// Also replace single-line versions if any
const datePatternSingle = /fc\.date\(\{\s*min: new Date\('1970-01-01T00:00:00\.000Z'\),\s*max: new Date\('2100-12-31T23:59:59\.999Z'\),\s*noInvalidDate: true\s*\}\)/g;
c = c.replace(datePatternSingle, safeDateGen);

fs.writeFileSync(p, c);
console.log('FIXED');
