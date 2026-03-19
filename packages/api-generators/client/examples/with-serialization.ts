/**
 * Serialization/Deserialization Example
 *
 * Demonstrates automatic handling of Date objects and other special types
 */

import { ClientGenerator } from '../src/client-generator';
import type { ModelDefinition, RouteDefinition } from '../src/types';

// Define models with date fields
const models: ModelDefinition[] = [
  {
    name: 'Post',
    fields: [
      { name: 'id', type: 'uuid', required: true },
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'string', required: true },
      { name: 'publishedAt', type: 'date', required: false },
      { name: 'createdAt', type: 'date', required: true },
      { name: 'updatedAt', type: 'date', required: true },
    ],
    metadata: {
      description: 'Blog post with date fields',
    },
  },
  {
    name: 'Event',
    fields: [
      { name: 'id', type: 'uuid', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'startDate', type: 'date', required: true },
      { name: 'endDate', type: 'date', required: true },
      { name: 'registrationDeadline', type: 'date', required: false },
    ],
    metadata: {
      description: 'Event with multiple date fields',
    },
  },
];

// Define routes
const routes: RouteDefinition[] = [
  { path: '/posts', method: 'GET' },
  { path: '/posts', method: 'POST' },
  { path: '/posts/:id', method: 'GET' },
  { path: '/posts/:id', method: 'PUT' },
  { path: '/events', method: 'GET' },
  { path: '/events', method: 'POST' },
];

// Create generator
const generator = new ClientGenerator({
  className: 'APIClient',
  baseUrl: 'https://api.example.com',
});

generator.registerModels(models);
generator.registerRoutes(routes);

const files = generator.generateToFiles();

console.log('Generated client with automatic serialization/deserialization');

// Example usage with automatic serialization/deserialization:
/*
import { APIClient } from './generated';

const client = new APIClient('https://api.example.com');

// ===== SERIALIZATION (Request) =====

// Create post with Date object - automatically serialized to ISO string
const newPost = await client.createPosts({
  title: 'My First Post',
  content: 'This is the content',
  publishedAt: new Date('2024-01-15T10:00:00Z'), // Date object
  createdAt: new Date(), // Current date
  updatedAt: new Date(),
});

// Create event with multiple dates
const newEvent = await client.createEvents({
  name: 'Tech Conference 2024',
  startDate: new Date('2024-06-01T09:00:00Z'),
  endDate: new Date('2024-06-03T17:00:00Z'),
  registrationDeadline: new Date('2024-05-15T23:59:59Z'),
});

// Update with Date objects
const updatedPost = await client.updatePostById('post-id', {
  publishedAt: new Date(), // Publish now
  updatedAt: new Date(),
});

// ===== DESERIALIZATION (Response) =====

// Get post - dates are automatically converted to Date objects
const post = await client.getPostById('post-id');

// All date fields are now Date objects, not strings!
console.log(post.createdAt instanceof Date); // true
console.log(post.updatedAt instanceof Date); // true
console.log(post.publishedAt instanceof Date); // true (if not null)

// You can use Date methods directly
console.log(post.createdAt.toLocaleDateString()); // "1/15/2024"
console.log(post.createdAt.getFullYear()); // 2024
console.log(post.createdAt.toISOString()); // "2024-01-15T10:00:00.000Z"

// Calculate time differences
const daysSinceCreation = Math.floor(
  (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60 * 24)
);
console.log(`Post created ${daysSinceCreation} days ago`);

// List posts - dates in arrays are also deserialized
const posts = await client.getPosts({ page: 1, limit: 10 });

posts.data.forEach(post => {
  // Each post has Date objects
  console.log(`${post.title} - Created: ${post.createdAt.toDateString()}`);
  
  // Check if published
  if (post.publishedAt) {
    const isPublished = post.publishedAt <= new Date();
    console.log(`Published: ${isPublished}`);
  }
});

// Sort posts by date (works because they're Date objects)
const sortedPosts = posts.data.sort((a, b) => 
  b.createdAt.getTime() - a.createdAt.getTime()
);

// ===== NESTED OBJECTS =====

// Works with nested objects containing dates
const complexData = await client.createPosts({
  title: 'Complex Post',
  content: 'Content',
  metadata: {
    scheduledFor: new Date('2024-12-25T00:00:00Z'),
    reminders: [
      { date: new Date('2024-12-20T09:00:00Z'), sent: false },
      { date: new Date('2024-12-24T09:00:00Z'), sent: false },
    ],
  },
});

// ===== FILTERING BY DATE =====

// Filter events by date range
const upcomingEvents = await client.getEvents({
  startDate_gte: new Date().toISOString(), // After now
  endDate_lte: new Date('2024-12-31').toISOString(), // Before end of year
});

upcomingEvents.data.forEach(event => {
  const daysUntilStart = Math.ceil(
    (event.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  console.log(`${event.name} starts in ${daysUntilStart} days`);
});

// ===== TIMEZONE HANDLING =====

// Dates are stored as UTC (ISO 8601 format)
const event = await client.getEventById('event-id');

// Convert to local timezone for display
const localStartDate = event.startDate.toLocaleString('en-US', {
  timeZone: 'America/New_York',
  dateStyle: 'full',
  timeStyle: 'short',
});
console.log(`Event starts: ${localStartDate}`);

// ===== NULL/UNDEFINED HANDLING =====

// Optional date fields are preserved
const draftPost = await client.createPosts({
  title: 'Draft Post',
  content: 'Not published yet',
  publishedAt: null, // Explicitly null
});

console.log(draftPost.publishedAt === null); // true

// The serialization/deserialization is automatic and transparent!
// You don't need to manually convert dates - just use Date objects naturally.
*/
