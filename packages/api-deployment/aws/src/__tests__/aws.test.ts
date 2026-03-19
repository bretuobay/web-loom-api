import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createLambdaHandler,
  detectEventSource,
  parseAPIGatewayV1Event,
  parseAPIGatewayV2Event,
  parseFunctionURLEvent,
  formatAPIGatewayV1Response,
  formatAPIGatewayV2Response,
  RDSProxyManager,
  createRDSProxyConfig,
  ColdStartOptimizer,
  CloudWatchLogger,
  formatForCloudWatch,
  resolveLayerPath,
  getLayerDependencies,
  createLayerConfig,
} from '../index';
import type {
  APIGatewayProxyEvent,
  APIGatewayV2Event,
  LambdaFunctionURLEvent,
  LambdaContext,
} from '../types';

// =========================================================================
// Test Helpers
// =========================================================================

function createMockContext(overrides?: Partial<LambdaContext>): LambdaContext {
  return {
    functionName: 'test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id-123',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2024/01/01/[$LATEST]abc123',
    getRemainingTimeInMillis: () => 30000,
    ...overrides,
  };
}

function createV1Event(overrides?: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/users',
    headers: { 'content-type': 'application/json' },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    body: null,
    isBase64Encoded: false,
    requestContext: {
      requestId: 'v1-req-id',
      stage: 'prod',
      identity: { sourceIp: '127.0.0.1', userAgent: 'test' },
    },
    resource: '/users',
    stageVariables: null,
    ...overrides,
  };
}

function createV2Event(overrides?: Partial<APIGatewayV2Event>): APIGatewayV2Event {
  return {
    version: '2.0',
    routeKey: 'GET /users',
    rawPath: '/users',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    isBase64Encoded: false,
    requestContext: {
      requestId: 'v2-req-id',
      http: {
        method: 'GET',
        path: '/users',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      stage: '$default',
      time: '2024-01-01T00:00:00Z',
      timeEpoch: 1704067200000,
    },
    ...overrides,
  };
}

function createFunctionURLEvent(
  overrides?: Partial<LambdaFunctionURLEvent>
): LambdaFunctionURLEvent {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/users',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    isBase64Encoded: false,
    requestContext: {
      requestId: 'furl-req-id',
      http: {
        method: 'GET',
        path: '/users',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      accountId: '123456789',
      apiId: 'abc123',
      domainName: 'abc123.lambda-url.us-east-1.on.aws',
      domainPrefix: 'abc123',
      time: '2024-01-01T00:00:00Z',
      timeEpoch: 1704067200000,
    },
    ...overrides,
  };
}

// =========================================================================
// Event Source Detection
// =========================================================================

describe('detectEventSource', () => {
  it('detects API Gateway v1 events', () => {
    const event = createV1Event();
    expect(detectEventSource(event)).toBe('api-gateway-v1');
  });

  it('detects API Gateway v2 events', () => {
    const event = createV2Event();
    expect(detectEventSource(event)).toBe('api-gateway-v2');
  });

  it('detects Function URL events', () => {
    const event = createFunctionURLEvent();
    expect(detectEventSource(event)).toBe('function-url');
  });
});

// =========================================================================
// API Gateway v1 Parsing
// =========================================================================

describe('parseAPIGatewayV1Event', () => {
  it('parses a basic GET request', () => {
    const event = createV1Event();
    const request = parseAPIGatewayV1Event(event);

    expect(request.method).toBe('GET');
    expect(new URL(request.url).pathname).toBe('/users');
  });

  it('parses query string parameters', () => {
    const event = createV1Event({
      queryStringParameters: { page: '1', limit: '20' },
    });
    const request = parseAPIGatewayV1Event(event);
    const url = new URL(request.url);

    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('20');
  });

  it('parses multi-value query string parameters', () => {
    const event = createV1Event({
      multiValueQueryStringParameters: { tag: ['a', 'b'] },
    });
    const request = parseAPIGatewayV1Event(event);
    const url = new URL(request.url);

    expect(url.searchParams.getAll('tag')).toEqual(['a', 'b']);
  });

  it('parses POST body', async () => {
    const event = createV1Event({
      httpMethod: 'POST',
      body: JSON.stringify({ name: 'test' }),
    });
    const request = parseAPIGatewayV1Event(event);

    expect(request.method).toBe('POST');
    const body = await request.json();
    expect(body).toEqual({ name: 'test' });
  });

  it('handles base64-encoded body', async () => {
    const original = 'hello world';
    const event = createV1Event({
      httpMethod: 'POST',
      body: Buffer.from(original).toString('base64'),
      isBase64Encoded: true,
    });
    const request = parseAPIGatewayV1Event(event);
    const text = await request.text();

    expect(text).toBe(original);
  });

  it('strips base path when configured', () => {
    const event = createV1Event({ path: '/prod/users' });
    const request = parseAPIGatewayV1Event(event, '/prod');

    expect(new URL(request.url).pathname).toBe('/users');
  });

  it('preserves headers', () => {
    const event = createV1Event({
      headers: { 'x-custom': 'value', authorization: 'Bearer token' },
    });
    const request = parseAPIGatewayV1Event(event);

    expect(request.headers.get('x-custom')).toBe('value');
    expect(request.headers.get('authorization')).toBe('Bearer token');
  });
});

// =========================================================================
// API Gateway v2 Parsing
// =========================================================================

describe('parseAPIGatewayV2Event', () => {
  it('parses a basic GET request', () => {
    const event = createV2Event();
    const request = parseAPIGatewayV2Event(event);

    expect(request.method).toBe('GET');
    expect(new URL(request.url).pathname).toBe('/users');
  });

  it('parses raw query string', () => {
    const event = createV2Event({ rawQueryString: 'page=1&limit=20' });
    const request = parseAPIGatewayV2Event(event);
    const url = new URL(request.url);

    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('20');
  });

  it('parses POST body', async () => {
    const event = createV2Event({
      requestContext: {
        ...createV2Event().requestContext,
        http: { ...createV2Event().requestContext.http, method: 'POST' },
      },
      body: JSON.stringify({ name: 'test' }),
    });
    const request = parseAPIGatewayV2Event(event);

    const body = await request.json();
    expect(body).toEqual({ name: 'test' });
  });

  it('strips base path', () => {
    const event = createV2Event({ rawPath: '/stage/users' });
    const request = parseAPIGatewayV2Event(event, '/stage');

    expect(new URL(request.url).pathname).toBe('/users');
  });
});

// =========================================================================
// Function URL Parsing
// =========================================================================

describe('parseFunctionURLEvent', () => {
  it('parses a basic GET request', () => {
    const event = createFunctionURLEvent();
    const request = parseFunctionURLEvent(event);

    expect(request.method).toBe('GET');
    expect(new URL(request.url).pathname).toBe('/users');
  });

  it('parses query string', () => {
    const event = createFunctionURLEvent({ rawQueryString: 'id=42' });
    const request = parseFunctionURLEvent(event);
    const url = new URL(request.url);

    expect(url.searchParams.get('id')).toBe('42');
  });
});

// =========================================================================
// Response Formatting
// =========================================================================

describe('formatAPIGatewayV1Response', () => {
  it('formats a JSON response', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const result = await formatAPIGatewayV1Response(response);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ ok: true });
    expect(result.isBase64Encoded).toBe(false);
  });

  it('base64-encodes binary responses', async () => {
    const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const response = new Response(binaryData, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
    const result = await formatAPIGatewayV1Response(response, ['image/*']);

    expect(result.isBase64Encoded).toBe(true);
    expect(Buffer.from(result.body, 'base64')).toEqual(binaryData);
  });

  it('handles set-cookie as multi-value headers', async () => {
    const headers = new Headers();
    headers.append('set-cookie', 'a=1');
    headers.append('set-cookie', 'b=2');
    const response = new Response('ok', { status: 200, headers });
    const result = await formatAPIGatewayV1Response(response);

    expect(result.multiValueHeaders?.['set-cookie']).toBeDefined();
  });
});

describe('formatAPIGatewayV2Response', () => {
  it('formats a JSON response', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const result = await formatAPIGatewayV2Response(response);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBeDefined();
    expect(JSON.parse(result.body!)).toEqual({ ok: true });
  });

  it('extracts cookies separately', async () => {
    const headers = new Headers();
    headers.append('set-cookie', 'session=abc');
    const response = new Response('ok', { status: 200, headers });
    const result = await formatAPIGatewayV2Response(response);

    expect(result.cookies).toContain('session=abc');
  });
});

// =========================================================================
// createLambdaHandler
// =========================================================================

describe('createLambdaHandler', () => {
  const mockApp = {
    handleRequest: vi.fn(),
  };

  beforeEach(() => {
    mockApp.handleRequest.mockReset();
  });

  it('handles API Gateway v1 events', async () => {
    mockApp.handleRequest.mockResolvedValue(
      new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const handler = createLambdaHandler(mockApp);
    const result = await handler(createV1Event(), createMockContext());

    expect(result.statusCode).toBe(200);
    expect(mockApp.handleRequest).toHaveBeenCalledOnce();
  });

  it('handles API Gateway v2 events', async () => {
    mockApp.handleRequest.mockResolvedValue(new Response('ok', { status: 200 }));

    const handler = createLambdaHandler(mockApp);
    const result = await handler(createV2Event(), createMockContext());

    expect(result.statusCode).toBe(200);
  });

  it('handles Function URL events', async () => {
    mockApp.handleRequest.mockResolvedValue(new Response('ok', { status: 200 }));

    const handler = createLambdaHandler(mockApp);
    const result = await handler(createFunctionURLEvent(), createMockContext());

    expect(result.statusCode).toBe(200);
  });

  it('returns 500 on unhandled errors', async () => {
    mockApp.handleRequest.mockRejectedValue(new Error('boom'));

    const handler = createLambdaHandler(mockApp);
    const result = await handler(createV1Event(), createMockContext());

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain('Internal server error');
  });

  it('handles warmup events', async () => {
    const handler = createLambdaHandler(mockApp, {
      warmupEvent: 'serverless-plugin-warmup',
    });
    const event = {
      ...createV1Event(),
      source: 'serverless-plugin-warmup',
    } as any;
    const result = await handler(event, createMockContext());

    expect(result.statusCode).toBe(200);
    expect(mockApp.handleRequest).not.toHaveBeenCalled();
  });

  it('strips base path from requests', async () => {
    mockApp.handleRequest.mockImplementation(async (req: Request) => {
      return new Response(new URL(req.url).pathname, { status: 200 });
    });

    const handler = createLambdaHandler(mockApp, { stripBasePath: '/prod' });
    const event = createV1Event({ path: '/prod/users' });
    const result = await handler(event, createMockContext());

    expect(result.body).toBe('/users');
  });
});

// =========================================================================
// RDS Proxy
// =========================================================================

describe('RDSProxyManager', () => {
  it('returns connection config', async () => {
    const manager = new RDSProxyManager({
      host: 'proxy.rds.amazonaws.com',
      port: 5432,
      database: 'mydb',
      username: 'admin',
      useIAMAuth: false,
      ssl: true,
    });

    const conn = await manager.getConnection();
    expect(conn.host).toBe('proxy.rds.amazonaws.com');
    expect(conn.port).toBe(5432);
    expect(conn.database).toBe('mydb');
    expect(conn.username).toBe('admin');
    expect(conn.ssl).toBe(true);
  });

  it('tracks active connections', async () => {
    const manager = new RDSProxyManager({
      host: 'proxy.rds.amazonaws.com',
      port: 5432,
      database: 'mydb',
      username: 'admin',
      useIAMAuth: false,
      ssl: true,
      maxConnections: 5,
    });

    await manager.getConnection();
    await manager.getConnection();
    expect(manager.getActiveConnectionCount()).toBe(2);

    manager.releaseConnection();
    expect(manager.getActiveConnectionCount()).toBe(1);
  });

  it('throws when connection limit is reached', async () => {
    const manager = new RDSProxyManager({
      host: 'proxy.rds.amazonaws.com',
      port: 5432,
      database: 'mydb',
      username: 'admin',
      useIAMAuth: false,
      ssl: true,
      maxConnections: 1,
    });

    await manager.getConnection();
    await expect(manager.getConnection()).rejects.toThrow('connection limit reached');
  });

  it('generates IAM auth token when enabled', async () => {
    const manager = new RDSProxyManager({
      host: 'proxy.rds.amazonaws.com',
      port: 5432,
      database: 'mydb',
      username: 'admin',
      useIAMAuth: true,
      region: 'us-west-2',
      ssl: true,
    });

    const conn = await manager.getConnection();
    expect(conn.password).toContain('iam-token://');
    expect(conn.password).toContain('us-west-2');
  });

  it('resets connections and token cache', async () => {
    const manager = new RDSProxyManager({
      host: 'proxy.rds.amazonaws.com',
      port: 5432,
      database: 'mydb',
      username: 'admin',
      useIAMAuth: false,
      ssl: true,
    });

    await manager.getConnection();
    expect(manager.getActiveConnectionCount()).toBe(1);

    manager.reset();
    expect(manager.getActiveConnectionCount()).toBe(0);
  });
});

describe('createRDSProxyConfig', () => {
  it('creates config from overrides', () => {
    const config = createRDSProxyConfig({
      host: 'my-proxy.rds.amazonaws.com',
      database: 'testdb',
      username: 'testuser',
    });

    expect(config.host).toBe('my-proxy.rds.amazonaws.com');
    expect(config.database).toBe('testdb');
    expect(config.username).toBe('testuser');
    expect(config.port).toBe(5432);
    expect(config.ssl).toBe(true);
  });

  it('throws when host is missing', () => {
    expect(() => createRDSProxyConfig({ database: 'db', username: 'user' })).toThrow(
      'RDS Proxy endpoint not configured'
    );
  });

  it('throws when database is missing', () => {
    expect(() =>
      createRDSProxyConfig({ host: 'proxy.rds.amazonaws.com', username: 'user' })
    ).toThrow('Database name not configured');
  });

  it('throws when username is missing', () => {
    expect(() => createRDSProxyConfig({ host: 'proxy.rds.amazonaws.com', database: 'db' })).toThrow(
      'Database username not configured'
    );
  });
});

// =========================================================================
// Cold Start Optimizer
// =========================================================================

describe('ColdStartOptimizer', () => {
  it('reports cold start before tracking', () => {
    const optimizer = new ColdStartOptimizer();
    expect(optimizer.isColdStart()).toBe(true);
    expect(optimizer.getColdStartDuration()).toBeNull();
  });

  it('tracks cold start duration', () => {
    const optimizer = new ColdStartOptimizer();
    optimizer.trackColdStart();

    expect(optimizer.isColdStart()).toBe(false);
    expect(optimizer.getColdStartDuration()).toBeGreaterThanOrEqual(0);
  });

  it('only tracks first cold start', () => {
    const optimizer = new ColdStartOptimizer();
    optimizer.trackColdStart();
    const first = optimizer.getColdStartDuration();

    // Second call should not change the duration
    optimizer.trackColdStart();
    expect(optimizer.getColdStartDuration()).toBe(first);
  });

  it('detects warmup events', () => {
    const optimizer = new ColdStartOptimizer();
    const warmupEvent = { source: 'serverless-plugin-warmup' } as any;

    expect(optimizer.isWarmupEvent(warmupEvent)).toBe(true);
  });

  it('detects scheduled warmup events', () => {
    const optimizer = new ColdStartOptimizer();
    const scheduledEvent = { 'detail-type': 'Scheduled Event' } as any;

    expect(optimizer.isWarmupEvent(scheduledEvent)).toBe(true);
  });

  it('does not flag normal events as warmup', () => {
    const optimizer = new ColdStartOptimizer();
    const normalEvent = createV1Event();

    expect(optimizer.isWarmupEvent(normalEvent)).toBe(false);
  });

  it('warmup wrapper returns early for warmup events', async () => {
    const optimizer = new ColdStartOptimizer();
    const innerHandler = vi.fn();
    const wrapped = optimizer.warmup(innerHandler);

    const result = await wrapped(
      { source: 'serverless-plugin-warmup' } as any,
      createMockContext()
    );

    expect(result.statusCode).toBe(200);
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it('warmup wrapper delegates normal events', async () => {
    const optimizer = new ColdStartOptimizer();
    const innerHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: 'ok',
    });
    const wrapped = optimizer.warmup(innerHandler);

    await wrapped(createV1Event(), createMockContext());
    expect(innerHandler).toHaveBeenCalledOnce();
  });
});

// =========================================================================
// CloudWatch Logger
// =========================================================================

describe('CloudWatchLogger', () => {
  it('outputs structured JSON to stdout', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new CloudWatchLogger();

    logger.info('test message');

    expect(writeSpy).toHaveBeenCalledOnce();
    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.level).toBe('INFO');
    expect(parsed.message).toBe('test message');
    expect(parsed.timestamp).toBeDefined();

    writeSpy.mockRestore();
  });

  it('includes request ID from Lambda context', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new CloudWatchLogger();
    logger.setLambdaContext(createMockContext());

    logger.info('with context');

    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.requestId).toBe('test-request-id-123');

    writeSpy.mockRestore();
  });

  it('includes additional context', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new CloudWatchLogger({ service: 'api' });

    logger.warn('warning', { userId: '42' });

    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.context.service).toBe('api');
    expect(parsed.context.userId).toBe('42');

    writeSpy.mockRestore();
  });

  it('supports all log levels', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new CloudWatchLogger();

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(writeSpy).toHaveBeenCalledTimes(4);
    const levels = writeSpy.mock.calls.map((call) => JSON.parse((call[0] as string).trim()).level);
    expect(levels).toEqual(['DEBUG', 'INFO', 'WARN', 'ERROR']);

    writeSpy.mockRestore();
  });

  it('clears context between invocations', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new CloudWatchLogger();
    logger.setLambdaContext(createMockContext());
    logger.clearContext();

    logger.info('no context');

    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.requestId).toBeUndefined();

    writeSpy.mockRestore();
  });
});

describe('formatForCloudWatch', () => {
  it('formats a complete log entry', () => {
    const entry = {
      level: 'INFO' as const,
      message: 'test',
      timestamp: '2024-01-01T00:00:00.000Z',
      requestId: 'req-123',
      traceId: 'trace-456',
      context: { key: 'value' },
    };

    const result = JSON.parse(formatForCloudWatch(entry));
    expect(result.level).toBe('INFO');
    expect(result.message).toBe('test');
    expect(result.requestId).toBe('req-123');
    expect(result.traceId).toBe('trace-456');
    expect(result.context.key).toBe('value');
  });

  it('omits undefined fields', () => {
    const entry = {
      level: 'ERROR' as const,
      message: 'error',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const result = JSON.parse(formatForCloudWatch(entry));
    expect(result.requestId).toBeUndefined();
    expect(result.traceId).toBeUndefined();
    expect(result.context).toBeUndefined();
  });
});

// =========================================================================
// Lambda Layers
// =========================================================================

describe('resolveLayerPath', () => {
  it('resolves layer module path', () => {
    expect(resolveLayerPath('lodash')).toBe('/opt/nodejs/node_modules/lodash');
  });

  it('resolves scoped package path', () => {
    expect(resolveLayerPath('@aws-sdk/client-s3')).toBe(
      '/opt/nodejs/node_modules/@aws-sdk/client-s3'
    );
  });
});

describe('getLayerDependencies', () => {
  it('returns empty array outside Lambda environment', () => {
    expect(getLayerDependencies()).toEqual([]);
  });
});

describe('createLayerConfig', () => {
  it('creates layer configs from definitions', () => {
    const configs = createLayerConfig([
      { name: 'deps', arn: 'arn:aws:lambda:us-east-1:123:layer:deps', version: 3 },
      { name: 'utils', arn: 'arn:aws:lambda:us-east-1:123:layer:utils' },
    ]);

    expect(configs).toHaveLength(2);
    expect(configs[0].name).toBe('deps');
    expect(configs[0].arn).toBe('arn:aws:lambda:us-east-1:123:layer:deps:3');
    expect(configs[0].version).toBe(3);
    expect(configs[1].arn).toBe('arn:aws:lambda:us-east-1:123:layer:utils');
    expect(configs[1].version).toBeUndefined();
  });
});
