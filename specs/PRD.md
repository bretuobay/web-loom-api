# Product Requirement Document: @web-loom/api

**A Modular REST API Framework**  
_Version 1.0 (Draft)_

---

## 1. Introduction

**@web-loom/api** is a meta-framework for building REST APIs by assembling best‑of‑breed existing tools with sensible defaults. It is designed to work seamlessly with the [Web Loom frontend framework](https://webloomframework.com/docs/getting-started) but can be used independently. The framework prioritizes modular design, model‑driven development, and convention over configuration, while embracing a serverless‑first architecture. In the age of AI and agent‑based development, it provides a foundation that is easy to understand, extend, and generate code from.

---

## 2. Problem Statement

Developers today face a paradox of choice when building APIs: there are dozens of excellent libraries for routing, validation, databases, authentication, and email. Assembling them into a coherent, maintainable stack requires significant effort and domain knowledge. Moreover, teams often need to switch providers (e.g., from Neon to Turso, or from Hono to Fastify) as requirements evolve, leading to costly rewrites. **@web-loom/api** solves this by:

- Providing a **unified, modular core** that orchestrates pluggable components.
- Offering **sensible defaults** (Hono, Zod, Drizzle, Neon) that work out‑of‑the‑box for serverless environments.
- Allowing **easy swapping** of major components via a CLI, without changing application code.
- Embracing **model‑driven development** and **convention over configuration** to reduce boilerplate.
- Being **AI‑friendly**: APIs can be generated from high‑level models, and the framework’s structure is designed to be understood and manipulated by LLMs and agentic workflows.

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

- Building new validation, ORM, or email libraries – we leverage existing mature tools.
- Tying the framework to a specific cloud provider – adapters ensure portability.
- Reinventing the wheel: we are a meta‑framework, not a from‑scratch implementation.
- Supporting every possible database or API framework out‑of‑the‑box – we focus on a curated set of popular, modern choices (with extensibility for others).

---

## 5. Target Audience

- Developers building full‑stack applications with the Web Loom frontend framework.
- Teams who want a consistent, scalable backend without vendor lock‑in.
- Projects that anticipate switching database providers or API frameworks in the future.
- AI‑driven development workflows where APIs are generated or modified programmatically.

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

## 15. Future Considerations / Open Questions

- **Multi‑database support** – How to handle scenarios where an application needs both a relational DB (Neon) and a key‑value store (D1)? Possibly via a “composite” database adapter.
- **Real‑time** – Should the framework include built‑in WebSocket support (e.g., via Hono’s WebSocket helper)? This could be an optional module.
- **Plugin System** – Allow third‑party extensions to integrate deeply (e.g., a Stripe module that adds webhook routes and models).
- **Deployment Templates** – Provide pre‑built configurations for Vercel, Cloudflare Workers, AWS Lambda, etc.
- **Testing Utilities** – Generate test suites alongside routes, with mock database support.
- **Observability** – Built‑in logging, metrics, and tracing adapters (OpenTelemetry).

---

## 16. Success Metrics

- **Adoption** – Number of downloads, GitHub stars, and community‑contributed adapters.
- **Time to First API** – How quickly a developer can go from `create` to a deployed API.
- **Switching Ease** – Success rate of `switch` commands and developer feedback on the experience.
- **AI Integration** – Use of the CLI’s generation features and integration with AI coding assistants.

---

## 17. Conclusion

**@web‑loom/api** aims to be the go‑to meta‑framework for building REST APIs in the modern era. By assembling the best existing tools with sensible defaults, embracing modularity and serverless architectures, and being designed from the ground up with AI in mind, it empowers developers to focus on their application logic while retaining the flexibility to adapt as requirements change.
