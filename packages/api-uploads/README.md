# @web-loom/api-uploads

File upload handling for [Web Loom API](https://github.com/bretuobay/web-loom-api). Multipart/form-data parsing, MIME type and size validation, and pluggable storage backends: local filesystem, AWS S3, and Cloudflare R2.

## Installation

```bash
npm install @web-loom/api-uploads hono
```

For cloud storage backends:

```bash
# AWS S3
npm install @aws-sdk/client-s3

# Cloudflare R2 is accessed via the Workers binding — no extra package needed
```

## Usage

### Basic Upload

```typescript
import { fileUpload } from '@web-loom/api-uploads';
import { defineRoutes } from '@web-loom/api-core';

const routes = defineRoutes();

routes.post(
  '/uploads/avatar',
  fileUpload({
    field: 'avatar',
    maxSize: 5 * 1024 * 1024, // 5 MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  }),
  async (c) => {
    const file = c.get('uploadedFile'); // typed UploadedFile
    return c.json({ url: file.url, size: file.size });
  }
);
```

### Local Filesystem Storage

```typescript
import { fileUpload, LocalFileStore } from '@web-loom/api-uploads';

routes.post(
  '/uploads',
  fileUpload({
    field: 'file',
    maxSize: 10 * 1024 * 1024,
    store: new LocalFileStore({ dir: './uploads', baseUrl: '/files' }),
  }),
  async (c) => {
    const file = c.get('uploadedFile');
    return c.json({ url: file.url });
  }
);
```

### AWS S3

```typescript
import { fileUpload, S3FileStore } from '@web-loom/api-uploads';
import { S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-east-1' });

routes.post(
  '/uploads',
  fileUpload({
    field: 'file',
    maxSize: 50 * 1024 * 1024,
    store: new S3FileStore({
      client: s3,
      bucket: process.env.S3_BUCKET!,
      keyPrefix: 'uploads/',
      acl: 'public-read',
    }),
  }),
  handler
);
```

### Cloudflare R2

```typescript
import { fileUpload, R2FileStore } from '@web-loom/api-uploads';

// In a Cloudflare Worker:
routes.post(
  '/uploads',
  fileUpload({
    field: 'file',
    store: new R2FileStore({ bucket: env.MY_BUCKET, publicUrl: 'https://cdn.example.com' }),
  }),
  handler
);
```

## `fileUpload` Options

| Option         | Type        | Default    | Description            |
| -------------- | ----------- | ---------- | ---------------------- |
| `field`        | `string`    | `'file'`   | Form field name        |
| `maxSize`      | `number`    | `10MB`     | Max file size in bytes |
| `allowedTypes` | `string[]`  | all        | Allowed MIME types     |
| `store`        | `FileStore` | local temp | Storage backend        |
| `multiple`     | `boolean`   | `false`    | Allow multiple files   |

## `UploadedFile` Shape

```typescript
interface UploadedFile {
  url: string; // public URL
  key: string; // storage key
  filename: string; // original filename
  size: number; // bytes
  mimeType: string; // e.g. 'image/jpeg'
}
```

## License

MIT
