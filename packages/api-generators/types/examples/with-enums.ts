/**
 * Enums Example
 * 
 * Demonstrates enum type generation
 */

import { TypeGenerator } from '../src/type-generator';
import type { ModelDefinition, EnumDefinition } from '../src/types';

// Define enums
const enums: EnumDefinition[] = [
  {
    name: 'UserRole',
    values: [
      { key: 'USER', value: 'user', description: 'Regular user' },
      { key: 'ADMIN', value: 'admin', description: 'Administrator' },
      { key: 'MODERATOR', value: 'moderator', description: 'Moderator' },
    ],
    metadata: {
      description: 'User role enum',
    },
  },
  {
    name: 'PostStatus',
    values: [
      { key: 'DRAFT', value: 'draft', description: 'Draft post' },
      { key: 'PUBLISHED', value: 'published', description: 'Published post' },
      { key: 'ARCHIVED', value: 'archived', description: 'Archived post' },
    ],
    metadata: {
      description: 'Post status enum',
    },
  },
  {
    name: 'Priority',
    values: [
      { key: 'LOW', value: 1, description: 'Low priority' },
      { key: 'MEDIUM', value: 2, description: 'Medium priority' },
      { key: 'HIGH', value: 3, description: 'High priority' },
      { key: 'URGENT', value: 4, description: 'Urgent priority' },
    ],
    metadata: {
      description: 'Priority level enum',
    },
  },
];

// Define models using enums
const models: ModelDefinition[] = [
  {
    name: 'User',
    fields: [
      { name: 'id', type: 'uuid', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { 
        name: 'role', 
        type: 'enum', 
        required: true,
        enum: ['user', 'admin', 'moderator'],
        metadata: {
          description: 'User role',
        },
      },
      { name: 'createdAt', type: 'date', required: true },
    ],
    metadata: {
      description: 'User with role',
    },
  },
  {
    name: 'Task',
    fields: [
      { name: 'id', type: 'uuid', required: true },
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { 
        name: 'status', 
        type: 'enum', 
        required: true,
        enum: ['todo', 'in_progress', 'done'],
        metadata: {
          description: 'Task status',
        },
      },
      { name: 'createdAt', type: 'date', required: true },
    ],
    metadata: {
      description: 'Task with status',
    },
  },
];

// Create generator
const generator = new TypeGenerator({
  includeJSDoc: true,
  generateEnums: true,
});

// Register enums and models
generator.registerEnums(enums);
generator.registerModels(models);

// Generate types
const files = generator.generateToFiles();

// Output generated files
console.log('Generated files with enums:');
for (const [filename, content] of files) {
  console.log(`\n=== ${filename} ===`);
  if (filename === 'enums.ts') {
    console.log(content);
  } else {
    console.log(content.substring(0, 300) + '...\n');
  }
}

// Example usage of generated enums:
/*
import { UserRole, PostStatus, Priority } from './generated/enums';
import type { User, Task } from './generated/models';

// Use enum values
const adminRole = UserRole.ADMIN; // 'admin'
const draftStatus = PostStatus.DRAFT; // 'draft'
const highPriority = Priority.HIGH; // 3

// Use in objects
const user: User = {
  id: '123',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin', // Type-safe: must be 'user' | 'admin' | 'moderator'
  createdAt: new Date(),
};

// Type checking
const task: Task = {
  id: '456',
  title: 'Important Task',
  status: 'in_progress', // Type-safe: must be 'todo' | 'in_progress' | 'done'
  createdAt: new Date(),
};

// Enum comparison
if (user.role === 'admin') {
  console.log('User is an admin');
}

// Switch statements
switch (task.status) {
  case 'todo':
    console.log('Task not started');
    break;
  case 'in_progress':
    console.log('Task in progress');
    break;
  case 'done':
    console.log('Task completed');
    break;
}

// Numeric enums
function getPriorityLabel(priority: Priority): string {
  switch (priority) {
    case Priority.LOW:
      return 'Low Priority';
    case Priority.MEDIUM:
      return 'Medium Priority';
    case Priority.HIGH:
      return 'High Priority';
    case Priority.URGENT:
      return 'Urgent!';
  }
}
*/
