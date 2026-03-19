# Custom Email Adapter

The only swappable adapter interface in Web Loom API is the **email adapter**. The database layer (Drizzle) and HTTP layer (Hono) are used directly — there is no abstraction to implement for those.

## `EmailAdapter` Interface

```typescript
interface EmailAdapter {
  send(message: EmailMessage): Promise<EmailResult>;
  sendBatch(messages: EmailMessage[]): Promise<EmailResult[]>;
}

interface EmailMessage {
  to: string | string[];
  from?: string;        // overrides the default from address
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

interface EmailResult {
  id: string;
  success: boolean;
  error?: string;
}
```

Import from `@web-loom/api-core`:

```typescript
import type { EmailAdapter, EmailMessage, EmailResult } from "@web-loom/api-core";
```

## Building a Custom Email Adapter

Implement both `send` and `sendBatch`. Here is a complete example using SendGrid:

```typescript
import type { EmailAdapter, EmailMessage, EmailResult } from "@web-loom/api-core";

export class SendGridAdapter implements EmailAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly defaultFrom: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          { to: Array.isArray(message.to)
              ? message.to.map((e) => ({ email: e }))
              : [{ email: message.to }] },
        ],
        from: { email: message.from ?? this.defaultFrom },
        reply_to: message.replyTo ? { email: message.replyTo } : undefined,
        subject: message.subject,
        content: [
          ...(message.text ? [{ type: "text/plain", value: message.text }] : []),
          ...(message.html ? [{ type: "text/html",  value: message.html }] : []),
        ],
      }),
    });

    return {
      id: response.headers.get("X-Message-Id") ?? crypto.randomUUID(),
      success: response.ok,
      error: response.ok ? undefined : await response.text(),
    };
  }

  async sendBatch(messages: EmailMessage[]): Promise<EmailResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }
}
```

## Registering the Adapter

Pass the instance to `defineConfig()`:

```typescript
import { defineConfig } from "@web-loom/api-core";
import { SendGridAdapter } from "./adapters/sendgrid";

export default defineConfig({
  database: { url: process.env.DATABASE_URL!, driver: "neon-serverless" },
  email: new SendGridAdapter(
    process.env.SENDGRID_API_KEY!,
    "noreply@example.com",
  ),
});
```

The adapter is injected as `c.var.email` in every request handler:

```typescript
app.post("/contact", async (c) => {
  await c.var.email!.send({
    to: "support@example.com",
    subject: "New contact",
    text: "Hello",
  });
  return c.body(null, 204);
});
```

Accessing `c.var.email` when no adapter is configured throws a `ConfigurationError`.

## Testing a Custom Adapter

Write unit tests against the interface directly:

```typescript
import { describe, it, expect, vi } from "vitest";
import { SendGridAdapter } from "./sendgrid";

describe("SendGridAdapter", () => {
  it("sends an email and returns success", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 202, headers: { "X-Message-Id": "abc123" } }),
    );

    const adapter = new SendGridAdapter("test-key", "noreply@example.com");
    const result = await adapter.send({
      to: "alice@example.com",
      subject: "Hello",
      text: "Hi",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe("abc123");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("returns error on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    const adapter = new SendGridAdapter("bad-key", "noreply@example.com");
    const result = await adapter.send({
      to: "alice@example.com",
      subject: "Test",
      text: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unauthorized");
  });
});
```

## Custom Hono Middleware

For extending request handling beyond email, write standard Hono middleware and register it globally or per-route:

```typescript
import type { MiddlewareHandler } from "hono";

// Global middleware (applied after createApp)
const app = await createApp(config);
app.hono.use("/*", myMiddleware);

// Per-route middleware (in route files)
const routes = defineRoutes();
routes.use("/admin/*", requireAdminMiddleware);
```

See the [Auth Middleware reference](../api-reference/middleware.md) for authentication extension points.
