# Requirements: Stack Foundation

## Introduction

This spec defines the foundational commitment of Web Loom API to Hono, Drizzle ORM, and Zod as first-class, non-abstracted dependencies. The three existing adapter wrappers (`api-adapter-hono`, `api-adapter-drizzle`, `api-adapter-zod`) are removed. The framework builds conventions and code generation on top of these libraries directly, rather than behind swappable interfaces.

## Glossary

- **Web_Loom_API**: The meta-framework
- **Core_Runtime**: The `CoreRuntime` class that bootstraps the application
- **Hono_App**: An instance of Hono from the `hono` package used as the HTTP server
- **Drizzle_DB**: The typed database client returned by `drizzle()` from `drizzle-orm`
- **Zod**: The `zod` package used directly for schema definition and validation
- **RequestContext**: The typed Hono context enriched with framework variables (`db`, `auth`, `email`)
- **EmailAdapter**: The remaining adapter abstraction for email providers
- **WebLoomConfig**: The configuration object passed to `createApp()`
- **Application**: The object returned by `createApp()`, wrapping the Hono app and Drizzle db

---

## Requirements

### 1. Core Application Bootstrap

**REQ-SF-001**
The Web_Loom_API shall expose a `createApp(config)` function that returns an `Application` containing a `Hono_App` and a `Drizzle_DB` instance.

**REQ-SF-002**
When `createApp(config)` is called, the Web_Loom_API shall initialize the `Drizzle_DB` using the `database.url` from `WebLoomConfig` and the Drizzle driver specified by `database.driver` (`neon-serverless`, `libsql`, or `pg`).

**REQ-SF-003**
When `createApp(config)` is called, the Web_Loom_API shall mount all discovered route files onto the `Hono_App` before returning the `Application`.

**REQ-SF-004**
The Web_Loom_API shall expose the `Hono_App` on `Application.hono` so that consumers can register additional Hono middleware or routes after `createApp()`.

**REQ-SF-005**
The Web_Loom_API shall expose the `Drizzle_DB` on `Application.db` with the full Drizzle type signature (`LibSQLDatabase`, `NeonDatabase`, or `NodePgDatabase` depending on driver) so that downstream TypeScript code retains full type inference.

**REQ-SF-006**
The `Application` shall expose a `start(port?)` method that calls `Hono_App.listen()` via `@hono/node-server` for local and Docker deployments.

**REQ-SF-007**
The `Application` shall expose a `handleRequest(req: Request): Promise<Response>` method that delegates to `Hono_App.fetch()` for use in Cloudflare Workers, Vercel Edge, and AWS Lambda handlers.

**REQ-SF-008**
When `Application.shutdown()` is called, the Web_Loom_API shall close the database connection pool and stop the HTTP server within the configured timeout.

---

### 2. Removal of Redundant Adapter Packages

**REQ-SF-010**
The Web_Loom_API shall not contain an `APIFrameworkAdapter` interface or a package named `@web-loom/api-adapter-hono`.

**REQ-SF-011**
The Web_Loom_API shall not contain a `DatabaseAdapter` interface, a `QueryBuilder` interface, or a package named `@web-loom/api-adapter-drizzle`.

**REQ-SF-012**
The Web_Loom_API shall not contain a `ValidationAdapter` interface or a package named `@web-loom/api-adapter-zod`.

**REQ-SF-013**
The Web_Loom_API shall not contain a `SchemaDefinition` or `FieldSchema` DSL type. Zod schemas shall be written directly using the `zod` package API.

---

### 3. Hono Context as the Request Context

**REQ-SF-020**
The Web_Loom_API shall use Hono's typed context variable system (`c.var`) as the mechanism for injecting framework services into route handlers. There shall be no bespoke `RequestContext` type.

**REQ-SF-021**
The Web_Loom_API shall register the `Drizzle_DB` instance as a Hono context variable under the key `db`, typed as the concrete Drizzle database type, making it available in all route handlers as `c.var.db`.

**REQ-SF-022**
Where an `EmailAdapter` is configured, the Web_Loom_API shall register it as a Hono context variable under the key `email`, making it available in all route handlers as `c.var.email`.

**REQ-SF-023**
The Web_Loom_API shall define a `WebLoomVariables` interface exported from `@web-loom/api-core` that declares the typed Hono context variables. Consumers shall use `new Hono<{ Variables: WebLoomVariables }>()` to get full IDE autocomplete on `c.var`.

---

### 4. Configuration

**REQ-SF-030**
The Web_Loom_API shall expose a `defineConfig(config: WebLoomConfig)` function that validates the configuration and returns it unchanged (identity function with type checking).

**REQ-SF-031**
The `WebLoomConfig` shall contain a `database` block with: `url: string`, `driver: 'neon-serverless' | 'libsql' | 'pg'`, and optional `poolSize: number`.

**REQ-SF-032**
The `WebLoomConfig` shall contain an optional `email` block accepting an `EmailAdapter` instance.

**REQ-SF-033**
The `WebLoomConfig` shall contain a `routes` block with: `dir: string` (default `'./src/routes'`) for file-based discovery.

**REQ-SF-034**
If `database.url` is missing or empty at application startup, the Web_Loom_API shall throw a descriptive `ConfigurationError` before attempting any database connection.

---

### 5. Email Adapter (Retained)

**REQ-SF-040**
The Web_Loom_API shall retain the `EmailAdapter` interface with methods: `send(email: EmailMessage): Promise<EmailResult>`, `sendBatch(emails: EmailMessage[]): Promise<EmailResult[]>`, and `sendTemplate(templateId: string, to: string, variables: Record<string, unknown>): Promise<EmailResult>`.

**REQ-SF-041**
The Web_Loom_API shall ship `@web-loom/api-adapter-resend` implementing `EmailAdapter` with test-mode support (captured `sentEmails` array for assertions in tests).

**REQ-SF-042**
If no `EmailAdapter` is configured and a route handler accesses `c.var.email`, the Web_Loom_API shall throw a runtime `ConfigurationError` with the message: `"Email adapter not configured. Add an email adapter to defineConfig({ email: ... })."`.

---

### 6. Deployment Exports

**REQ-SF-050**
The Web_Loom_API shall provide a `@web-loom/api-deployment-cloudflare` package exporting a `createCloudflareHandler(app: Application)` function that returns a Cloudflare Workers `ExportedHandler` with `fetch`, `scheduled`, and `queue` entry points.

**REQ-SF-051**
The Web_Loom_API shall provide a `@web-loom/api-deployment-vercel` package exporting a `createVercelHandler(app: Application)` function that returns a Vercel Edge Function handler.

**REQ-SF-052**
The Web_Loom_API shall provide a `@web-loom/api-deployment-aws` package exporting a `createLambdaHandler(app: Application)` function that returns an AWS Lambda handler compatible with API Gateway v2 (HTTP API) payload format.

**REQ-SF-053**
Each deployment handler shall call `app.handleRequest(request)` and adapt the platform-specific request/response types to the Web Standards `Request`/`Response` API.
