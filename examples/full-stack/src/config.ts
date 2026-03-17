/**
 * Full-Stack Example — App Configuration
 *
 * Demonstrates a production-ready configuration with all adapters enabled:
 * auth, email, caching, rate limiting, webhooks, background jobs, and file uploads.
 */
import { defineConfig } from "@web-loom/api-core";
import { honoAdapter } from "@web-loom/api-adapter-hono";
import { drizzleAdapter } from "@web-loom/api-adapter-drizzle";
import { zodAdapter } from "@web-loom/api-adapter-zod";
import { luciaAdapter } from "@web-loom/api-adapter-lucia";
import { resendAdapter } from "@web-loom/api-adapter-resend";

export default defineConfig({
  adapters: {
    api: honoAdapter(),
    database: drizzleAdapter(),
    validation: zodAdapter(),
    auth: luciaAdapter({
      sessionExpiry: "30d",
      cookieName: "session",
    }),
    email: resendAdapter({
      apiKey: process.env.RESEND_API_KEY!,
      from: "noreply@example.com",
    }),
  },

  database: {
    url: process.env.DATABASE_URL!,
    poolSize: 10,
    readReplicas: [process.env.DATABASE_READ_URL!],
  },

  security: {
    cors: {
      origin: [process.env.FRONTEND_URL!],
      credentials: true,
    },
    rateLimit: {
      windowMs: 60_000,
      max: 100,
    },
    requestSizeLimit: 10 * 1024 * 1024, // 10 MB for file uploads
  },

  features: {
    crud: true,
    caching: true,
    auditLogging: true,
  },

  observability: {
    logging: { level: "info", format: "json" },
    metrics: { enabled: true, endpoint: "/metrics" },
    tracing: { enabled: true, sampleRate: 0.1 },
  },

  development: {
    hotReload: true,
    apiDocs: true,
    detailedErrors: true,
  },
});
