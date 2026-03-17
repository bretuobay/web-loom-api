const fs=require('fs');
const p='/home/bretuobay/prjts/web-loom-api/packages/api-testing/src/__tests__/property-tests.test.ts';
const c=fs.readFileSync('/tmp/_gen_content.txt','utf8');
fs.writeFileSync(p,c);
console.log('WRITTEN',c.length,'chars');
