/**
 * Full-Stack Example — File Upload Routes
 *
 * Demonstrates file upload handling for user avatars.
 * Shows multipart form parsing, file validation, and storage.
 */
import { defineRoutes } from '@web-loom/api-core';
import { User } from '../models/user';
import { authenticate } from '../middleware/auth';

export default defineRoutes((router) => {
  // POST /api/uploads/avatar — Upload a user avatar
  router.post('/api/uploads/avatar', {
    middleware: [authenticate],
    validation: {
      body: {
        type: 'multipart',
        fields: {
          avatar: {
            type: 'file',
            maxSize: 5 * 1024 * 1024, // 5 MB
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          },
        },
      },
    },
    handler: async (ctx) => {
      const file = ctx.file('avatar');
      if (!file) {
        return ctx.json({ error: 'No file provided' }, 400);
      }

      // Store the file — the storage adapter handles local/S3/R2 based on config
      const result = await ctx.storage.upload(file, {
        directory: 'avatars',
        filename: `${ctx.user.id}-${Date.now()}`,
        // Resize on upload (if image processing adapter is configured)
        transform: { width: 256, height: 256, fit: 'cover' },
      });

      // Update the user's avatar URL
      await ctx.db.update(User, ctx.user.id, {
        avatarUrl: result.url,
      });

      return ctx.json({
        url: result.url,
        size: result.size,
        mimeType: result.mimeType,
      });
    },
  });

  // DELETE /api/uploads/avatar — Remove the current avatar
  router.delete('/api/uploads/avatar', {
    middleware: [authenticate],
    handler: async (ctx) => {
      const user = await ctx.db.select(User).where('id', '=', ctx.user.id).first();

      if (user?.avatarUrl) {
        await ctx.storage.delete(user.avatarUrl);
        await ctx.db.update(User, ctx.user.id, { avatarUrl: null });
      }

      return ctx.json({ success: true });
    },
  });
});
