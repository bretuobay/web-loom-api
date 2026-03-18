import { Hono } from 'hono';
import { validate } from '@web-loom/api-core';
import type { Model, WebLoomVariables } from '@web-loom/api-core';
import type { Table } from 'drizzle-orm';
import { buildListHandler } from './handlers/list';
import { buildReadHandler } from './handlers/read';
import { buildCreateHandler } from './handlers/create';
import { buildReplaceHandler } from './handlers/replace';
import { buildPatchHandler } from './handlers/patch';
import { buildDeleteHandler } from './handlers/delete';
import { resolveAuthMiddleware } from './auth-resolver';

export function generateCrudRouter<TTable extends Table>(
  model: Model<TTable>,
): Hono<{ Variables: WebLoomVariables }> {
  const router = new Hono<{ Variables: WebLoomVariables }>();
  const opts = typeof model.meta.crud === 'object' ? model.meta.crud : {};
  // Cast to any: Hono's overloads use fixed-length handler tuples and don't
  // accept a spread of a dynamic-length middleware array.
  const r = router as any;

  r.get('/', ...resolveAuthMiddleware(opts.list), buildListHandler(model));
  r.post(
    '/',
    ...resolveAuthMiddleware(opts.create),
    validate('json', model.insertSchema),
    buildCreateHandler(model),
  );
  r.get('/:id', ...resolveAuthMiddleware(opts.read), buildReadHandler(model));
  r.put(
    '/:id',
    ...resolveAuthMiddleware(opts.update),
    validate('json', model.insertSchema),
    buildReplaceHandler(model),
  );
  r.patch(
    '/:id',
    ...resolveAuthMiddleware(opts.update),
    validate('json', model.updateSchema),
    buildPatchHandler(model),
  );
  r.delete('/:id', ...resolveAuthMiddleware(opts.delete), buildDeleteHandler(model));

  return router;
}
