# Deploy to AWS Lambda

Deploy your Web Loom API to AWS Lambda with API Gateway v2.

## Prerequisites

- An [AWS](https://aws.amazon.com) account
- AWS CLI configured: `aws configure`
- SAM CLI or CDK (optional but recommended)

## Step 1: Create the Shared App

```typescript
// src/shared/app.ts
import { createApp, defineConfig } from '@web-loom/api-core';
import './schema'; // register models

const config = defineConfig({
  database: { url: process.env.DATABASE_URL!, driver: 'pg', poolSize: 1 },
  features: { crud: true },
  openapi: { enabled: true },
  observability: { logging: { level: 'warn', format: 'json' } },
});

let appPromise: ReturnType<typeof createApp> | null = null;
export function getApp() {
  if (!appPromise) appPromise = createApp(config);
  return appPromise;
}
```

## Step 2: Create the Lambda Handler

```typescript
// src/lambda.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { getApp } from './shared/app';

const appPromise = getApp();

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
    body: event.body || undefined,
  });

  const response = await app.handleRequest(request);
  const body = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((v, k) => {
    headers[k] = v;
  });

  return { statusCode: response.status, headers, body, isBase64Encoded: false };
}
```

## Step 3: SAM Template

Create `template.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Timeout: 30
    MemorySize: 256
    Runtime: nodejs20.x
    Environment:
      Variables:
        DATABASE_URL: !Ref DatabaseUrl

Parameters:
  DatabaseUrl:
    Type: String
    NoEcho: true

Resources:
  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: dist/lambda.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            Path: /{proxy+}
            Method: ANY
      VpcConfig:
        SecurityGroupIds:
          - !Ref LambdaSecurityGroup
        SubnetIds:
          - !Ref PrivateSubnet1
          - !Ref PrivateSubnet2

Outputs:
  ApiUrl:
    Value: !Sub 'https://${ServerlessHttpApi}.execute-api.${AWS::Region}.amazonaws.com'
```

## Step 4: Build and Deploy

```bash
# Build
npm run build

# Deploy with SAM
sam build
sam deploy --guided
```

## Using Lambda Function URLs

Skip API Gateway entirely with Lambda Function URLs:

```yaml
Resources:
  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: dist/lambda.handler
      FunctionUrlConfig:
        AuthType: NONE
```

## Environment Variables

| Variable         | Required         | Description                  |
| ---------------- | ---------------- | ---------------------------- |
| `DATABASE_URL`   | Yes              | PostgreSQL connection string |
| `RESEND_API_KEY` | If email enabled | Resend API key               |

Set via SAM parameters, AWS Console, or CLI:

```bash
aws lambda update-function-configuration \
  --function-name my-api \
  --environment "Variables={DATABASE_URL=postgresql://...}"
```

## Optimizations

### Connection Reuse

Initialize the app outside the handler so the module scope persists across warm invocations:

```typescript
const appPromise = getApp(); // Module scope — reused across invocations

export async function handler(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;
  const app = await appPromise;
  // ...
}
```

### RDS Proxy

For high-concurrency Lambda functions, use RDS Proxy to pool database connections:

```yaml
DatabaseProxy:
  Type: AWS::RDS::DBProxy
  Properties:
    DBProxyName: my-api-proxy
    EngineFamily: POSTGRESQL
    Auth:
      - AuthScheme: SECRETS
        SecretArn: !Ref DatabaseSecret
```

### Provisioned Concurrency

Eliminate cold starts for latency-sensitive endpoints:

```yaml
ApiFunction:
  Properties:
    ProvisionedConcurrencyConfig:
      ProvisionedConcurrentExecutions: 5
```

### ARM64 Architecture

Use Graviton2 for better price-performance:

```yaml
ApiFunction:
  Properties:
    Architectures:
      - arm64
```

## Troubleshooting

**Cold starts > 100ms**: Enable provisioned concurrency, reduce bundle size, and ensure `poolSize: 1`.

**Connection limits**: Use RDS Proxy or Neon's serverless driver to avoid exhausting database connections.

**Timeout errors**: Increase the Lambda timeout and check database connectivity from your VPC.

See the [serverless example](../../examples/serverless) for a complete working deployment.
