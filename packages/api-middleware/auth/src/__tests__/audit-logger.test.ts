/**
 * audit-logger.ts has been deprecated.
 * Implement structured audit logging via Hono middleware and your preferred sink.
 *
 * This file is intentionally empty to satisfy the test runner.
 */

import { describe, it } from 'vitest';

describe('audit-logger (deprecated)', () => {
  it('module exports nothing (stub)', async () => {
    const mod = await import('../audit-logger');
    expect(Object.keys(mod)).toHaveLength(0);
  });
});
