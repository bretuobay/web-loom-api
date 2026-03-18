/**
 * Shared auth types and WebLoomVariables augmentation.
 */

// ── AuthUser ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  permissions?: string[];
  [key: string]: unknown;
}

// ── Module augmentation — adds c.var.user to every Hono context ─────────────

declare module '@web-loom/api-core' {
  interface WebLoomVariables {
    user?: AuthUser;
  }
}
