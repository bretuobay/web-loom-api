import { defineConfig } from '@web-loom/api-core';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/mydb',
    poolSize: 10,
  },
  security: {
    cors: {
      enabled: true,
      origins: ['http://localhost:3000'],
    },
  },
});
