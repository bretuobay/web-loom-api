import { getTableColumns } from 'drizzle-orm';
import type { Table, Column } from 'drizzle-orm';

export interface PrimaryKey {
  /** Drizzle column object (for use in eq(), etc.) */
  column: Column;
  /** TypeScript property name on the table (e.g. 'id') */
  propName: string;
}

export function getPrimaryKeyColumn(table: Table): PrimaryKey {
  const columns = getTableColumns(table);
  for (const [propName, col] of Object.entries(columns)) {
    if ((col as any).primary) {
      return { column: col as Column, propName };
    }
  }
  throw new Error(
    `Table "${(table as any)[Symbol.for('drizzle:Name')] ?? 'unknown'}" has no primary key column. Mark one column with .primaryKey().`,
  );
}
