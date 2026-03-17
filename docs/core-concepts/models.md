# Model-Driven Development

In Web Loom API, you define your data models once using `defineModel()`. The framework uses that single definition to generate database schemas, validation rules, CRUD routes, OpenAPI specs, and TypeScript types.

## Defining a Model

```typescript
import { defineModel } from "@web-loom/api-core";

export const User = defineModel({
  name: "User",
  tableName: "users",

  fields: [
    {
      name: "id",
      type: "uuid",
      database: { primaryKey: true, default: "gen_random_uuid()" },
    },
    {
      name: "name",
      type: "string",
      validation: { required: true, minLength: 1, maxLength: 100 },
    },
    {
      name: "email",
      type: "string",
      validation: { required: true, format: "email" },
      database: { unique: true },
    },
    {
      name: "role",
      type: "enum",
      validation: { enum: ["user", "admin", "moderator"] },
      default: "user",
    },
  ],

  options: {
    timestamps: true,
    crud: true,
  },
});
```

## Field Types

| Field Type | TypeScript Type | Postgres Type | Validation Options |
|------------|----------------|---------------|-------------------|
| `string` | `string` | `VARCHAR` / `TEXT` | `min`, `max`, `pattern`, `format` (`email`, `url`) |
| `number` | `number` | `INTEGER` / `DECIMAL` | `min`, `max`, `integer`, `positive` |
| `boolean` | `boolean` | `BOOLEAN` | — |
| `date` / `datetime` | `Date` | `TIMESTAMP` | `min`, `max` |
| `uuid` | `string` | `UUID` | UUID format auto-validated |
| `enum` | union type | `ENUM` / `VARCHAR` | `enum: string[]` |
| `json` | `object` | `JSONB` | Optional nested schema |
| `array` | `T[]` | `ARRAY` | `items` schema, `minLength`, `maxLength` |
| `decimal` | `Decimal` | `DECIMAL` | `precision`, `scale` |
| `text` | `string` | `TEXT` | `minLength`, `maxLength` |

## Field Configuration

Each field supports three configuration areas:

### Validation

Controls request validation via the Validation Adapter:

```typescript
{
  name: "email",
  type: "string",
  validation: {
    required: true,
    format: "email",
    maxLength: 255,
  },
}
```

### Database

Controls schema generation and query behavior:

```typescript
{
  name: "email",
  type: "string",
  database: {
    unique: true,
    index: true,
    select: false,  // excluded from default SELECT queries
    references: { model: "Organization", field: "id" },
  },
}
```

### Default Values

Static values, dynamic functions, or database-level defaults:

```typescript
// Static default
{ name: "role", type: "enum", default: "user" }

// Dynamic default
{ name: "createdAt", type: "datetime", default: () => new Date() }

// Database-level default
{ name: "id", type: "uuid", database: { default: "gen_random_uuid()" } }
```

## Relationships

Define how models relate to each other:

```typescript
export const Post = defineModel({
  name: "Post",
  tableName: "posts",
  fields: [/* ... */],

  relationships: [
    { type: "belongsTo", model: "User", foreignKey: "userId" },
    { type: "hasMany", model: "Comment", foreignKey: "postId" },
  ],
});
```

### Relationship Types

| Type | Description | Example |
|------|-------------|---------|
| `hasOne` | One-to-one, foreign key on the other model | User → Profile |
| `hasMany` | One-to-many, foreign key on the other model | User → Posts |
| `belongsTo` | Many-to-one, foreign key on this model | Post → User |
| `manyToMany` | Many-to-many via join table | Post ↔ Tags |

### Many-to-Many

```typescript
relationships: [
  {
    type: "manyToMany",
    model: "Tag",
    through: "post_tags",  // join table name
  },
]
```

### Cascade Delete

```typescript
relationships: [
  {
    type: "hasMany",
    model: "Comment",
    foreignKey: "postId",
    cascade: "cascade",    // "cascade" | "restrict" | "set-null"
  },
]
```

## Model Options

```typescript
options: {
  // Auto-manage createdAt / updatedAt fields
  timestamps: true,

  // Soft delete (sets deleted_at instead of removing rows)
  softDelete: true,

  // Optimistic locking (adds a version field)
  optimisticLocking: true,

  // CRUD route generation
  crud: true,
  // Or fine-grained control:
  crud: {
    list: { auth: false, cache: { ttl: 60, tags: ["posts"] } },
    read: { auth: false },
    create: { auth: true },
    update: { auth: "owner" },
    delete: { auth: "admin" },
  },

  // Field-level permissions
  permissions: {
    password: { read: false, write: ["self"] },
    role: { write: ["admin"] },
  },
}
```

## Using Model Schemas in Routes

Models expose a `.schema` helper for picking fields in validation:

```typescript
router.post("/api/users", {
  validation: {
    body: User.schema.pick("name", "email", "password"),
  },
  handler: async (ctx) => {
    // ctx.body is typed as { name: string; email: string; password: string }
    const user = await ctx.db.insert(User, ctx.body);
    return ctx.json({ user }, 201);
  },
});
```

Partial schemas for updates:

```typescript
router.put("/api/users/:id", {
  validation: {
    body: User.schema.pick("name", "email").partial(),
  },
  handler: async (ctx) => {
    const user = await ctx.db.update(User, ctx.params.id, ctx.body);
    return ctx.json({ user });
  },
});
```

## Computed Fields

Fields derived from other fields, not stored in the database:

```typescript
{
  name: "slug",
  type: "string",
  computed: true,
  // Computed from title on serialization
}
```

Computed fields are read-only in API responses and excluded from create/update requests.

## Model Registry

All models are automatically registered with the Model Registry when discovered in `src/models/`. The registry is used by:

- **CRUD Generator** — generates REST endpoints
- **OpenAPI Generator** — generates API specification
- **Client Generator** — generates typed frontend clients
- **Type Generator** — generates TypeScript interfaces

You can also register models programmatically:

```typescript
const app = await createApp(config);
app.getModelRegistry().register(MyModel);
```

## Code Generation from Models

```bash
# Generate CRUD routes
npx webloom generate crud User

# Generate OpenAPI spec
npx webloom generate openapi --output=./openapi.json

# Generate TypeScript client
npx webloom generate client --output=./client

# Generate TypeScript types
npx webloom generate types
```

## Serialization

Models handle JSON serialization with special type support:

- `Date` → ISO 8601 string
- `BigInt` → string (avoids JavaScript precision loss)
- `Decimal` → string
- `Buffer` → base64 string

Round-trip serialization is guaranteed: `deserialize(serialize(model)) === model`.
