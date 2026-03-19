import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  serialize,
  deserialize,
  validateDeserialized,
  ValidationError,
  type ModelSchema,
  type FieldDef,
} from '../model-serializer';

/**
 * Property-Based Tests for Model Serialization
 *
 * Uses fast-check to verify serialization invariants across
 * randomly generated model instances and schemas.
 */

// --- Helpers ---

function makeSchema(fields: Record<string, FieldDef>): ModelSchema {
  return { fields };
}

// --- Property 2: Model Serialization Round-Trip ---
// **Validates: Requirements 46.1, 46.2**

describe('Property 2: Model Serialization Round-Trip', () => {
  it('string fields survive round-trip', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const schema = makeSchema({ field: { type: 'string' } });
        const model = { field: value };
        const result = deserialize(serialize(model, schema), schema);
        expect(result.field).toBe(value);
      }),
      { numRuns: 100 }
    );
  });

  it('number fields survive round-trip', () => {
    // Exclude -0 since JSON.stringify(-0) === "0" (known JS behavior)
    const safeDouble = fc
      .double({ noNaN: true, noDefaultInfinity: true })
      .filter((n) => !Object.is(n, -0));
    fc.assert(
      fc.property(safeDouble, (value) => {
        const schema = makeSchema({ field: { type: 'number' } });
        const model = { field: value };
        const result = deserialize(serialize(model, schema), schema);
        expect(result.field).toBe(value);
      }),
      { numRuns: 100 }
    );
  });

  it('boolean fields survive round-trip', () => {
    fc.assert(
      fc.property(fc.boolean(), (value) => {
        const schema = makeSchema({ field: { type: 'boolean' } });
        const model = { field: value };
        const result = deserialize(serialize(model, schema), schema);
        expect(result.field).toBe(value);
      }),
      { numRuns: 100 }
    );
  });

  it('multi-field models survive round-trip', () => {
    // Exclude -0 since JSON.stringify(-0) === "0" (known JS behavior)
    const safeDouble = fc
      .double({ noNaN: true, noDefaultInfinity: true })
      .filter((n) => !Object.is(n, -0));
    fc.assert(
      fc.property(fc.string(), safeDouble, fc.boolean(), (s, n, b) => {
        const schema = makeSchema({
          name: { type: 'string' },
          age: { type: 'number' },
          active: { type: 'boolean' },
        });
        const model = { name: s, age: n, active: b };
        const result = deserialize(serialize(model, schema), schema);
        expect(result).toEqual(model);
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 3: Special Type Round-Trip Handling ---
// **Validates: Requirements 46.4**

describe('Property 3: Special Type Round-Trip Handling', () => {
  it('Date values round-trip correctly (same timestamp)', () => {
    fc.assert(
      fc.property(
        fc
          .date({ min: new Date('1970-01-01'), max: new Date('2100-01-01') })
          .filter((d) => !isNaN(d.getTime())),
        (value) => {
          const schema = makeSchema({ field: { type: 'date' } });
          const model = { field: value };
          const result = deserialize(serialize(model, schema), schema);
          expect(result.field).toBeInstanceOf(Date);
          expect((result.field as Date).getTime()).toBe(value.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('BigInt values round-trip correctly (same value)', () => {
    fc.assert(
      fc.property(fc.bigInt(), (value) => {
        const schema = makeSchema({ field: { type: 'bigint' } });
        const model = { field: value };
        const result = deserialize(serialize(model, schema), schema);
        expect(result.field).toBe(value);
      }),
      { numRuns: 100 }
    );
  });

  it('Buffer values round-trip correctly (same bytes)', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 256 }), (bytes) => {
        const value = Buffer.from(bytes);
        const schema = makeSchema({ field: { type: 'buffer' } });
        const model = { field: value };
        const result = deserialize(serialize(model, schema), schema);
        expect(Buffer.isBuffer(result.field)).toBe(true);
        expect(Buffer.compare(result.field as Buffer, value)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('mixed special types in one model round-trip correctly', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1970-01-01'), max: new Date('2100-01-01') }),
        fc.bigInt(),
        fc.uint8Array({ minLength: 0, maxLength: 64 }),
        (d, bi, bytes) => {
          const buf = Buffer.from(bytes);
          const schema = makeSchema({
            created: { type: 'date' },
            id: { type: 'bigint' },
            data: { type: 'buffer' },
          });
          const model = { created: d, id: bi, data: buf };
          const result = deserialize(serialize(model, schema), schema);
          expect((result.created as Date).getTime()).toBe(d.getTime());
          expect(result.id).toBe(bi);
          expect(Buffer.compare(result.data as Buffer, buf)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 22: Deserialized Data Validation ---
// **Validates: Requirements 46.3**

describe('Property 22: Deserialized Data Validation', () => {
  it('missing required fields cause ValidationError on deserialize', () => {
    const schema = makeSchema({
      name: { type: 'string', required: true },
      email: { type: 'string', required: true },
    });

    fc.assert(
      fc.property(fc.string(), (name) => {
        // Only provide one of two required fields
        const json = JSON.stringify({ name });
        expect(() => deserialize(json, schema)).toThrow(ValidationError);
      }),
      { numRuns: 50 }
    );
  });

  it('wrong types cause ValidationError on deserialize', () => {
    const schema = makeSchema({
      count: { type: 'number', required: true },
    });

    fc.assert(
      fc.property(fc.string(), (value) => {
        // Provide a string where a number is expected
        const json = JSON.stringify({ count: value });
        expect(() => deserialize(json, schema)).toThrow(ValidationError);
      }),
      { numRuns: 50 }
    );
  });

  it('validateDeserialized rejects objects missing required fields', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (fieldName, otherField) => {
        // Ensure distinct field names
        const reqField = 'required_' + fieldName.slice(0, 10);
        const schema = makeSchema({
          [reqField]: { type: 'string', required: true },
        });
        // Provide an object without the required field
        const data: Record<string, unknown> = {};
        if (otherField !== reqField) {
          data[otherField] = 'value';
        }
        expect(() => validateDeserialized(data, schema)).toThrow(ValidationError);
      }),
      { numRuns: 50 }
    );
  });

  it('validateDeserialized rejects objects with wrong field types', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (numValue) => {
        const schema = makeSchema({
          label: { type: 'string', required: true },
        });
        // Provide a number where string is expected
        const data = { label: numValue };
        expect(() =>
          validateDeserialized(data as unknown as Record<string, unknown>, schema)
        ).toThrow(ValidationError);
      }),
      { numRuns: 50 }
    );
  });
});
