const fs = require('fs');
const p = '/home/bretuobay/prjts/web-loom-api/packages/api-testing/src/__tests__/property-tests.test.ts';
let content = fs.readFileSync(p, 'utf8');

// Use regex to match the fc.date pattern regardless of line endings
const pattern = /fc\.date\(\{\s*min:\s*new Date\('1970-01-01T00:00:00\.000Z'\),\s*max:\s*new Date\('2100-12-31T23:59:59\.999Z'\),\s*\}\)/g;

const replacement = "fc.integer({ min: 0, max: 4102444799999 }).map((t) => new Date(t))";

const matches = content.match(pattern);
console.log('Found', matches ? matches.length : 0, 'matches');

content = content.replace(pattern, replacement);

fs.writeFileSync(p, content);
console.log('DONE');
