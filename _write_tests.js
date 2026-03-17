const fs = require('fs');
const p = '/home/bretuobay/prjts/web-loom-api/packages/api-testing/src/__tests__/property-tests.test.ts';
const content = `/**
 * Property-based tests for Model Serialization
 *
 * Uses fast-check to verify correctness properties of the model serializer.
 * These tests validate that serialization/deserialization is lossless and
 * that deserialized data passes schema validation.
 */
import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  serialize,
  deserialize,
  validateDeserialized,
  type ModelSchema,
} from '../model-serializer';

/** Safe date generator that never produces NaN dates */
const safeDate = () =>
  fc.integer({ min: 0, max: 4102444799999 }).map((t) => new Date(t));

// ============================================================
// Feature: web-loom-api-framework
// Property 2: Model Serialization Round-Trip
// **Validates: Requirements 46.1, 46.2**
// ============================================================
describe('Property 2: Model Serialization Round-Trip', () => {
  const basicSchema: ModelSchema = {
    fields: {
      name: { type: 'string' },
      age: { type: 'number' },
      active: { type: 'boolean' },
    },
  };

  test('serialize then deserialize preserves string/number/boolean values', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string(),
          age: fc.integer({ min: -1e15, max: 1e15 }),
          active: fc.boolean(),
        }),
        (model) => {
          const json = serialize(model, basicSchema);
          const result = deserialize(json, basicSchema);
          expect(result.name).toBe(model.name);
          expect(result.age).toBe(model.age);
          expect(result.active).toBe(model.active);
        },
      ),
      { numRuns: 100 },
    );
  });
`;
fs.writeFileSync(p, content);
console.log('PART1_WRITTEN');
