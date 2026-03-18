/**
 * CRUDGenerator stub tests
 *
 * CRUDGenerator has been deprecated in Phase 1 (stack-foundation).
 * The new implementation will be introduced in Phase 3 (crud-generator spec).
 * These tests verify the deprecated stub behaviour only.
 */

import { describe, it, expect } from 'vitest';
import { CRUDGenerator } from '../crud-generator';

describe('CRUDGenerator (deprecated stub)', () => {
  it('throws a deprecation error when generate() is called', () => {
    const generator = new CRUDGenerator();
    expect(() => generator.generate({} as never)).toThrow(
      /deprecated|Phase 3|CRUDGenerator/i
    );
  });
});
