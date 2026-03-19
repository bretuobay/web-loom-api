/**
 * TestClient - HTTP test client with authentication and assertions
 */
import type {
  HttpMethod,
  RequestHandler,
  RequestInterceptor,
  RequestOptions,
  ResponseInterceptor,
  SchemaValidator,
  TestResponse,
  TestResponseData,
} from './types';

function createTestResponse(data: TestResponseData): TestResponse {
  const response: TestResponse = {
    status: data.status,
    headers: data.headers,
    body: data.body,

    json<T = unknown>(): T {
      try {
        return JSON.parse(data.body) as T;
      } catch {
        throw new Error(`Response body is not valid JSON: ${data.body.slice(0, 100)}`);
      }
    },

    expectStatus(code: number): TestResponse {
      if (data.status !== code) {
        throw new Error(`Expected status ${code}, got ${data.status}`);
      }
      return response;
    },

    expectHeader(name: string, value: string): TestResponse {
      const headerVal = data.headers[name.toLowerCase()];
      if (headerVal !== value) {
        throw new Error(`Expected header "${name}" to be "${value}", got "${headerVal}"`);
      }
      return response;
    },

    expectBodyContains(text: string): TestResponse {
      if (!data.body.includes(text)) {
        throw new Error(`Expected body to contain "${text}"`);
      }
      return response;
    },

    expectJsonMatch(partial: Record<string, unknown>): TestResponse {
      const json = response.json<Record<string, unknown>>();
      for (const [key, value] of Object.entries(partial)) {
        if (JSON.stringify(json[key]) !== JSON.stringify(value)) {
          throw new Error(
            `Expected JSON key "${key}" to be ${JSON.stringify(value)}, got ${JSON.stringify(json[key])}`
          );
        }
      }
      return response;
    },

    expectSchema(schema: SchemaValidator): TestResponse {
      const json = response.json();
      const result = schema.validate(json);
      if (!result.success) {
        throw new Error(
          `Schema validation failed: ${result.errors?.join(', ') ?? 'unknown error'}`
        );
      }
      return response;
    },
  };

  return response;
}

export class TestClient {
  private handler: RequestHandler;
  private defaultHeaders: Record<string, string>;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(handlerOrBaseUrl: RequestHandler | string) {
    if (typeof handlerOrBaseUrl === 'string') {
      this.handler = createFetchHandler(handlerOrBaseUrl);
    } else {
      this.handler = handlerOrBaseUrl;
    }
    this.defaultHeaders = {};
  }

  /** Create a new TestClient with session authentication */
  withSession(sessionId: string): TestClient {
    return this.withHeaders({ cookie: `session=${sessionId}` });
  }

  /** Create a new TestClient with API key authentication */
  withApiKey(key: string): TestClient {
    return this.withHeaders({ 'x-api-key': key });
  }

  /** Create a new TestClient with Bearer token authentication */
  withBearerToken(token: string): TestClient {
    return this.withHeaders({ authorization: `Bearer ${token}` });
  }

  /** Create a new TestClient with additional default headers */
  withHeaders(headers: Record<string, string>): TestClient {
    const clone = new TestClient(this.handler);
    clone.defaultHeaders = { ...this.defaultHeaders, ...headers };
    clone.requestInterceptors = [...this.requestInterceptors];
    clone.responseInterceptors = [...this.responseInterceptors];
    return clone;
  }

  /** Register a request interceptor */
  onRequest(fn: RequestInterceptor): void {
    this.requestInterceptors.push(fn);
  }

  /** Register a response interceptor */
  onResponse(fn: ResponseInterceptor): void {
    this.responseInterceptors.push(fn);
  }

  async get(path: string, options?: RequestOptions): Promise<TestResponse> {
    return this.request('GET', path, undefined, options);
  }

  async post(path: string, body?: unknown, options?: RequestOptions): Promise<TestResponse> {
    return this.request('POST', path, body, options);
  }

  async put(path: string, body?: unknown, options?: RequestOptions): Promise<TestResponse> {
    return this.request('PUT', path, body, options);
  }

  async patch(path: string, body?: unknown, options?: RequestOptions): Promise<TestResponse> {
    return this.request('PATCH', path, body, options);
  }

  async delete(path: string, options?: RequestOptions): Promise<TestResponse> {
    return this.request('DELETE', path, undefined, options);
  }

  private async request(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<TestResponse> {
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options?.headers,
    };

    if (body !== undefined && !headers['content-type']) {
      headers['content-type'] = 'application/json';
    }

    // Run request interceptors
    for (const interceptor of this.requestInterceptors) {
      await interceptor({ method, path, headers, body });
    }

    // Build URL with query params
    let url = path;
    if (options?.query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(options.query)) {
        params.set(k, String(v));
      }
      url = `${path}?${params.toString()}`;
    }

    const rawBody = body !== undefined ? JSON.stringify(body) : undefined;

    const reqObj: {
      method: HttpMethod;
      url: string;
      headers: Record<string, string>;
      body?: string;
    } = {
      method,
      url,
      headers,
    };
    if (rawBody !== undefined) reqObj.body = rawBody;
    const responseData = await this.handler(reqObj);

    // Run response interceptors
    for (const interceptor of this.responseInterceptors) {
      await interceptor(responseData);
    }

    return createTestResponse(responseData);
  }
}

function createFetchHandler(baseUrl: string): RequestHandler {
  return async (req) => {
    const url = `${baseUrl.replace(/\/$/, '')}${req.url}`;
    const fetchInit: RequestInit = {
      method: req.method,
      headers: req.headers,
    };
    if (req.body !== undefined) fetchInit.body = req.body;
    const response = await fetch(url, fetchInit);

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      status: response.status,
      headers,
      body: await response.text(),
    };
  };
}
