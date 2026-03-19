import type { Table } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { serializeModel } from '@web-loom/api-core';
import type { Model } from '@web-loom/api-core';

function isUniqueConstraintError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  const code = (err as any)?.code;
  return (
    code === '23505' ||
    code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    msg.includes('unique constraint') ||
    msg.includes('duplicate key') ||
    msg.includes('unique_violation')
  );
}

export function buildCreateHandler<TTable extends Table>(model: Model<TTable>): MiddlewareHandler {
  return async (c) => {
    const db = c.var.db as any;
    const data = { ...(c.req.valid('json') as Record<string, unknown>) };
    const opts = typeof model.meta.crud === 'object' ? model.meta.crud : {};

    if (opts.timestamps) {
      const now = new Date();
      data['createdAt'] = now;
      data['updatedAt'] = now;
    }

    try {
      const rows = await db.insert(model.table).values(data).returning();
      return c.json(serializeModel(rows[0] ?? data), 201);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return c.json(
          { error: { code: 'CONFLICT', message: 'A record with this value already exists' } },
          409
        );
      }
      throw err;
    }
  };
}
