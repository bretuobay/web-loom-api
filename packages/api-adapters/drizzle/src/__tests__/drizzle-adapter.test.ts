import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DrizzleAdapter } from '../drizzle-adapter';
import type { ModelDefinition } from '@web-loom/api-core';

// Mock the Neon modules
vi.mock('@neondatabase/serverless', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  const mockPool = {
    connect: vi.fn(() => Promise.resolve(mockClient)),
    end: vi.fn(() => Promise.resolve()),
  };

  return {
    Pool: vi.fn(() => mockPool),
    neon: vi.fn(),
    neonConfig: { fetchConnectionCache: false },
  };
});

vi.mock('drizzle-orm/neon-serverless', () => ({
  drizzle: vi.fn(() => ({})),
}));

describe('DrizzleAdapter', () => {
  let adapter: DrizzleAdapter;
  const mockConfig = {
    url: 'postgresql://user:pass@localhost:5432/testdb',
    poolSize: 10,
    connectionTimeout: 10000,
  };

  beforeEach(async () => {
    adapter = new DrizzleAdapter();
    
    // Mock successful health check
    const { Pool } = await import('@neondatabase/serverless');
    const mockPool = new Pool({ connectionString: mockConfig.url });
    const mockClient = await mockPool.connect();
    vi.mocked(mockClient.query).mockResolvedValue({ rows: [{ '?column?': 1 }] } as never);
    
    await adapter.connect(mockConfig);
  });

  afterEach(async () => {
    await adapter.disconnect();
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect to database successfully', async () => {
      const newAdapter = new DrizzleAdapter();
      await expect(newAdapter.connect(mockConfig)).resolves.not.toThrow();
      await newAdapter.disconnect();
    });

    it('should disconnect gracefully', async () => {
      await expect(adapter.disconnect()).resolves.not.toThrow();
    });

    it('should perform health check successfully', async () => {
      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false on health check failure', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      vi.mocked(mockClient.query).mockRejectedValue(new Error('Connection failed'));

      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Query Execution', () => {
    it('should execute SELECT query and return results', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      const mockUsers = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
      ];
      
      vi.mocked(mockClient.query).mockResolvedValue({ rows: mockUsers } as never);

      const result = await adapter.query('SELECT * FROM users', []);
      expect(result).toEqual(mockUsers);
    });

    it('should execute query with parameters', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      const mockUser = { id: '1', name: 'John Doe' };
      vi.mocked(mockClient.query).mockResolvedValue({ rows: [mockUser] } as never);

      const result = await adapter.query('SELECT * FROM users WHERE id = $1', ['1']);
      expect(result).toEqual([mockUser]);
    });

    it('should execute statement without returning results', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      vi.mocked(mockClient.query).mockResolvedValue({ rows: [] } as never);

      await expect(
        adapter.execute('UPDATE users SET name = $1 WHERE id = $2', ['New Name', '1'])
      ).resolves.not.toThrow();
    });

    it('should throw error when querying without connection', async () => {
      const newAdapter = new DrizzleAdapter();
      await expect(newAdapter.query('SELECT 1', [])).rejects.toThrow('Database not connected');
    });
  });

  describe('Transactions', () => {
    it('should execute operations within a transaction', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      vi.mocked(mockClient.query).mockResolvedValue({ rows: [] } as never);

      const result = await adapter.transaction(async (tx) => {
        await tx.execute('INSERT INTO users (name) VALUES ($1)', ['John']);
        await tx.execute('INSERT INTO posts (title) VALUES ($1)', ['Post 1']);
        return { success: true };
      });

      expect(result).toEqual({ success: true });
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction on error', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      vi.mocked(mockClient.query)
        .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
        .mockRejectedValueOnce(new Error('Query failed')); // INSERT fails

      await expect(
        adapter.transaction(async (tx) => {
          await tx.execute('INSERT INTO users (name) VALUES ($1)', ['John']);
        })
      ).rejects.toThrow('Query failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('CRUD Operations', () => {
    const userModel: ModelDefinition = {
      name: 'User',
      tableName: 'users',
      fields: [
        { name: 'id', type: 'uuid', database: { primaryKey: true } },
        { name: 'name', type: 'string', required: true },
        { name: 'email', type: 'string', required: true, unique: true },
      ],
    };

    it('should insert a new record', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      const newUser = { name: 'John Doe', email: 'john@example.com' };
      const createdUser = { id: '1', ...newUser };
      
      vi.mocked(mockClient.query).mockResolvedValue({ rows: [createdUser] } as never);

      const result = await adapter.insert(userModel, newUser);
      expect(result).toEqual(createdUser);
    });

    it('should update an existing record', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      const updatedUser = { id: '1', name: 'Jane Doe', email: 'john@example.com' };
      vi.mocked(mockClient.query).mockResolvedValue({ rows: [updatedUser] } as never);

      const result = await adapter.update(userModel, '1', { name: 'Jane Doe' });
      expect(result).toEqual(updatedUser);
    });

    it('should throw error when updating non-existent record', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      vi.mocked(mockClient.query).mockResolvedValue({ rows: [] } as never);

      await expect(adapter.update(userModel, '999', { name: 'New Name' })).rejects.toThrow(
        'Record with id 999 not found'
      );
    });

    it('should delete a record', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      vi.mocked(mockClient.query).mockResolvedValue({ rows: [] } as never);

      await expect(adapter.delete(userModel, '1')).resolves.not.toThrow();
    });
  });

  describe('Query Builder', () => {
    const userModel: ModelDefinition = {
      name: 'User',
      tableName: 'users',
      fields: [
        { name: 'id', type: 'uuid' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'status', type: 'string' },
      ],
    };

    it('should build and execute simple SELECT query', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      const mockUsers = [{ id: '1', name: 'John', email: 'john@example.com', status: 'active' }];
      vi.mocked(mockClient.query).mockResolvedValue({ rows: mockUsers } as never);

      const result = await adapter.select(userModel).execute();
      expect(result).toEqual(mockUsers);
    });

    it('should build query with WHERE conditions', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      const mockUsers = [{ id: '1', name: 'John', email: 'john@example.com', status: 'active' }];
      vi.mocked(mockClient.query).mockResolvedValue({ rows: mockUsers } as never);

      const result = await adapter.select(userModel).where({ status: 'active' }).execute();
      expect(result).toEqual(mockUsers);
    });

    it('should build query with ORDER BY', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      const mockUsers = [
        { id: '1', name: 'Alice', email: 'alice@example.com', status: 'active' },
        { id: '2', name: 'Bob', email: 'bob@example.com', status: 'active' },
      ];
      vi.mocked(mockClient.query).mockResolvedValue({ rows: mockUsers } as never);

      const result = await adapter.select(userModel).orderBy('name', 'asc').execute();
      expect(result).toEqual(mockUsers);
    });

    it('should build query with LIMIT and OFFSET', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      const mockUsers = [{ id: '2', name: 'Bob', email: 'bob@example.com', status: 'active' }];
      vi.mocked(mockClient.query).mockResolvedValue({ rows: mockUsers } as never);

      const result = await adapter.select(userModel).limit(10).offset(10).execute();
      expect(result).toEqual(mockUsers);
    });

    it('should build complex query with multiple clauses', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      const mockUsers = [{ id: '1', name: 'Alice', email: 'alice@example.com', status: 'active' }];
      vi.mocked(mockClient.query).mockResolvedValue({ rows: mockUsers } as never);

      const result = await adapter
        .select(userModel)
        .where({ status: 'active' })
        .orderBy('name', 'desc')
        .limit(5)
        .offset(0)
        .execute();
      
      expect(result).toEqual(mockUsers);
    });
  });

  describe('Schema Management', () => {
    const userModel: ModelDefinition = {
      name: 'User',
      tableName: 'users',
      fields: [
        { name: 'id', type: 'uuid', database: { primaryKey: true } },
        { name: 'name', type: 'string', required: true },
        { name: 'email', type: 'string', required: true, unique: true },
        { name: 'age', type: 'number', default: 0 },
        { name: 'active', type: 'boolean', default: true },
      ],
    };

    it('should create table from model definition', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      vi.mocked(mockClient.query).mockResolvedValue({ rows: [] } as never);

      await expect(adapter.createTable(userModel)).resolves.not.toThrow();
    });

    it('should drop table', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      vi.mocked(mockClient.query).mockResolvedValue({ rows: [] } as never);

      await expect(adapter.dropTable(userModel)).resolves.not.toThrow();
    });

    it('should apply migration', async () => {
      const { Pool } = await import('@neondatabase/serverless');
      const mockPool = new Pool({ connectionString: mockConfig.url });
      const mockClient = await mockPool.connect();
      
      vi.mocked(mockClient.query).mockResolvedValue({ rows: [] } as never);

      const migration = {
        name: '001_create_users_table',
        up: 'CREATE TABLE users (id UUID PRIMARY KEY, name TEXT)',
        down: 'DROP TABLE users',
      };

      await expect(adapter.migrateSchema(migration)).resolves.not.toThrow();
    });
  });
});
