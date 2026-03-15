# Product Requirement Document: @web-loom/api

**A Modular REST API Framework**  
_Version 1.0 (Draft)_

---

## 1. Introduction

**@web-loom/api** is a meta-framework for building REST APIs by assembling best‑of‑breed existing tools with sensible defaults. It is designed to work seamlessly with the [Web Loom frontend framework](https://webloomframework.com/docs/getting-started) but can be used independently. The framework prioritizes modular design, model‑driven development, and convention over configuration, while embracing a serverless‑first architecture. In the age of AI and agent‑based development, it provides a foundation that is easy to understand, extend, and generate code from.

---

## 2. Problem Statement

**Serverless APIs need specialized tooling, not traditional framework competition.** The serverless ecosystem has unique constraints:

- **Cold Start Sensitivity** – Traditional frameworks add unnecessary overhead for edge/serverless environments.
- **Platform Fragmentation** – Code written for Vercel doesn’t easily move to Cloudflare Workers or AWS Lambda.
- **Component Integration Complexity** – Assembling Hono + Drizzle + Neon + auth requires deep knowledge of each tool’s serverless quirks.
- **Infrastructure Lock-in** – Switching from Neon to D1 or Hono to Elysia requires significant refactoring.
- **AI Development Gap** – Existing tools weren’t designed for LLM-assisted development workflows.

**@web-loom/api** solves serverless-specific problems by:

- Providing a **serverless-optimized orchestration layer** that handles the integration complexity.
- Offering **platform-agnostic deployment** – write once, deploy anywhere in the serverless ecosystem.
- Enabling **zero-friction component swapping** via CLI, perfect for evolving infrastructure needs.
- Embracing **AI-assisted development** with machine-readable schemas and generation-friendly conventions.
- **Complementing existing ecosystems** rather than replacing established traditional frameworks.

---

## 3. Goals

- **Modularity** – Every major concern (API framework, database, validation, auth, email) is an interchangeable module with a well‑defined adapter interface.
- **Sensible Defaults** – Provide a production‑ready default stack that is lightweight, serverless‑native, and TypeScript‑first.
- **Easy Swapping** – A CLI command (`webloom-api switch`) to change the underlying implementation of any module with minimal friction.
- **Convention over Configuration** – Standardized project structure and naming conventions eliminate repetitive setup.
- **Model‑Driven Development** – Define data models once (e.g., with Zod or Drizzle) and automatically derive routes, validation, database schemas, and even an OpenAPI spec.
- **AI‑Ready** – The framework should expose metadata (schemas, routes) in a machine‑readable format, enabling LLMs and agents to generate, query, or extend APIs.
- **Serverless First** – Optimised for edge and serverless platforms (Cloudflare Workers, Vercel Edge, Node.js serverless functions), but flexible enough to run anywhere.
- **Integration with Web Loom Frontend** – Automatically generate type‑safe API clients for the frontend, sharing types across the stack.

---

## 4. Non‑Goals

- **Competing with traditional frameworks** – We don't aim to replace Nest.js, Express, or other established ecosystems.
- **Building new libraries from scratch** – We leverage existing mature tools (Hono, Drizzle, Zod) rather than reinventing.
- **Serverless platform lock-in** – Adapters ensure portability across Vercel, Cloudflare, AWS Lambda, etc.
- **Supporting every possible tool** – We focus on a curated set of serverless-optimized choices with extensibility for others.
- **Traditional server deployments** – While possible, we optimize specifically for serverless/edge environments.

---

## 5. Target Audience

- **Serverless-first developers** building APIs for edge/serverless platforms (Vercel, Cloudflare Workers, AWS Lambda).
- **Full‑stack teams** using Web Loom frontend framework who need a backend that shares the same philosophy.
- **Platform-agnostic projects** that need to deploy across multiple serverless providers without major rewrites.
- **AI‑assisted development** workflows where APIs are generated, extended, or modified programmatically.
- **Teams avoiding traditional framework overhead** who need serverless-optimized tooling without the complexity.

---

## 6. High‑Level Architecture

The framework is built around a small core that loads adapters and follows conventions. The main components are:

- **Core Runtime** – Bootstraps the application, loads configuration, initialises chosen adapters, and registers routes based on conventions.
- **Adapter Interfaces** – Define the contract for each pluggable component:
  - `ApiFrameworkAdapter` (Hono, Fastify, Express, …)
  - `DatabaseAdapter` (Neon, D1, Turso, PostgreSQL, …)
  - `ValidationAdapter` (Zod, Yup, Joi, …) – though we default to Zod and encourage its use.
  - `AuthAdapter` (JWT, session, OAuth providers)
  - `EmailAdapter` (Resend, Nodemailer, AWS SES, …)
- **Configuration File** (`webloom.config.ts` or `webloom.json`) – Declares which adapters are used and their options.
- **Conventions** – The project structure (e.g., `src/models/`, `src/routes/`, `src/services/`) is scanned and automatically wired.

```
Project Root
├── webloom.config.ts
├── src/
│   ├── models/          # Data models (Zod schemas / Drizzle tables)
│   ├── routes/          # Route handlers (grouped by resource)
│   ├── services/        # Business logic
│   ├── middlewares/     # Custom middleware
│   └── config/          # Environment-specific configuration
├── migrations/          # Drizzle migrations
└── package.json
```

---

## 7. Default Stack

The framework ships with a carefully chosen default stack that is immediately usable:

| Component        | Default     | Rationale                                                                                  |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------ |
| API Framework    | **Hono**    | Lightweight, fast, first‑class serverless support (Cloudflare Workers, Vercel Edge, etc.). |
| Validation       | **Zod**     | TypeScript‑first, excellent integration with Drizzle and Hono.                             |
| ORM              | **Drizzle** | Type‑safe, supports multiple databases, works seamlessly with Neon, D1, Turso.             |
| Database         | **Neon**    | Serverless Postgres with branching, scalable, and developer‑friendly.                      |
| Language         | TypeScript  | Static typing, modern JS features, excellent tooling.                                      |
| Auth (optional)  | **Lucia**   | Simple, flexible, and works with multiple databases. (Alternative: built‑in JWT helpers)   |
| Email (optional) | **Resend**  | Modern email API for developers, good DX.                                                  |

These defaults are not hard‑coded – they can be swapped via the CLI.

---

## 8. Swappable Components

The framework is designed to make swapping painless:

- **API Framework** – Adapters for Hono (default), Fastify, Express, and others. The CLI command `webloom-api switch api fastify` updates the configuration and installs the necessary packages.
- **Database** – Adapters for Neon (default), Cloudflare D1, Turso, and standard PostgreSQL (via Drizzle drivers). Switching only changes the connection configuration and driver.
- **Validation** – While Zod is the default, adapters for Yup or Joi can be added if needed. However, we encourage sticking with Zod for best integration.
- **Auth** – The framework provides a pluggable auth system. Default is a JWT‑based implementation (using `@hono/jwt`), but developers can swap in Lucia, Auth.js, or custom strategies.
- **Email** – An email module with a common interface; default provider is Resend, but others can be added via adapters.

The CLI handles dependency changes, configuration updates, and even provides codemods for breaking changes where possible.

---

## 9. CLI Tool

A command‑line interface (`@web-loom/cli`) accelerates development:

- `create-webloom-api` – Scaffolds a new project with the default stack.
- `webloom-api add <feature>` – Adds optional features (auth, email, file uploads, etc.) and configures them.
- `webloom-api switch <component> <provider>` – Swaps an existing component (e.g., `switch db turso`).
- `webloom-api generate model <name>` – Creates a new model file and optionally generates CRUD routes.
- `webloom-api generate openapi` – Produces an OpenAPI specification from the defined routes and models.
- `webloom-api generate client` – Generates a type‑safe frontend client (for Web Loom or any other TS project).

The CLI also integrates with AI tools – for example, it can accept a natural‑language prompt to generate a model (`webloom-api generate model "User with email and name"`).

---

## 10. Model‑Driven Development

Define your data models once, and let the framework do the rest:

- **Models** are defined using Zod schemas (or Drizzle tables). Example:

  ```ts
  // src/models/user.model.ts
  import { z } from "zod";
  import { createInsertSchema } from "drizzle-zod";
  import { users } from "../db/schema";

  export const User = createInsertSchema(users);
  export type User = z.infer<typeof User>;
  ```

- **CRUD Routes** are automatically generated for models placed in `src/models/` with a standard pattern (GET /users, POST /users, etc.). Developers can override or extend them in `src/routes/`.
- **Validation** is automatically applied from the Zod schema.
- **Database Migrations** are generated from Drizzle schema definitions.
- **OpenAPI** – The framework can introspect routes and models to generate an OpenAPI specification, useful for documentation and AI consumption.

---

## 11. AI / LLM Considerations

Building in the age of AI means the framework should be “machine‑friendly”:

- **Exposed Metadata** – The core provides a runtime API that lists all routes, their input/output schemas (in JSON Schema form), and available operations. This can be queried by an agent to understand the API.
- **Natural Language Generation** – The CLI can accept prompts to generate models, routes, or even complete CRUD APIs. The generated code follows project conventions and is immediately usable.
- **Integration with Agent Workflows** – By exporting OpenAPI specs and providing a consistent module structure, the framework enables agents to extend or modify APIs programmatically (e.g., adding a new route for a specific use case).
- **Future‑Proofing** – The adapter pattern allows swapping in new AI‑native services (e.g., an LLM‑powered validation layer) without rewriting the core.

---

## 12. Convention over Configuration

- **File‑based Routing** – Files inside `src/routes/` export route handlers. The file name determines the base path (e.g., `users.ts` → `/users`). Nested folders create nested paths.
- **Model Location** – Models in `src/models/` are automatically discovered and used for CRUD generation and validation.
- **Environment Variables** – Configuration is loaded from `.env` files, with sensible defaults for development.
- **Middleware** – Global middleware placed in `src/middlewares/` is automatically applied.

These conventions reduce boilerplate while remaining flexible – developers can always opt out and write custom handlers.

---

## 13. Integration with Web Loom Frontend

- **Type Sharing** – A shared package (`@web-loom/shared`) can contain common types (e.g., Zod schemas) used by both frontend and backend.
- **Generated Client** – The CLI can produce a type‑safe fetch‑based client for the frontend, ensuring end‑to‑end type safety.
- **Dev Server** – During development, the backend can be run locally, and the frontend can proxy API requests seamlessly.

---

## 14. Example Walkthrough

1. **Create a new project**:  
   `npm create webloom-api@latest my-api`  
   This scaffolds a project with Hono, Zod, Drizzle, and Neon configured.

2. **Define a model**:  
   Create `src/models/post.model.ts` with a Zod schema.

3. **Run migrations**:  
   `npm run db:generate` and `npm run db:migrate`

4. **Start the dev server**:  
   `npm run dev` – the API is live at `http://localhost:3000/posts`.

5. **Swap database to Turso**:  
   `webloom-api switch db turso` – the CLI updates config and installs the Turso driver.

6. **Generate an OpenAPI spec**:  
   `webloom-api generate openapi` – creates `openapi.json` for documentation or AI tools.

---

## 15. Security & Compliance

Security is paramount for any API framework:

- **Authentication & Authorization** – Built-in support for JWT, API keys, OAuth 2.0/OIDC flows. Role-based access control (RBAC) via middleware.
- **Input Validation & Sanitization** – Zod schemas provide the first line of defense, with additional XSS and injection protection.
- **Rate Limiting** – Configurable rate limiting per endpoint with Redis/memory backends.
- **CORS & Security Headers** – Sensible CORS defaults, security headers (HSTS, CSP, etc.) via Helmet-style middleware.
- **Audit Logging** – Security events (auth failures, rate limit hits) are logged with structured output.
- **Secrets Management** – Integration with environment variables and secret management services (AWS Secrets, Vault, etc.).
- **HTTPS Enforcement** – Automatic HTTPS redirect and secure cookie settings in production.

---

## 16. Performance & Scalability

Performance characteristics and scalability patterns:

- **Cold Start Optimization** – Framework minimizes bundle size and initialization time for serverless environments.
- **Caching Strategy** – Built-in HTTP caching headers, Redis adapter for application-level caching.
- **Database Connection Pooling** – Efficient connection management across serverless functions.
- **Response Compression** – Automatic gzip/brotli compression based on request headers.
- **Pagination & Limiting** – Standardized pagination patterns for large datasets.
- **Background Jobs** – Integration with job queues (BullMQ, Inngest) for async processing.
- **Performance Monitoring** – Built-in request timing and performance metrics collection.

---

## 17. Error Handling & Observability

Comprehensive error handling and monitoring:

- **Structured Error Responses** – Consistent error format with error codes, messages, and context.
- **Global Error Handling** – Catch-all error handler that prevents crashes and logs errors appropriately.
- **Logging Strategy** – Structured JSON logging with configurable log levels, compatible with modern log aggregation services.
- **Health Checks** – Built-in health check endpoints (`/health`, `/ready`) for load balancers and monitoring.
- **Metrics Collection** – Integration with Prometheus/OpenTelemetry for request metrics, database performance, etc.
- **Distributed Tracing** – Request correlation IDs and tracing support for microservices architectures.
- **Error Reporting** – Integration with Sentry, Bugsnag, or similar services for production error tracking.

---

## 18. Testing Strategy

Comprehensive testing approach:

- **Unit Testing** – Generated test suites for models and business logic using Vitest/Jest.
- **Integration Testing** – Test database interactions with in-memory/test databases.
- **API Testing** – Automated endpoint testing with request/response validation.
- **Contract Testing** – OpenAPI spec validation ensures API contracts are maintained.
- **Load Testing** – Integration with tools like k6 for performance testing.
- **Test Utilities** – Mock factories, test database seeding, and fixture management.
- **CI/CD Integration** – Pre-commit hooks and GitHub Actions/CI templates.

---

## 19. Developer Experience & Documentation

Ensuring excellent developer onboarding and productivity:

- **Interactive CLI Wizard** – Guided setup for new projects with technology choices explained.
- **Live Documentation** – Auto-generated API docs with interactive playground (Swagger UI/Scalar).
- **IDE Support** – TypeScript definitions, VS Code extensions, and IntelliSense optimization.
- **Debugging Tools** – Built-in request logging, database query logging, and performance profiling.
- **Hot Reload** – File watching and automatic restart during development.
- **Example Projects** – Real-world example applications demonstrating best practices.
- **Video Tutorials** – Comprehensive video series for visual learners.

---

## 20. Ecosystem & Community

Building a thriving ecosystem:

- **Plugin Architecture** – Well-defined interfaces for third-party extensions.
- **Adapter Registry** – Community-maintained registry of adapters for different services.
- **Templates & Starters** – Curated project templates for common use cases (e-commerce, SaaS, etc.).
- **Contributing Guidelines** – Clear guidelines for community contributions and adapter development.
- **RFC Process** – Structured process for major feature proposals and community input.
- **Discord/Community** – Active community spaces for support and collaboration.
- **Partner Program** – Relationships with service providers (Neon, Vercel, etc.) for better integration.

---

## 21. Deployment & DevOps

Production-ready deployment strategies:

- **Platform Templates** – One-click deployment templates for Vercel, Cloudflare Workers, AWS Lambda, Google Cloud Run.
- **Docker Support** – Optimized container builds with minimal attack surface.
- **Environment Management** – Clear separation of dev/staging/prod configurations.
- **Database Migrations** – Production-safe migration strategies with rollback support.
- **Secrets Rotation** – Support for automated secret rotation and zero-downtime deployments.
- **Blue/Green Deployments** – Built-in support for safe production deployments.
- **Infrastructure as Code** – Terraform/CDK templates for complete infrastructure provisioning.

---

## 22. Market Positioning & Ecosystem Fit

**We don't compete with established frameworks** – instead, we complement the serverless ecosystem:

| Ecosystem Area | Established Players | Web Loom API Role |
|----------------|-------------------|-------------------|
| **Traditional APIs** | Nest.js, Express, Fastify | *Not competing* – focused on serverless-native |
| **Serverless Functions** | Raw Vercel/Netlify functions | Structured framework for complex APIs |
| **Type-Safe APIs** | tRPC, GraphQL | REST-focused, multi-platform compatibility |
| **Database ORMs** | Prisma, TypeORM | Orchestrates existing tools (Drizzle, Prisma) |
| **Serverless Platforms** | Vercel, Cloudflare, AWS | Framework-agnostic deployment layer |

**Our Unique Niche:**
- **Serverless-Native Architecture** – Built specifically for edge/serverless constraints
- **Component Orchestration** – Assembles existing tools rather than reinventing them
- **Cross-Platform Flexibility** – Deploy the same code to Vercel, Cloudflare Workers, AWS Lambda
- **AI-First Development** – Designed for LLM-assisted API generation and modification
- **Swappable Infrastructure** – Change databases, API frameworks, or platforms without code rewrites

**Complementary, Not Competitive:**
- Use **Hono** (our default) but easily swap to **Fastify** for Node.js environments
- Leverage **Drizzle** (our default) or **Prisma** based on project needs
- Deploy to **any serverless platform** with the same codebase
- Integrate with **existing monorepos** and **established CI/CD pipelines**

---

## 23. Versioning & Migration Strategy

Handling evolution and breaking changes:

- **Semantic Versioning** – Strict semver compliance with clear breaking change communication.
- **Deprecation Policy** – 6-month deprecation period for breaking changes with clear migration paths.
- **Automated Migrations** – CLI codemods for common breaking changes where possible.
- **LTS Versions** – Long-term support versions for enterprise users (18-month support cycles).
- **Adapter Versioning** – Independent versioning for adapters with compatibility matrices.
- **Migration Guides** – Comprehensive upgrade guides with before/after examples.

---

## 24. Licensing & Legal

Open source strategy and legal considerations:

- **License**: MIT License for maximum adoption and commercial use.
- **Contributor License Agreement**: Simple CLA for community contributions.
- **Trademark Policy**: Clear guidelines for using Web Loom branding.
- **Commercial Support**: Optional paid support tiers for enterprise users.
- **Patent Protection**: Commitment to open source patent protection.

---

## 25. Future Considerations / Open Questions

- **Multi‑database support** – How to handle scenarios where an application needs both a relational DB (Neon) and a key‑value store (D1)? Possibly via a “composite” database adapter.
- **Real‑time** – Should the framework include built‑in WebSocket support (e.g., via Hono’s WebSocket helper)? This could be an optional module.
- **Plugin System** – Allow third‑party extensions to integrate deeply (e.g., a Stripe module that adds webhook routes and models).
- **Deployment Templates** – Provide pre‑built configurations for Vercel, Cloudflare Workers, AWS Lambda, etc.
- **Testing Utilities** – Generate test suites alongside routes, with mock database support.
- **Observability** – Built‑in logging, metrics, and tracing adapters (OpenTelemetry).

---

## 26. Success Metrics

**Adoption Metrics:**

- **Downloads & Usage** – NPM downloads, GitHub stars, and active projects using the framework.
- **Community Growth** – Number of community-contributed adapters, plugins, and templates.
- **Enterprise Adoption** – Commercial users and enterprise support subscriptions.

**Developer Experience:**

- **Time to First API** – Target: under 5 minutes from `create` to deployed API.
- **Onboarding Success** – Percentage of developers completing the tutorial successfully.
- **Switching Ease** – Success rate of `switch` commands (target: >95% success rate).
- **Documentation Satisfaction** – Developer feedback scores on docs and tutorials.

**Technical Performance:**

- **Framework Performance** – Cold start times, request throughput benchmarks.
- **Production Stability** – Uptime metrics from production deployments.
- **Security Posture** – Time to patch security vulnerabilities, security audit scores.

**AI & Ecosystem:**

- **AI Integration Usage** – Adoption of CLI generation features and AI-assisted development.
- **Ecosystem Health** – Number of maintained adapters, plugin ecosystem growth.
- **Migration Success** – Success rate of version upgrades and migrations.

---

## 27. Conclusion

**@web‑loom/api** carves out a unique niche in the serverless ecosystem by focusing on orchestration rather than competition. Instead of trying to replace established traditional frameworks, we provide the missing infrastructure layer that makes serverless API development as productive and maintainable as traditional development.

By assembling the best serverless-native tools with intelligent defaults, enabling frictionless component swapping, and embracing AI-assisted development from the ground up, we empower developers to build sophisticated APIs that can evolve with their infrastructure needs – whether that's moving from Vercel to Cloudflare Workers, or from Neon to D1.

Our success will be measured not by displacing existing frameworks, but by becoming the essential tooling that makes serverless API development accessible, productive, and future-proof.
