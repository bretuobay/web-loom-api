import { relative } from 'node:path';

/**
 * Convert a route file's absolute path to an HTTP mount path.
 *
 * Conventions:
 * | File                              | Mount path       |
 * |-----------------------------------|------------------|
 * | `routes/users.ts`                 | `/users`         |
 * | `routes/users/index.ts`           | `/users`         |
 * | `routes/users/[id].ts`            | `/users/:id`     |
 * | `routes/posts/[...slug].ts`       | `/posts/*`       |
 * | `routes/api/v1/health.ts`         | `/api/v1/health` |
 * | `routes/index.ts`                 | `/`              |
 */
export function filePathToMountPath(filePath: string, baseDir: string): string {
  const rel = relative(baseDir, filePath)
    .replace(/\\/g, '/')          // normalise Windows separators
    .replace(/\.ts$/, '')         // strip .ts extension
    .replace(/\/index$/, '')      // /index → empty (directory root)
    .replace(/^index$/, '')       // top-level index.ts → root
    .replace(/\[\.\.\.(\w+)\]/g, '*')  // [...slug] → *
    .replace(/\[(\w+)\]/g, ':$1'); // [id] → :id

  return rel ? `/${rel}` : '/';
}
