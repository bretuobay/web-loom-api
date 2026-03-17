import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
try {
  const out = execSync('node node_modules/vitest/vitest.mjs run packages/api-jobs/src/__tests__/cron.test.ts', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  writeFileSync('test-result.txt', 'SUCCESS\n' + out);
} catch (e) {
  writeFileSync('test-result.txt', 'FAILED\nSTDOUT: ' + e.stdout + '\nSTDERR: ' + e.stderr + '\nSTATUS: ' + e.status);
}
