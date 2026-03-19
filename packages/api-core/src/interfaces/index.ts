// Keep auth and email adapters — these are still used by the framework.
// api-framework-adapter, database-adapter, and validation-adapter have been
// removed in favour of direct Hono, Drizzle, and Zod usage.
export * from './auth-adapter';
export * from './email-adapter';
