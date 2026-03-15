import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CRUDGenerator } from '../crud-generator';
import type {
  ModelDefinition,
  DatabaseAdapter,
  ValidationAdapter,
  RequestContext,
  QueryBuilder,
} from '@web-loom/api-core';

// Mock database adapter
class MockDatabaseAdapter implements Partial<DatabaseAdapter> {
  selectFn = vi.fn();
  insertFn = vi.fn();
  updateFn = vi.fn();
  deleteFn = vi.fn();
  transactionFn = vi.fn();

  select<T>(model: ModelDefinition): QueryBuilder<T> {
    const mockQueryBuilder = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      execute: this.selectFn,
    };
    return mockQueryBuilder as unknown as QueryBuilder<T>;
  }

  async insert<T>(_model: ModelDefinition, data: T): Promise<T> {
    return this.insertFn(data);
  }

  async update<T>(_model: ModelDefinition, id: string, data: Partial<T>): Promise<T> {
    return this.updateFn(id, data);
  }

  async delete(_model: ModelDefinition, id: string): Promise<void> {
    return this.deleteFn(id);
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    // Mock transaction - just execute the callback
    return this.transactionFn(callback) || callback();
  }
}

// Mock validation adapter (not used in basic CRUD yet)
class MockValidationAdapter implements Partial<ValidationAdapter> {}

describe('CRUDGenerator', () => {
  let generator: CRUDGenerator;
  let database: MockDatabaseAdapter;
  let model: ModelDefinition;

  beforeEach(() => {
    database = new MockDatabaseAdapter();
    generator = new CRUDGenerator(database as DatabaseAdapter);

    model = {
      name: 'User',
      tableName: 'users',
      fields: [
        { name: 'id', type: 'uuid', database: { primaryKey: true } },
        { name: 'name', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
      ],
    };
  });

  describe('generate', () => {
    it('should generate all 6 CRUD endpoints', () => {
      const routes = generator.generate(model, { basePath: '/users' });

      expect(routes).toHaveLength(6);
      
      const methods = routes.map(r => r.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('PATCH');
      expect(methods).toContain('DELETE');
      
      // GET appears twice (list and get by id)
      expect(methods.filter(m => m === 'GET')).toHaveLength(2);
    });

    it('should generate routes with correct paths', () => {
      const routes = generator.generate(model, { basePath: '/users' });

      const paths = routes.map(r => r.path);
      expect(paths).toContain('/users');
      expect(paths).toContain('/users/:id');
    });

    it('should generate routes with handler functions', () => {
      const routes = generator.generate(model, { basePath: '/users' });

      routes.forEach(route => {
        expect(route.handler).toBeTypeOf('function');
      });
    });
  });

  describe('List endpoint (GET /resource)', () => {
    it('should return paginated results', async () => {
      const mockUsers = [
        { id: '1', name: 'John', email: 'john@example.com' },
        { id: '2', name: 'Jane', email: 'jane@example.com' },
      ];
      database.selectFn.mockResolvedValue(mockUsers);

      const routes = generator.generate(model, { basePath: '/users' });
      const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users?page=1&limit=20'),
        params: {},
        query: { page: '1', limit: '20' },
        body: null,
        metadata: new Map(),
      };

      const response = await listRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual(mockUsers);
      expect(body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
      });
    });

    it('should use default page size', async () => {
      database.selectFn.mockResolvedValue([]);

      const routes = generator.generate(model, {
        basePath: '/users',
        defaultPageSize: 10,
      });
      const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users'),
        params: {},
        query: {},
        body: null,
        metadata: new Map(),
      };

      const response = await listRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(body.pagination.limit).toBe(10);
    });

    it('should enforce max page size', async () => {
      database.selectFn.mockResolvedValue([]);

      const routes = generator.generate(model, {
        basePath: '/users',
        maxPageSize: 50,
      });
      const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users?limit=1000'),
        params: {},
        query: { limit: '1000' },
        body: null,
        metadata: new Map(),
      };

      const response = await listRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(body.pagination.limit).toBe(50);
    });
  });

  describe('Create endpoint (POST /resource)', () => {
    it('should create a new record', async () => {
      const newUser = { name: 'John', email: 'john@example.com' };
      const createdUser = { id: '1', ...newUser };
      database.insertFn.mockResolvedValue(createdUser);

      const routes = generator.generate(model, { basePath: '/users' });
      const createRoute = routes.find(r => r.method === 'POST');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users', { method: 'POST' }),
        params: {},
        query: {},
        body: newUser,
        metadata: new Map(),
      };

      const response = await createRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body).toEqual(createdUser);
      expect(database.insertFn).toHaveBeenCalledWith(newUser);
    });
  });

  describe('Get endpoint (GET /resource/:id)', () => {
    it('should return a single record', async () => {
      const user = { id: '1', name: 'John', email: 'john@example.com' };
      database.selectFn.mockResolvedValue([user]);

      const routes = generator.generate(model, { basePath: '/users' });
      const getRoute = routes.find(r => r.method === 'GET' && r.path === '/users/:id');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/1'),
        params: { id: '1' },
        query: {},
        body: null,
        metadata: new Map(),
      };

      const response = await getRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(user);
    });

    it('should return 404 when record not found', async () => {
      database.selectFn.mockResolvedValue([]);

      const routes = generator.generate(model, { basePath: '/users' });
      const getRoute = routes.find(r => r.method === 'GET' && r.path === '/users/:id');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/999'),
        params: { id: '999' },
        query: {},
        body: null,
        metadata: new Map(),
      };

      const response = await getRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Not Found');
    });
  });

  describe('Update endpoints (PUT/PATCH /resource/:id)', () => {
    it('should update a record with PUT', async () => {
      const updatedUser = { id: '1', name: 'Jane', email: 'jane@example.com' };
      database.updateFn.mockResolvedValue(updatedUser);

      const routes = generator.generate(model, { basePath: '/users' });
      const updateRoute = routes.find(r => r.method === 'PUT');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/1', { method: 'PUT' }),
        params: { id: '1' },
        query: {},
        body: { name: 'Jane' },
        metadata: new Map(),
      };

      const response = await updateRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(updatedUser);
      expect(database.updateFn).toHaveBeenCalledWith('1', { name: 'Jane' });
    });

    it('should update a record with PATCH', async () => {
      const updatedUser = { id: '1', name: 'Jane', email: 'john@example.com' };
      database.updateFn.mockResolvedValue(updatedUser);

      const routes = generator.generate(model, { basePath: '/users' });
      const patchRoute = routes.find(r => r.method === 'PATCH');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/1', { method: 'PATCH' }),
        params: { id: '1' },
        query: {},
        body: { name: 'Jane' },
        metadata: new Map(),
      };

      const response = await patchRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(updatedUser);
    });

    it('should return 404 when updating non-existent record', async () => {
      database.updateFn.mockRejectedValue(new Error('Record with id 999 not found'));

      const routes = generator.generate(model, { basePath: '/users' });
      const updateRoute = routes.find(r => r.method === 'PUT');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/999', { method: 'PUT' }),
        params: { id: '999' },
        query: {},
        body: { name: 'Jane' },
        metadata: new Map(),
      };

      const response = await updateRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Not Found');
    });
  });

  describe('Delete endpoint (DELETE /resource/:id)', () => {
    it('should delete a record', async () => {
      database.deleteFn.mockResolvedValue(undefined);

      const routes = generator.generate(model, { basePath: '/users' });
      const deleteRoute = routes.find(r => r.method === 'DELETE');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/1', { method: 'DELETE' }),
        params: { id: '1' },
        query: {},
        body: null,
        metadata: new Map(),
      };

      const response = await deleteRoute!.handler(ctx, vi.fn());

      expect(response.status).toBe(204);
      expect(database.deleteFn).toHaveBeenCalledWith('1');
    });

    it('should return 404 when deleting non-existent record', async () => {
      database.deleteFn.mockRejectedValue(new Error('Record with id 999 not found'));

      const routes = generator.generate(model, { basePath: '/users' });
      const deleteRoute = routes.find(r => r.method === 'DELETE');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/999', { method: 'DELETE' }),
        params: { id: '999' },
        query: {},
        body: null,
        metadata: new Map(),
      };

      const response = await deleteRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Not Found');
    });
  });

  describe('List endpoint enhancements', () => {
    describe('Filtering', () => {
      it('should apply equality filters', async () => {
        const mockUsers = [{ id: '1', name: 'John', email: 'john@example.com' }];
        database.selectFn.mockResolvedValue(mockUsers);

        const routes = generator.generate(model, {
          basePath: '/users',
          enableFiltering: true,
        });
        const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

        const ctx: RequestContext = {
          request: new Request('http://localhost/users?filter[name][eq]=John'),
          params: {},
          query: {
            filter: {
              name: { eq: 'John' },
            },
          },
          body: null,
          metadata: new Map(),
        };

        const response = await listRoute!.handler(ctx, vi.fn());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data).toEqual(mockUsers);
      });

      it('should apply range filters', async () => {
        const mockUsers = [{ id: '1', name: 'John', age: 25 }];
        database.selectFn.mockResolvedValue(mockUsers);

        const routes = generator.generate(model, {
          basePath: '/users',
          enableFiltering: true,
        });
        const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

        const ctx: RequestContext = {
          request: new Request('http://localhost/users?filter[age][gte]=18'),
          params: {},
          query: {
            filter: {
              age: { gte: '18' },
            },
          },
          body: null,
          metadata: new Map(),
        };

        const response = await listRoute!.handler(ctx, vi.fn());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data).toEqual(mockUsers);
      });
    });

    describe('Sorting', () => {
      it('should apply ascending sort', async () => {
        const mockUsers = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }];
        database.selectFn.mockResolvedValue(mockUsers);

        const routes = generator.generate(model, {
          basePath: '/users',
          enableSorting: true,
        });
        const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

        const ctx: RequestContext = {
          request: new Request('http://localhost/users?sort=name'),
          params: {},
          query: { sort: 'name' },
          body: null,
          metadata: new Map(),
        };

        const response = await listRoute!.handler(ctx, vi.fn());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data).toEqual(mockUsers);
      });

      it('should apply descending sort', async () => {
        const mockUsers = [{ id: '2', name: 'Bob' }, { id: '1', name: 'Alice' }];
        database.selectFn.mockResolvedValue(mockUsers);

        const routes = generator.generate(model, {
          basePath: '/users',
          enableSorting: true,
        });
        const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

        const ctx: RequestContext = {
          request: new Request('http://localhost/users?sort=-createdAt'),
          params: {},
          query: { sort: '-createdAt' },
          body: null,
          metadata: new Map(),
        };

        const response = await listRoute!.handler(ctx, vi.fn());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data).toEqual(mockUsers);
      });

      it('should apply multiple sorts', async () => {
        const mockUsers = [{ id: '1', name: 'Alice' }];
        database.selectFn.mockResolvedValue(mockUsers);

        const routes = generator.generate(model, {
          basePath: '/users',
          enableSorting: true,
        });
        const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

        const ctx: RequestContext = {
          request: new Request('http://localhost/users?sort=name,-createdAt'),
          params: {},
          query: { sort: 'name,-createdAt' },
          body: null,
          metadata: new Map(),
        };

        const response = await listRoute!.handler(ctx, vi.fn());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data).toEqual(mockUsers);
      });
    });

    describe('Field selection', () => {
      it('should select specific fields', async () => {
        const mockUsers = [
          { id: '1', name: 'John', email: 'john@example.com', password: 'secret' },
        ];
        database.selectFn.mockResolvedValue(mockUsers);

        const routes = generator.generate(model, {
          basePath: '/users',
          enableFieldSelection: true,
        });
        const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

        const ctx: RequestContext = {
          request: new Request('http://localhost/users?fields=id,name,email'),
          params: {},
          query: { fields: 'id,name,email' },
          body: null,
          metadata: new Map(),
        };

        const response = await listRoute!.handler(ctx, vi.fn());
        const body = await response.json();

        expect(body.data[0]).toEqual({
          id: '1',
          name: 'John',
          email: 'john@example.com',
        });
        expect(body.data[0].password).toBeUndefined();
      });

      it('should exclude fields', async () => {
        const mockUsers = [
          { id: '1', name: 'John', email: 'john@example.com', password: 'secret' },
        ];
        database.selectFn.mockResolvedValue(mockUsers);

        const routes = generator.generate(model, {
          basePath: '/users',
          excludeFields: ['password'],
        });
        const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

        const ctx: RequestContext = {
          request: new Request('http://localhost/users'),
          params: {},
          query: {},
          body: null,
          metadata: new Map(),
        };

        const response = await listRoute!.handler(ctx, vi.fn());
        const body = await response.json();

        expect(body.data[0].password).toBeUndefined();
      });
    });

    describe('Search', () => {
      it('should search across specified fields', async () => {
        const mockUsers = [{ id: '1', name: 'John', email: 'john@example.com' }];
        database.selectFn.mockResolvedValue(mockUsers);

        const routes = generator.generate(model, {
          basePath: '/users',
          enableSearch: true,
          searchFields: ['name', 'email'],
        });
        const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

        const ctx: RequestContext = {
          request: new Request('http://localhost/users?search=john'),
          params: {},
          query: { search: 'john' },
          body: null,
          metadata: new Map(),
        };

        const response = await listRoute!.handler(ctx, vi.fn());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data).toEqual(mockUsers);
      });
    });

    describe('Cursor-based pagination', () => {
      it('should use cursor pagination when enabled', async () => {
        const mockUsers = [
          { id: '2', name: 'Jane', email: 'jane@example.com' },
          { id: '3', name: 'Bob', email: 'bob@example.com' },
        ];
        database.selectFn.mockResolvedValue(mockUsers);

        const routes = generator.generate(model, {
          basePath: '/users',
          enableCursorPagination: true,
        });
        const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

        const cursor = Buffer.from('1').toString('base64');
        const ctx: RequestContext = {
          request: new Request(`http://localhost/users?cursor=${cursor}&limit=20`),
          params: {},
          query: { cursor, limit: '20' },
          body: null,
          metadata: new Map(),
        };

        const response = await listRoute!.handler(ctx, vi.fn());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.pagination.cursor).toBe(cursor);
        expect(body.pagination.hasNextPage).toBe(false);
      });

      it('should indicate next page when more results exist', async () => {
        const mockUsers = [
          { id: '2', name: 'Jane', email: 'jane@example.com' },
          { id: '3', name: 'Bob', email: 'bob@example.com' },
          { id: '4', name: 'Alice', email: 'alice@example.com' },
        ];
        database.selectFn.mockResolvedValue(mockUsers);

        const routes = generator.generate(model, {
          basePath: '/users',
          enableCursorPagination: true,
        });
        const listRoute = routes.find(r => r.method === 'GET' && r.path === '/users');

        const cursor = Buffer.from('1').toString('base64');
        const ctx: RequestContext = {
          request: new Request(`http://localhost/users?cursor=${cursor}&limit=2`),
          params: {},
          query: { cursor, limit: '2' },
          body: null,
          metadata: new Map(),
        };

        const response = await listRoute!.handler(ctx, vi.fn());
        const body = await response.json();

        expect(body.pagination.hasNextPage).toBe(true);
        expect(body.pagination.nextCursor).toBeDefined();
        expect(body.data).toHaveLength(2);
      });
    });
  });

  describe('Create endpoint enhancements', () => {
    it('should apply default values', async () => {
      const modelWithDefaults: ModelDefinition = {
        name: 'User',
        tableName: 'users',
        fields: [
          { name: 'id', type: 'uuid', database: { primaryKey: true } },
          { name: 'name', type: 'string', required: true },
          { name: 'status', type: 'string', default: 'active' },
        ],
      };

      const createdUser = { id: '1', name: 'John', status: 'active' };
      database.insertFn.mockResolvedValue(createdUser);

      const routes = generator.generate(modelWithDefaults, { basePath: '/users' });
      const createRoute = routes.find(r => r.method === 'POST');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users', { method: 'POST' }),
        params: {},
        query: {},
        body: { name: 'John' }, // status not provided
        metadata: new Map(),
      };

      const response = await createRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.status).toBe('active');
    });

    it('should generate timestamps on create', async () => {
      const modelWithTimestamps: ModelDefinition = {
        name: 'User',
        tableName: 'users',
        fields: [
          { name: 'id', type: 'uuid', database: { primaryKey: true } },
          { name: 'name', type: 'string', required: true },
          { name: 'createdAt', type: 'date' },
          { name: 'updatedAt', type: 'date' },
        ],
        options: { timestamps: true },
      };

      database.insertFn.mockImplementation((data: any) => ({
        id: '1',
        ...data,
      }));

      const routes = generator.generate(modelWithTimestamps, { basePath: '/users' });
      const createRoute = routes.find(r => r.method === 'POST');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users', { method: 'POST' }),
        params: {},
        query: {},
        body: { name: 'John' },
        metadata: new Map(),
      };

      await createRoute!.handler(ctx, vi.fn());

      // Verify timestamps were added
      expect(database.insertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })
      );
    });
  });

  describe('Get endpoint enhancements', () => {
    it('should support field selection', async () => {
      const user = { id: '1', name: 'John', email: 'john@example.com', password: 'secret' };
      database.selectFn.mockResolvedValue([user]);

      const routes = generator.generate(model, {
        basePath: '/users',
        enableFieldSelection: true,
      });
      const getRoute = routes.find(r => r.method === 'GET' && r.path === '/users/:id');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/1?fields=id,name,email'),
        params: { id: '1' },
        query: { fields: 'id,name,email' },
        body: null,
        metadata: new Map(),
      };

      const response = await getRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(body).toEqual({
        id: '1',
        name: 'John',
        email: 'john@example.com',
      });
      expect(body.password).toBeUndefined();
    });
  });

  describe('Update endpoint enhancements', () => {
    it('should update timestamps on update', async () => {
      const modelWithTimestamps: ModelDefinition = {
        name: 'User',
        tableName: 'users',
        fields: [
          { name: 'id', type: 'uuid', database: { primaryKey: true } },
          { name: 'name', type: 'string', required: true },
          { name: 'updatedAt', type: 'date' },
        ],
        options: { timestamps: true },
      };

      database.updateFn.mockImplementation((_id: string, data: any) => ({
        id: '1',
        name: 'Jane',
        ...data,
      }));

      const routes = generator.generate(modelWithTimestamps, { basePath: '/users' });
      const updateRoute = routes.find(r => r.method === 'PUT');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/1', { method: 'PUT' }),
        params: { id: '1' },
        query: {},
        body: { name: 'Jane' },
        metadata: new Map(),
      };

      await updateRoute!.handler(ctx, vi.fn());

      // Verify updatedAt was added
      expect(database.updateFn).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          name: 'Jane',
          updatedAt: expect.any(String),
        })
      );
    });

    it('should handle optimistic locking', async () => {
      const modelWithVersion: ModelDefinition = {
        name: 'User',
        tableName: 'users',
        fields: [
          { name: 'id', type: 'uuid', database: { primaryKey: true } },
          { name: 'name', type: 'string', required: true },
          { name: 'version', type: 'number', required: true },
        ],
      };

      // Mock current version
      database.selectFn.mockResolvedValue([{ id: '1', name: 'John', version: 2 }]);

      const routes = generator.generate(modelWithVersion, {
        basePath: '/users',
        enableOptimisticLocking: true,
      });
      const updateRoute = routes.find(r => r.method === 'PUT');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/1', { method: 'PUT' }),
        params: { id: '1' },
        query: {},
        body: { name: 'Jane', version: 1 }, // Stale version
        metadata: new Map(),
      };

      const response = await updateRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe('Conflict');
      expect(body.code).toBe('OPTIMISTIC_LOCK_ERROR');
    });

    it('should increment version on successful update', async () => {
      const modelWithVersion: ModelDefinition = {
        name: 'User',
        tableName: 'users',
        fields: [
          { name: 'id', type: 'uuid', database: { primaryKey: true } },
          { name: 'name', type: 'string', required: true },
          { name: 'version', type: 'number', required: true },
        ],
      };

      // Mock current version
      database.selectFn.mockResolvedValue([{ id: '1', name: 'John', version: 1 }]);
      database.updateFn.mockResolvedValue({ id: '1', name: 'Jane', version: 2 });

      const routes = generator.generate(modelWithVersion, {
        basePath: '/users',
        enableOptimisticLocking: true,
      });
      const updateRoute = routes.find(r => r.method === 'PUT');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/1', { method: 'PUT' }),
        params: { id: '1' },
        query: {},
        body: { name: 'Jane', version: 1 }, // Correct version
        metadata: new Map(),
      };

      const response = await updateRoute!.handler(ctx, vi.fn());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.version).toBe(2);
    });
  });

  describe('Delete endpoint enhancements', () => {
    it('should perform soft delete when enabled', async () => {
      const modelWithSoftDelete: ModelDefinition = {
        name: 'User',
        tableName: 'users',
        fields: [
          { name: 'id', type: 'uuid', database: { primaryKey: true } },
          { name: 'name', type: 'string', required: true },
          { name: 'deletedAt', type: 'date' },
        ],
      };

      database.updateFn.mockResolvedValue({ id: '1', name: 'John', deletedAt: new Date().toISOString() });

      const routes = generator.generate(modelWithSoftDelete, {
        basePath: '/users',
        enableSoftDelete: true,
      });
      const deleteRoute = routes.find(r => r.method === 'DELETE');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/1', { method: 'DELETE' }),
        params: { id: '1' },
        query: {},
        body: null,
        metadata: new Map(),
      };

      const response = await deleteRoute!.handler(ctx, vi.fn());

      expect(response.status).toBe(204);
      // Verify update was called instead of delete
      expect(database.updateFn).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          deletedAt: expect.any(String),
        })
      );
      expect(database.deleteFn).not.toHaveBeenCalled();
    });

    it('should perform hard delete when soft delete is disabled', async () => {
      database.deleteFn.mockResolvedValue(undefined);

      const routes = generator.generate(model, {
        basePath: '/users',
        enableSoftDelete: false,
      });
      const deleteRoute = routes.find(r => r.method === 'DELETE');

      const ctx: RequestContext = {
        request: new Request('http://localhost/users/1', { method: 'DELETE' }),
        params: { id: '1' },
        query: {},
        body: null,
        metadata: new Map(),
      };

      const response = await deleteRoute!.handler(ctx, vi.fn());

      expect(response.status).toBe(204);
      expect(database.deleteFn).toHaveBeenCalledWith('1');
    });
  });
});
