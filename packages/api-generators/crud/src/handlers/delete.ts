import { eq, isNull, and } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
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

function isForeignKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  const code = (err as any)?.code;
  return (
    code === '23503' ||
    msg.includes('foreign key constraint') ||
    msg.includes('violates foreign key') ||
    msg.includes('foreign_key')
  );
}

export function buildDeleteHandler<TTable extends Table>(model: Model<TTable>): MiddlewareHandler {
  return async (c) => {
    const db = c.var.db as any;
    const pk = getPrimaryKeyColumn(model.table);
    const rawId = c.req.param('id') ?? '';

    const { value: id, error } = coerceId(pk.column, rawId);
    if (error) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: error } }, 400);
    }

    const opts = typeof model.meta.crud === 'object' ? model.meta.crud : {};
    const pkCondition = eq((model.table as any)[pk.propName], id);

    try {
      if (opts.softDelete && 'deletedAt' in model.table) {
        // Soft delete: check the record exists first (and isn't already deleted)
        const conditions = [pkCondition, isNull((model.table as any).deletedAt)];
        const existing = await db
          .select()
          .from(model.table)
          .where(and(...conditions));
        if (!existing[0]) {
          return c.json(
            { error: { code: 'NOT_FOUND', message: `${model.meta.name} not found` } },
            404
          );
        }
        await db.update(model.table).set({ deletedAt: new Date() }).where(pkCondition);
      } else {
        // Hard delete
        const deleted = await db.delete(model.table).where(pkCondition).returning();
        if (!deleted[0]) {
          return c.json(
            { error: { code: 'NOT_FOUND', message: `${model.meta.name} not found` } },
            404
          );
        }
      }

      return new Response(null, { status: 204 });
    } catch (err) {
      if (isForeignKeyError(err)) {
        return c.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Cannot delete: record is referenced by other records',
            },
          },
          409
        );
      }
      throw err;
    }
  };
}
