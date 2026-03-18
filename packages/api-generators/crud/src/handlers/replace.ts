import { eq } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { serializeModel } from '@web-loom/api-core';
import type { Model } from '@web-loom/api-core';
import { getPrimaryKeyColumn } from '../pk-resolver';

function coerceId(column: any, rawId: string): { value: unknown; error?: string } {
  if (column.dataType === 'number') {
    const n = Number(rawId);
    if (isNaN(n)) return { value: null, error: `Invalid id: expected a number, got "${rawId}"` };
    return { value: n };
  }
  return { value: rawId };
}

export function buildReplaceHandler<TTable extends Table>(model: Model<TTable>): MiddlewareHandler {
  return async (c) => {
    const db = c.var.db as any;
    const pk = getPrimaryKeyColumn(model.table);
    const rawId = c.req.param('id') ?? '';

    const { value: id, error } = coerceId(pk.column, rawId);
    if (error) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: error } }, 400);
    }

    const data = { ...(c.req.valid('json') as Record<string, unknown>) };
    const opts = typeof model.meta.crud === 'object' ? model.meta.crud : {};

    if (opts.timestamps) {
      data['updatedAt'] = new Date();
    }

    const rows = await db
      .update(model.table)
      .set(data)
      .where(eq((model.table as any)[pk.propName], id))
      .returning();

    if (!rows[0]) {
      return c.json({ error: { code: 'NOT_FOUND', message: `${model.meta.name} not found` } }, 404);
    }

    return c.json(serializeModel(rows[0]));
  };
}
