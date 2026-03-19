/**
 * Full-Stack Example — File Upload Routes
 *
 * Demonstrates multipart form parsing with Hono's built-in parseBody().
 * File storage is left as a stub — swap in any S3/R2/local adapter.
 * The `ctx.storage` API from the old examples doesn't exist; storage
 * is handled outside the framework.
 */
import { defineRoutes } from '@web-loom/api-core';
import { eq } from 'drizzle-orm';
import { usersTable } from '../models/user';
import { authenticate } from '../middleware/auth';

const routes = defineRoutes();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// POST /uploads/avatar — Upload a user avatar
routes.post('/uploads/avatar', authenticate, async (c) => {
  const body = await c.req.parseBody();
  const file = body['avatar'];

  if (!(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: 'Invalid file type. Allowed: jpeg, png, webp' }, 400);
  }
  if (file.size > MAX_SIZE_BYTES) {
    return c.json({ error: 'File exceeds 5 MB limit' }, 400);
  }

  // TODO: upload `file` to your storage backend (S3, R2, local disk, etc.)
  // const result = await storageAdapter.upload(file, { directory: 'avatars' });
  const url = `/avatars/${c.var.user!.id}-${Date.now()}.${file.type.split('/')[1]}`;

  await c.var.db
    .update(usersTable)
    .set({ avatarUrl: url })
    .where(eq(usersTable.id, c.var.user!.id));

  return c.json({ url, size: file.size, mimeType: file.type });
});

// DELETE /uploads/avatar — Remove avatar
routes.delete('/uploads/avatar', authenticate, async (c) => {
  const [user] = await c.var.db
    .select({ avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, c.var.user!.id));

  if (user?.avatarUrl) {
    // TODO: delete from storage backend
    await c.var.db
      .update(usersTable)
      .set({ avatarUrl: null })
      .where(eq(usersTable.id, c.var.user!.id));
  }

  return c.json({ success: true });
});

export default routes;
