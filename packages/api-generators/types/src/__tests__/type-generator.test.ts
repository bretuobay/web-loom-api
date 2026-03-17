import { describe, expect, it } from 'vitest';
import { TypeGenerator } from '../index';

describe('TypeGenerator', () => {
  it('generates model, enum, request, and utility types', () => {
    const generator = new TypeGenerator();

    generator.registerModel({
      name: 'User',
      fields: [
        { name: 'id', type: 'uuid', required: true },
        { name: 'email', type: 'string', required: true },
      ],
      metadata: {
        description: 'User model',
        timestamps: true,
      },
    });

    generator.registerEnum({
      name: 'UserRole',
      values: [{ key: 'ADMIN', value: 'admin' }],
    });

    generator.registerRoute({
      path: '/users/:id',
      method: 'GET',
      metadata: {
        description: 'Get user by id',
      },
    });

    const generated = generator.generate();

    expect(generated.models).toContain('export interface User');
    expect(generated.models).toContain('export type CreateUser');
    expect(generated.enums).toContain('export enum UserRole');
    expect(generated.requestResponse).toContain('export interface APIResponse');
    expect(generated.utils).toContain('export type DeepPartial');
  });
});
