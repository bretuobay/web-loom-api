# @web-loom/api-deployment-aws

AWS Lambda deployment adapter for [Web Loom API](https://github.com/bretuobay/web-loom-api). Supports API Gateway V1/V2, Lambda Function URLs, RDS Proxy connection management, CloudWatch logging, and cold-start optimization.

## Installation

```bash
npm install @web-loom/api-deployment-aws @web-loom/api-core
```

```bash
npm install --save-dev @types/aws-lambda
```

## Usage

### API Gateway V2 / Function URL

```typescript
// src/handler.ts
import { createLambdaHandler } from '@web-loom/api-deployment-aws';
import type { LambdaHandler } from '@web-loom/api-deployment-aws';
import { createApp } from '@web-loom/api-core';
import config from '../webloom.config';

// Initialize once at module scope for warm invocation reuse
const appPromise = createApp(config);
let _handler: LambdaHandler | null = null;

export const handler: LambdaHandler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (!_handler) {
    const app = await appPromise;
    _handler = createLambdaHandler(app);
  }

  return _handler(event, context);
};
```

### Manual Pattern (Full Control)

```typescript
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';

const appPromise = createApp(config);

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> {
  context.callbackWaitsForEmptyEventLoop = false;

  const app = await appPromise;
  const url = `https://${event.requestContext.domainName}${event.rawPath}${
    event.rawQueryString ? `?${event.rawQueryString}` : ''
  }`;

  const request = new Request(url, {
    method: event.requestContext.http.method,
    headers: new Headers(event.headers as Record<string, string>),
    body: event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : event.body
      : undefined,
  });

  const response = await app.handleRequest(request);
  const body = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return { statusCode: response.status, headers, body, isBase64Encoded: false };
}
```

## `createLambdaHandler(app, options?)`

| Parameter                  | Type          | Description                               |
| -------------------------- | ------------- | ----------------------------------------- |
| `app`                      | `Application` | Web Loom application instance             |
| `options.binaryMediaTypes` | `string[]`    | MIME types to return as base64            |
| `options.stripBasePath`    | `string`      | Strip a path prefix (e.g. `/v1`)          |
| `options.warmupEvent`      | `string`      | Custom event type to treat as warmup ping |

**Returns:** `LambdaHandler` — compatible with API Gateway V1, V2, and Function URLs.

## Event Auto-Detection

The handler automatically detects the event source:

| Source              | Detection                           |
| ------------------- | ----------------------------------- |
| API Gateway V2      | `event.version === '2.0'`           |
| API Gateway V1      | `event.httpMethod` present          |
| Lambda Function URL | `event.requestContext.http` present |

## RDS Proxy

When using Amazon RDS Proxy for database connection pooling:

```typescript
import { createLambdaHandler, createRDSProxyConfig } from '@web-loom/api-deployment-aws';

const rdsConfig = createRDSProxyConfig({
  endpoint: process.env.RDS_PROXY_ENDPOINT!,
  database: 'mydb',
  region: 'us-east-1',
});
```

## CloudWatch Logging

```typescript
import { CloudWatchLogger } from '@web-loom/api-deployment-aws';

const logger = new CloudWatchLogger({ logGroup: '/my-api/prod' });
logger.info('Request received', { requestId: context.awsRequestId });
```

## Cold Start Optimization

- **Module-scope init** — `const appPromise = createApp(config)` runs once at container start
- **Lazy handler** — cache the `LambdaHandler` reference after first init
- **`callbackWaitsForEmptyEventLoop = false`** — don't hold the Lambda container open after responding
- **Driver choice** — use `driver: 'pg'` with RDS Proxy for connection reuse, or `driver: 'neon-serverless'` for HTTP

## `serverless.yml` Template

```yaml
functions:
  api:
    handler: dist/handler.handler
    events:
      - httpApi: '*'
    environment:
      DATABASE_URL: ${env:DATABASE_URL}
    memorySize: 512
    timeout: 30
```

## License

MIT
