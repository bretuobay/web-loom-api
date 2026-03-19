import { toJSONSchema } from 'zod/v4';
import type { ZodSchema } from 'zod';

/**
 * Converts a Zod schema to an OpenAPI-compatible JSON Schema object.
 *
 * Uses Zod v4's native `toJSONSchema()` which targets JSON Schema 2020-12,
 * compatible with OpenAPI 3.1. Strips the `$schema` meta-property.
 *
 * On failure, returns `{}` (any-type) and emits a warning.
 */
export function zodToSchema(schema: ZodSchema, name: string): Record<string, unknown> {
  try {
    const result = toJSONSchema(schema) as Record<string, unknown>;
    // Strip the $schema meta field — not needed inside components.schemas
    delete result['$schema'];
    return result;
  } catch {
    console.warn(`[openapi] Cannot convert schema "${name}" to JSON Schema — using any-type ({})`);
    return {};
  }
}
