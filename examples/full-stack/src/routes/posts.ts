/**
 * Full-Stack Example — Post Routes
 *
 * Demonstrates caching with tag-based invalidation, webhook dispatch,
 * and background job scheduling on resource creation.
 */
import { defineRoutes } from '@web-loom/api-core';
import { Post } from '../models/post';
import { authenticate } from '../middleware/auth';

export default defineRoutes((router) => {
  // GET /api/posts — List published posts (cached)
  router.get('/api/posts', {
    cache: { ttl: 60, tags: ['posts'] },
    handler: async (ctx) => {
      const posts = await ctx.db
        .select(Post)
        .where('status', '=', 'published')
        .orderBy('publishedAt', 'desc')
        .limit(20);

      return ctx.json({ posts });
    },
  });

  // GET /api/posts/:id — Get a single post (cached)
  router.get('/api/posts/:id', {
    cache: { ttl: 120, tags: ['posts'] },
    handler: async (ctx) => {
      const post = await ctx.db
        .select(Post)
        .where('id', '=', ctx.params.id)
        .with('author') // eager-load the User relationship
        .with('comments') // eager-load comments
        .first();

      if (!post) return ctx.json({ error: 'Post not found' }, 404);

      return ctx.json({ post });
    },
  });

  // POST /api/posts — Create a post (authenticated)
  router.post('/api/posts', {
    middleware: [authenticate],
    validation: {
      body: Post.schema.pick('title', 'content', 'status'),
    },
    handler: async (ctx) => {
      const post = await ctx.db.insert(Post, {
        ...ctx.body,
        userId: ctx.user.id,
        slug: slugify(ctx.body.title),
        publishedAt: ctx.body.status === 'published' ? new Date() : undefined,
      });

      // Invalidate the posts cache so new content appears immediately
      await ctx.cache.invalidate(['posts']);

      // Dispatch a webhook to notify external systems
      await ctx.webhooks.dispatch('post.created', {
        postId: post.id,
        title: post.title,
        authorId: ctx.user.id,
      });

      // Schedule a background job to send email notifications
      await ctx.jobs.enqueue('email-notification', {
        type: 'new-post',
        postId: post.id,
        authorName: ctx.user.name,
      });

      return ctx.json({ post }, 201);
    },
  });

  // PUT /api/posts/:id — Update a post (owner only)
  router.put('/api/posts/:id', {
    middleware: [authenticate],
    validation: {
      body: Post.schema.pick('title', 'content', 'status').partial(),
    },
    handler: async (ctx) => {
      const existing = await ctx.db.select(Post).where('id', '=', ctx.params.id).first();
      if (!existing) return ctx.json({ error: 'Post not found' }, 404);
      if (existing.userId !== ctx.user.id) return ctx.json({ error: 'Forbidden' }, 403);

      const updates: Record<string, unknown> = { ...ctx.body };
      if (ctx.body.title) updates.slug = slugify(ctx.body.title);
      if (ctx.body.status === 'published' && !existing.publishedAt) {
        updates.publishedAt = new Date();
      }

      const post = await ctx.db.update(Post, ctx.params.id, updates);
      await ctx.cache.invalidate(['posts']);

      return ctx.json({ post });
    },
  });

  // DELETE /api/posts/:id — Delete a post (owner only)
  router.delete('/api/posts/:id', {
    middleware: [authenticate],
    handler: async (ctx) => {
      const existing = await ctx.db.select(Post).where('id', '=', ctx.params.id).first();
      if (!existing) return ctx.json({ error: 'Post not found' }, 404);
      if (existing.userId !== ctx.user.id) return ctx.json({ error: 'Forbidden' }, 403);

      await ctx.db.delete(Post, ctx.params.id);
      await ctx.cache.invalidate(['posts']);

      return ctx.json({ success: true }, 204);
    },
  });
});

/** Simple slug generator for post titles */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
