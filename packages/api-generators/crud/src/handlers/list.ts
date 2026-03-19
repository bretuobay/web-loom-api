import {
  asc,
  desc,
  eq,
  gte,
  lte,
  like,
  inArray,
  and,
  isNull,
  count,
  getTableColumns,
} from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { serializeModel } from '@web-loom/api-core';
import type { Model } from '@web-loom/api-core';

const RESERVED_PARAMS = new Set(['page', 'limit', 'sort', 'fields', 'search']);

function coerce(column: any, value: string): unknown {
  const dt = column.dataType as string;
  if (dt === 'number') return Number(value);
  if (dt === 'boolean') return value === 'true' || value === '1';
  if (dt === 'date') return new Date(value);
  return value;
}

function validateSortFields(table: Table, sort: string | undefined): string | null {
  if (!sort) return null;
  const columns = getTableColumns(table);
  const fields = sort.split(',').map((f) => f.replace(/^-/, '').trim());
  const invalid = fields.filter((f) => f && !(f in columns));
  if (invalid.length > 0) {
    return `Unknown sort field(s): ${invalid.join(', ')}`;
  }
  return null;
}

function buildOrderBy(table: Table, sort: string | undefined): any[] {
  if (!sort) return [];
  return sort
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => {
      const descending = f.startsWith('-');
      const name = descending ? f.slice(1) : f;
      const column = (table as any)[name];
      if (!column) return null;
      return descending ? desc(column) : asc(column);
    })
    .filter(Boolean);
}

function buildWhereConditions(table: Table, query: Record<string, string>): any[] {
  const conditions: any[] = [];
  const columns = getTableColumns(table);

  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_PARAMS.has(key)) continue;

    // Bracketed operators: name[gte]=18
    const opMatch = key.match(/^(\w+)\[(gte|lte|like|in)\]$/);
    if (opMatch) {
      const [, colName, op] = opMatch;
      if (!colName || !(colName in columns)) continue;
      const column = (table as any)[colName];
      if (op === 'gte') conditions.push(gte(column, coerce(column, value)));
      else if (op === 'lte') conditions.push(lte(column, coerce(column, value)));
      else if (op === 'like') conditions.push(like(column, value));
      else if (op === 'in') conditions.push(inArray(column, value.split(',')));
      continue;
    }

    // Equality filter: only match known columns
    if (key in columns) {
      conditions.push(eq((table as any)[key], coerce((table as any)[key], value)));
    }
  }

  return conditions;
}

export function buildListHandler<TTable extends Table>(model: Model<TTable>): MiddlewareHandler {
  return async (c) => {
    const db = c.var.db as any;
    const query = c.req.query();

    const page = Math.max(1, parseInt(query['page'] ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query['limit'] ?? '20', 10) || 20));
    const offset = (page - 1) * limit;

    const sortErr = validateSortFields(model.table, query['sort']);
    if (sortErr) {
      return c.json({ error: { code: 'INVALID_SORT_FIELD', message: sortErr } }, 400);
    }

    const opts = typeof model.meta.crud === 'object' ? model.meta.crud : {};
    const conditions = buildWhereConditions(model.table, query);

    if (opts.softDelete && 'deletedAt' in model.table) {
      conditions.push(isNull((model.table as any).deletedAt));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderClauses = buildOrderBy(model.table, query['sort']);

    let dataQuery = db.select().from(model.table).where(where).limit(limit).offset(offset);
    if (orderClauses.length > 0) dataQuery = dataQuery.orderBy(...orderClauses);

    const [rows, countRows] = await Promise.all([
      dataQuery,
      db.select({ value: count() }).from(model.table).where(where),
    ]);

    const total = Number(countRows[0]?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return c.json({
      data: (rows as any[]).map(serializeModel),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  };
}
