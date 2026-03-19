/**
 * Full-Stack Example — Post Routes
 *
 * CRUD for posts using Drizzle queries. Cache middleware from
 * @web-loom/api-middleware-cache wraps GET handlers. Webhook dispatch and
 * job enqueueing are shown via the standalone managers defined in their
 * respective modules — NOT via ctx.webhooks / ctx.jobs (those don't exist).
 */
import { defineRoutes, validate } from '@web-loom/api-core';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { postsTable } from '../models/post';
import { commentsTable } from '../models/comment';
import { usersTable } from '../models/user';
import { authenticate } from '../middleware/auth';
import { dispatchPostCreated } from '../webhooks/post-created';
import { jobQueue } from '../jobs/email-notification';

const routes = defineRoutes();

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

const updatePostSchema = createPostSchema.partial();

// GET /posts — List published posts
routes.get('/posts', async (c) => {
  const posts = await c.var.db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      slug: postsTable.slug,
      status: postsTable.status,
      userId: postsTable.userId,
      publishedAt: postsTable.publishedAt,
      createdAt: postsTable.createdAt,
    })
    .from(postsTable)
    .where(and(eq(postsTable.status, 'published'), isNull(postsTable.deletedAt)))
    .orderBy(postsTable.publishedAt)
    .limit(20);

  return c.json({ posts });
});

// GET /posts/:id — Single post with author
routes.get('/posts/:id', async (c) => {
  const [post] = await c.var.db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      content: postsTable.content,
      slug: postsTable.slug,
      status: postsTable.status,
      publishedAt: postsTable.publishedAt,
      author: {
        id: usersTable.id,
        name: usersTable.name,
      },
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.userId, usersTable.id))
    .where(and(eq(postsTable.id, c.req.param('id')), isNull(postsTable.deletedAt)));

  if (!post) return c.json({ error: 'Post not found' }, 404);

  // Fetch comments separately (avoids a complex aggregation query in this example)
  const comments = await c.var.db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.postId, post.id));

  return c.json({ post: { ...post, comments } });
});

// POST /posts — Create post (authenticated)
routes.post('/posts', authenticate, validate('json', createPostSchema), async (c) => {
  const data = c.req.valid('json');
  const userId = c.var.user!.id;

  const [post] = await c.var.db
    .insert(postsTable)
    .values({
      ...data,
      slug: slugify(data.title),
      userId,
      publishedAt: data.status === 'published' ? new Date() : undefined,
    })
    .returning();

  // Dispatch webhook to notify subscribers (fire-and-forget)
  dispatchPostCreated({ postId: post.id, title: post.title, authorId: userId }).catch((err) =>
    console.error('Webhook dispatch failed:', err)
  );

  // Enqueue email notification job
  await jobQueue.enqueue({
    name: 'email-notification',
    data: { type: 'new-post', postId: post.id, authorName: c.var.user!.name ?? '' },
  });

  return c.json({ post }, 201);
});

// PUT /posts/:id — Update post (owner only)
routes.put('/posts/:id', authenticate, validate('json', updatePostSchema), async (c) => {
  const postId = c.req.param('id');
  const [existing] = await c.var.db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.id, postId), isNull(postsTable.deletedAt)));

  if (!existing) return c.json({ error: 'Post not found' }, 404);
  if (existing.userId !== c.var.user!.id) return c.json({ error: 'Forbidden' }, 403);

  const updates = c.req.valid('json');
  const patch: Partial<typeof existing> = { ...updates, updatedAt: new Date() };
  if (updates.title) patch.slug = slugify(updates.title);
  if (updates.status === 'published' && !existing.publishedAt) {
    patch.publishedAt = new Date();
  }

  const [post] = await c.var.db
    .update(postsTable)
    .set(patch)
    .where(eq(postsTable.id, postId))
    .returning();

  return c.json({ post });
});

// DELETE /posts/:id — Soft-delete (owner only)
routes.delete('/posts/:id', authenticate, async (c) => {
  const postId = c.req.param('id');
  const [existing] = await c.var.db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.id, postId), isNull(postsTable.deletedAt)));

  if (!existing) return c.json({ error: 'Post not found' }, 404);
  if (existing.userId !== c.var.user!.id) return c.json({ error: 'Forbidden' }, 403);

  await c.var.db.update(postsTable).set({ deletedAt: new Date() }).where(eq(postsTable.id, postId));

  return c.json({ success: true });
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default routes;
