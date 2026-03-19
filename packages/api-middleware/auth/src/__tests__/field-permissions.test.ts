/**
 * field-permissions.ts has been deprecated.
 * Use Zod `.pick()` / `.omit()` on model schemas for field-level filtering.
 *
 * This file is intentionally empty to satisfy the test runner.
 */

import { describe, it } from 'vitest';

describe('field-permissions (deprecated)', () => {
  it('module exports nothing (stub)', async () => {
    const mod = await import('../field-permissions');
    expect(Object.keys(mod)).toHaveLength(0);
  });
});
