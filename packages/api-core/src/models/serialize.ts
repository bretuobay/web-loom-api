/**
 * Serialise model data to JSON-safe values.
 *
 * Handles type coercions that `JSON.stringify` cannot handle natively:
 * - `Date`   → ISO 8601 string
 * - `BigInt` → string
 * - `Buffer` → base64 string
 *
 * Arrays and plain objects are traversed recursively.
 */
export function serializeModel(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (data instanceof Date) return data.toISOString();
  if (typeof data === 'bigint') return data.toString();
  if (Buffer.isBuffer(data)) return data.toString('base64');
  if (Array.isArray(data)) return data.map(serializeModel);
  if (typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, serializeModel(v)])
    );
  }
  return data;
}
