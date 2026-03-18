/**
 * security-headers.ts has been deprecated. Use Hono's built-in `secureHeaders()`
 * from `hono/secure-headers` instead.
 *
 * This file is intentionally empty to satisfy the test runner.
 */

import { describe, it } from 'vitest';

describe('security-headers (deprecated)', () => {
  it('module exports nothing (stub)', async () => {
    const mod = await import('../security-headers');
    // The deprecated module exports only `{}` — nothing callable
    expect(Object.keys(mod)).toHaveLength(0);
  });
});
