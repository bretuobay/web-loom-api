/**
 * React Hooks Example
 * 
 * Demonstrates React hooks generation for queries and mutations
 */

import { ClientGenerator } from '../src/client-generator';
import type { ModelDefinition, RouteDefinition } from '../src/types';

// Define models
const models: ModelDefinition[] = [
  {
    name: 'User',
    fields: [
      { name: 'id', type: 'uuid', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'avatar', type: 'string', required: false },
      { name: 'createdAt', type: 'date', required: true },
    ],
    metadata: {
      description: 'User model',
    },
  },
  {
    name: 'Post',
    fields: [
      { name: 'id', type: 'uuid', required: true },
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'string', required: true },
      { name: 'published', type: 'boolean', required: true },
      { name: 'authorId', type: 'uuid', required: true },
      { name: 'createdAt', type: 'date', required: true },
    ],
    metadata: {
      description: 'Blog post model',
    },
  },
];

// Define routes
const routes: RouteDefinition[] = [
  // User routes
  { path: '/users', method: 'GET', metadata: { description: 'List all users' } },
  { path: '/users', method: 'POST', metadata: { description: 'Create a new user' } },
  { path: '/users/:id', method: 'GET', metadata: { description: 'Get user by ID' } },
  { path: '/users/:id', method: 'PUT', metadata: { description: 'Update user' } },
  { path: '/users/:id', method: 'DELETE', metadata: { description: 'Delete user' } },
  
  // Post routes
  { path: '/posts', method: 'GET', metadata: { description: 'List all posts' } },
  { path: '/posts', method: 'POST', metadata: { description: 'Create a new post' } },
  { path: '/posts/:id', method: 'GET', metadata: { description: 'Get post by ID' } },
  { path: '/posts/:id', method: 'PUT', metadata: { description: 'Update post' } },
  { path: '/posts/:id', method: 'DELETE', metadata: { description: 'Delete post' } },
];

// Create generator with React hooks enabled
const generator = new ClientGenerator({
  className: 'APIClient',
  baseUrl: 'https://api.example.com',
  generateReactHooks: true, // Enable React hooks generation
  includeRetry: true,
  generateErrors: true,
});

// Register models and routes
generator.registerModels(models);
generator.registerRoutes(routes);

// Generate client files including hooks
const files = generator.generateToFiles();

// Output generated files
console.log('Generated files with React hooks:');
for (const [filename, content] of files) {
  console.log(`\n=== ${filename} ===`);
  if (filename === 'hooks.ts') {
    console.log(content.substring(0, 1000) + '...\n');
  }
}

// Example usage of generated React hooks:
/*
import React from 'react';
import { APIClient } from './generated';
import {
  useGetUsers,
  useGetUserById,
  useCreateUsers,
  useUpdateUserById,
  useDeleteUserById,
  useGetPosts,
  useCreatePosts,
} from './generated/hooks';

// Create client instance (typically in a context provider)
const client = new APIClient('https://api.example.com');

// ===== QUERY HOOKS (GET requests) =====

function UsersList() {
  // useQuery hook for listing users
  const { data, isLoading, error, refetch } = useGetUsers(client, {
    page: 1,
    limit: 20,
  });

  if (isLoading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div>
      <h2>Users ({data.pagination.total})</h2>
      <button onClick={refetch}>Refresh</button>
      <ul>
        {data.data.map(user => (
          <li key={user.id}>
            {user.name} - {user.email}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UserProfile({ userId }: { userId: string }) {
  // useQuery hook for single user
  const { data: user, isLoading, error } = useGetUserById(client, userId);

  if (isLoading) return <div>Loading user...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return null;

  return (
    <div>
      <h2>{user.name}</h2>
      <p>Email: {user.email}</p>
      <p>Joined: {user.createdAt.toLocaleDateString()}</p>
    </div>
  );
}

// ===== QUERY OPTIONS =====

function AutoRefreshingPosts() {
  // Auto-refetch every 5 seconds
  const { data, isLoading } = useGetPosts(client, undefined, {
    refetchInterval: 5000,
    onSuccess: (data) => {
      console.log('Posts refreshed:', data);
    },
    onError: (error) => {
      console.error('Failed to fetch posts:', error);
    },
  });

  return <div>{/* ... */}</div>;
}

function ConditionalQuery({ shouldFetch }: { shouldFetch: boolean }) {
  // Only fetch when enabled
  const { data, isLoading } = useGetUsers(client, undefined, {
    enabled: shouldFetch,
  });

  return <div>{/* ... */}</div>;
}

// ===== MUTATION HOOKS (POST/PUT/PATCH/DELETE) =====

function CreateUserForm() {
  const { mutate, isLoading, error, data } = useCreateUsers(client, {
    onSuccess: (user) => {
      console.log('User created:', user);
      // Redirect or show success message
    },
    onError: (error) => {
      console.error('Failed to create user:', error);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      await mutate({
        data: {
          email: formData.get('email') as string,
          name: formData.get('name') as string,
        },
      });
    } catch (error) {
      // Error already handled by onError callback
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="name" type="text" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create User'}
      </button>
      {error && <div className="error">{error.message}</div>}
      {data && <div className="success">User created: {data.name}</div>}
    </form>
  );
}

function UpdateUserForm({ userId }: { userId: string }) {
  const { mutate, isLoading, error, reset } = useUpdateUserById(client, {
    onSuccess: (user) => {
      console.log('User updated:', user);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await mutate({
      id: userId,
      data: {
        name: formData.get('name') as string,
        avatar: formData.get('avatar') as string,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" type="text" />
      <input name="avatar" type="url" />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Updating...' : 'Update User'}
      </button>
      <button type="button" onClick={reset}>Reset</button>
      {error && <div className="error">{error.message}</div>}
    </form>
  );
}

function DeleteUserButton({ userId }: { userId: string }) {
  const { mutate, isLoading } = useDeleteUserById(client, {
    onSuccess: () => {
      console.log('User deleted');
      // Redirect or refresh list
    },
  });

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this user?')) {
      await mutate({ id: userId });
    }
  };

  return (
    <button onClick={handleDelete} disabled={isLoading}>
      {isLoading ? 'Deleting...' : 'Delete User'}
    </button>
  );
}

// ===== COMBINING QUERIES AND MUTATIONS =====

function UserManagement() {
  const { data: users, isLoading, refetch } = useGetUsers(client);
  const { mutate: createUser } = useCreateUsers(client, {
    onSuccess: () => {
      // Refetch users list after creating a new user
      refetch();
    },
  });
  const { mutate: deleteUser } = useDeleteUserById(client, {
    onSuccess: () => {
      // Refetch users list after deleting a user
      refetch();
    },
  });

  return (
    <div>
      <h2>User Management</h2>
      {/* Create form */}
      {/* Users list with delete buttons */}
    </div>
  );
}

// ===== OPTIMISTIC UPDATES =====

function OptimisticUpdateExample({ postId }: { postId: string }) {
  const [optimisticData, setOptimisticData] = React.useState<Post | null>(null);
  const { data: post, refetch } = useGetPostById(client, postId);
  const { mutate: updatePost } = useUpdatePostById(client, {
    onSuccess: () => {
      setOptimisticData(null);
      refetch();
    },
    onError: () => {
      setOptimisticData(null);
    },
  });

  const displayPost = optimisticData || post;

  const handlePublish = async () => {
    // Optimistic update
    if (post) {
      setOptimisticData({ ...post, published: true });
    }
    
    // Actual update
    await updatePost({
      id: postId,
      data: { published: true },
    });
  };

  return (
    <div>
      <h2>{displayPost?.title}</h2>
      <p>Status: {displayPost?.published ? 'Published' : 'Draft'}</p>
      <button onClick={handlePublish}>Publish</button>
    </div>
  );
}

// ===== CONTEXT PROVIDER PATTERN =====

const APIContext = React.createContext<APIClient | null>(null);

export function APIProvider({ children }: { children: React.ReactNode }) {
  const client = React.useMemo(() => new APIClient('https://api.example.com'), []);
  
  return (
    <APIContext.Provider value={client}>
      {children}
    </APIContext.Provider>
  );
}

export function useAPIClient() {
  const client = React.useContext(APIContext);
  if (!client) {
    throw new Error('useAPIClient must be used within APIProvider');
  }
  return client;
}

// Then in components:
function MyComponent() {
  const client = useAPIClient();
  const { data, isLoading } = useGetUsers(client);
  // ...
}
*/
