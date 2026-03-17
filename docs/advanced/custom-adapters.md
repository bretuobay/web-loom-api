# Custom Adapter Development

Build your own adapters to integrate any database, auth provider, or email service with Web Loom API.

## Adapter Interfaces

Every adapter implements a standard interface from `@web-loom/api-core`. The Core Runtime verifies that your adapter implements all required methods at startup.

## Building a Database Adapter

Implement the `DatabaseAdapter` interface:

```typescript
import type { DatabaseAdapter, DatabaseConfig, ModelDefinition, QueryBuilder, Transaction } from "@web-loom/api-core";

export class MongoAdapter implements DatabaseAdapter {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(config: DatabaseConfig): Promise<void> {
    this.client = new MongoClient(config.url);
    await this.client.connect();
    this.db = this.client.db();
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.db?.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }


  async query<T>(sql: string, params: unknown[]): Promise<T[]> {
    // MongoDB doesn't use SQL, but the interface requires it
    throw new Error("Use the query builder instead of raw SQL with MongoDB");
  }

  async execute(sql: string, params: unknown[]): Promise<void> {
    throw new Error("Use the query builder instead of raw SQL with MongoDB");
  }

  async transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    const session = this.client!.startSession();
    try {
      session.startTransaction();
      const result = await callback(session as unknown as Transaction);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  select<T>(model: ModelDefinition): QueryBuilder<T> {
    const collection = this.db!.collection(model.tableName || model.name.toLowerCase());
    return new MongoQueryBuilder<T>(collection);
  }

  async insert<T>(model: ModelDefinition, data: T): Promise<T> {
    const collection = this.db!.collection(model.tableName || model.name.toLowerCase());
    const result = await collection.insertOne(data as Document);
    return { ...data, id: result.insertedId.toString() } as T;
  }

  async update<T>(model: ModelDefinition, id: string, data: Partial<T>): Promise<T> {
    const collection = this.db!.collection(model.tableName || model.name.toLowerCase());
    await collection.updateOne({ _id: new ObjectId(id) }, { $set: data });
    const updated = await collection.findOne({ _id: new ObjectId(id) });
    return updated as T;
  }

  async delete(model: ModelDefinition, id: string): Promise<void> {
    const collection = this.db!.collection(model.tableName || model.name.toLowerCase());
    await collection.deleteOne({ _id: new ObjectId(id) });
  }

  async createTable(model: ModelDefinition): Promise<void> {
    await this.db!.createCollection(model.tableName || model.name.toLowerCase());
  }

  async dropTable(model: ModelDefinition): Promise<void> {
    await this.db!.dropCollection(model.tableName || model.name.toLowerCase());
  }

  async migrateSchema(migration: Migration): Promise<void> {
    // MongoDB is schemaless — migrations are optional
  }
}
```

### Register Your Adapter

```typescript
import { defineConfig } from "@web-loom/api-core";
import { MongoAdapter } from "./adapters/mongo";

export default defineConfig({
  adapters: {
    database: new MongoAdapter(),
    // ...
  },
});
```

## Building an Auth Adapter

Implement the `AuthAdapter` interface:

```typescript
import type { AuthAdapter, Session, User, ApiKey } from "@web-loom/api-core";

export class CustomAuthAdapter implements AuthAdapter {
  async createSession(userId: string, attributes?: Record<string, unknown>): Promise<Session> {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    // Store session in your backend
    await this.store.set(`session:${token}`, { userId, expiresAt, attributes });
    return { id: token, userId, expiresAt, attributes: attributes || {} };
  }

  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    const session = await this.store.get(`session:${sessionId}`);
    if (!session || new Date(session.expiresAt) < new Date()) {
      return { valid: false };
    }
    const user = await this.getUser(session.userId);
    return { valid: true, session, user: user || undefined };
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await this.store.delete(`session:${sessionId}`);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Implement remaining methods...
}
```

## Building an Email Adapter

Implement the `EmailAdapter` interface:

```typescript
import type { EmailAdapter, EmailMessage, EmailResult } from "@web-loom/api-core";

export class SendGridAdapter implements EmailAdapter {
  constructor(private apiKey: string) {}

  async send(email: EmailMessage): Promise<EmailResult> {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: email.to }] }],
        from: { email: email.from },
        subject: email.subject,
        content: [
          { type: "text/plain", value: email.text },
          { type: "text/html", value: email.html },
        ],
      }),
    });

    return {
      id: response.headers.get("X-Message-Id") || "",
      success: response.ok,
      error: response.ok ? undefined : await response.text(),
    };
  }

  async sendBatch(emails: EmailMessage[]): Promise<EmailResult[]> {
    return Promise.all(emails.map((e) => this.send(e)));
  }

  async sendTemplate(templateId: string, to: string, variables: Record<string, unknown>): Promise<EmailResult> {
    // SendGrid template API
  }
}
```

## Testing Custom Adapters

Use the mock adapters from `@web-loom/api-testing` as a reference, and write tests against the interface contract:

```typescript
import { describe, it, expect } from "vitest";
import { MongoAdapter } from "./mongo-adapter";

describe("MongoAdapter", () => {
  const adapter = new MongoAdapter();

  beforeAll(async () => {
    await adapter.connect({ url: "mongodb://localhost:27017/test" });
  });

  afterAll(async () => {
    await adapter.disconnect();
  });

  it("inserts and retrieves a record", async () => {
    const model = { name: "User", tableName: "users", fields: [] };
    const user = await adapter.insert(model, { name: "Alice", email: "alice@test.com" });
    expect(user.id).toBeDefined();
  });

  it("reports health correctly", async () => {
    expect(await adapter.healthCheck()).toBe(true);
  });
});
```

## Interface Verification

The Core Runtime verifies adapter interfaces at startup. If your adapter is missing required methods, you'll see:

```
Error: Database adapter is missing required methods: transaction, healthCheck
```

Make sure every method in the interface is implemented, even if some throw "not supported" errors for your backend.
