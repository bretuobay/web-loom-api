/**
 * Basic usage example for Drizzle adapter
 * 
 * Demonstrates connection, CRUD operations, transactions, and query building
 */

import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { ModelDefinition } from '@web-loom/api-core';

// Define User model
const UserModel: ModelDefinition = {
  name: 'User',
  tableName: 'users',
  fields: [
    {
      name: 'id',
      type: 'uuid',
      database: { primaryKey: true },
    },
    {
      name: 'name',
      type: 'string',
      required: true,
    },
    {
      name: 'email',
      type: 'string',
      required: true,
      unique: true,
    },
    {
      name: 'age',
      type: 'number',
    },
    {
      name: 'status',
      type: 'string',
      default: 'active',
    },
  ],
};

interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  status: string;
}

async function main() {
  const adapter = new DrizzleAdapter();

  try {
    // 1. Connect to database
    console.log('Connecting to database...');
    await adapter.connect({
      url: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/testdb',
      poolSize: 10,
      connectionTimeout: 10000,
    });

    // 2. Health check
    const isHealthy = await adapter.healthCheck();
    console.log('Database healthy:', isHealthy);

    // 3. Create table
    console.log('\nCreating users table...');
    await adapter.createTable(UserModel);

    // 4. Insert records
    console.log('\nInserting users...');
    const user1 = await adapter.insert<User>(UserModel, {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      status: 'active',
    });
    console.log('Created user:', user1);

    const user2 = await adapter.insert<User>(UserModel, {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      age: 25,
      status: 'active',
    });
    console.log('Created user:', user2);

    // 5. Query with query builder
    console.log('\nQuerying active users...');
    const activeUsers = await adapter
      .select<User>(UserModel)
      .where({ status: 'active' })
      .orderBy('name', 'asc')
      .execute();
    console.log('Active users:', activeUsers);

    // 6. Update record
    console.log('\nUpdating user...');
    const updatedUser = await adapter.update<User>(UserModel, '1', {
      age: 31,
    });
    console.log('Updated user:', updatedUser);

    // 7. Raw SQL query
    console.log('\nExecuting raw SQL query...');
    const users = await adapter.query<User>(
      'SELECT * FROM users WHERE age > $1',
      [25]
    );
    console.log('Users over 25:', users);

    // 8. Transaction example
    console.log('\nExecuting transaction...');
    const result = await adapter.transaction(async (tx) => {
      await tx.execute(
        'UPDATE users SET status = $1 WHERE id = $2',
        ['inactive', '2']
      );
      
      const count = await tx.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM users WHERE status = $1',
        ['active']
      );
      
      return { activeCount: count[0].count };
    });
    console.log('Transaction result:', result);

    // 9. Delete record
    console.log('\nDeleting user...');
    await adapter.delete(UserModel, '2');
    console.log('User deleted');

    // 10. Query with pagination
    console.log('\nQuerying with pagination...');
    const paginatedUsers = await adapter
      .select<User>(UserModel)
      .orderBy('name', 'desc')
      .limit(10)
      .offset(0)
      .execute();
    console.log('Paginated users:', paginatedUsers);

    // 11. Drop table (cleanup)
    console.log('\nDropping users table...');
    await adapter.dropTable(UserModel);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // 12. Disconnect
    console.log('\nDisconnecting...');
    await adapter.disconnect();
    console.log('Done!');
  }
}

// Run the example
main().catch(console.error);
