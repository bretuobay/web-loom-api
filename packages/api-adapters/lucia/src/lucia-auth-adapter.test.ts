import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LuciaAuthAdapter } from './lucia-auth-adapter';
import type { OAuthProviderConfig } from './lucia-auth-adapter';

describe('LuciaAuthAdapter', () => {
  let adapter: LuciaAuthAdapter;

  beforeEach(() => {
    adapter = new LuciaAuthAdapter({ sessionExpiresIn: 60_000 }); // 1 min for tests
  });

  afterEach(() => {
    adapter.destroy();
  });

  // -----------------------------------------------------------------------
  // User management
  // -----------------------------------------------------------------------

  describe('createUser', () => {
    it('creates a user with email and password', async () => {
      const user = await adapter.createUser({ email: 'Alice@Example.com', password: 'secret123', name: 'Alice' });
      expect(user.id).toBeDefined();
      expect(user.email).toBe('alice@example.com');
      expect(user.name).toBe('Alice');
      expect(user.emailVerified).toBe(false);
      expect(user.createdAt).toBeInstanceOf(Date);
      // password hash must not leak
      expect((user as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('throws ConflictError for duplicate email', async () => {
      await adapter.createUser({ email: 'dup@test.com' });
      await expect(adapter.createUser({ email: 'DUP@test.com' })).rejects.toThrow('already exists');
    });

    it('throws when email is missing', async () => {
      await expect(adapter.createUser({ email: '' })).rejects.toThrow();
    });
  });

  describe('getUser', () => {
    it('returns user by id', async () => {
      const created = await adapter.createUser({ email: 'get@test.com', name: 'Get' });
      const found = await adapter.getUser(created.id);
      expect(found).not.toBeNull();
      expect(found!.email).toBe('get@test.com');
    });

    it('returns null for unknown id', async () => {
      expect(await adapter.getUser('nonexistent')).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('updates user fields', async () => {
      const user = await adapter.createUser({ email: 'upd@test.com', name: 'Old' });
      const updated = await adapter.updateUser(user.id, { name: 'New' });
      expect(updated.name).toBe('New');
      expect(updated.updatedAt!.getTime()).toBeGreaterThanOrEqual(user.createdAt!.getTime());
    });

    it('updates email with dedup check', async () => {
      const u1 = await adapter.createUser({ email: 'a@test.com' });
      await adapter.createUser({ email: 'b@test.com' });
      await expect(adapter.updateUser(u1.id, { email: 'b@test.com' })).rejects.toThrow('already exists');
    });

    it('throws NotFoundError for unknown user', async () => {
      await expect(adapter.updateUser('nope', { name: 'x' })).rejects.toThrow('not found');
    });
  });

  // -----------------------------------------------------------------------
  // Password hashing
  // -----------------------------------------------------------------------

  describe('hashPassword / verifyPassword', () => {
    it('hashes and verifies correctly', async () => {
      const hash = await adapter.hashPassword('my-password');
      expect(hash).toContain(':');
      expect(await adapter.verifyPassword(hash, 'my-password')).toBe(true);
    });

    it('rejects wrong password', async () => {
      const hash = await adapter.hashPassword('correct');
      expect(await adapter.verifyPassword(hash, 'wrong')).toBe(false);
    });

    it('rejects malformed hash', async () => {
      expect(await adapter.verifyPassword('bad', 'pw')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Session management
  // -----------------------------------------------------------------------

  describe('createSession', () => {
    it('creates a session for an existing user', async () => {
      const user = await adapter.createUser({ email: 'sess@test.com' });
      const session = await adapter.createSession(user.id, { device: 'test' });
      expect(session.id).toBeDefined();
      expect(session.userId).toBe(user.id);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.attributes.device).toBe('test');
    });

    it('throws NotFoundError for unknown user', async () => {
      await expect(adapter.createSession('ghost')).rejects.toThrow('not found');
    });
  });

  describe('validateSession', () => {
    it('validates a fresh session', async () => {
      const user = await adapter.createUser({ email: 'val@test.com' });
      const session = await adapter.createSession(user.id);
      const result = await adapter.validateSession(session.id);
      expect(result.valid).toBe(true);
      expect(result.user!.id).toBe(user.id);
      expect(result.session).toBeDefined();
    });

    it('returns invalid for unknown session', async () => {
      expect((await adapter.validateSession('nope')).valid).toBe(false);
    });

    it('returns invalid for expired session', async () => {
      const shortAdapter = new LuciaAuthAdapter({ sessionExpiresIn: 1 }); // 1ms
      const user = await shortAdapter.createUser({ email: 'exp@test.com' });
      const session = await shortAdapter.createSession(user.id);
      // Wait for expiration
      await new Promise((r) => setTimeout(r, 10));
      const result = await shortAdapter.validateSession(session.id);
      expect(result.valid).toBe(false);
      shortAdapter.destroy();
    });
  });

  describe('invalidateSession', () => {
    it('removes the session', async () => {
      const user = await adapter.createUser({ email: 'inv@test.com' });
      const session = await adapter.createSession(user.id);
      await adapter.invalidateSession(session.id);
      expect((await adapter.validateSession(session.id)).valid).toBe(false);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('removes expired sessions', async () => {
      const shortAdapter = new LuciaAuthAdapter({ sessionExpiresIn: 1 });
      const user = await shortAdapter.createUser({ email: 'clean@test.com' });
      await shortAdapter.createSession(user.id);
      await shortAdapter.createSession(user.id);
      await new Promise((r) => setTimeout(r, 10));
      const removed = shortAdapter.cleanupExpiredSessions();
      expect(removed).toBe(2);
      shortAdapter.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // OAuth
  // -----------------------------------------------------------------------

  describe('OAuth', () => {
    const googleConfig: OAuthProviderConfig = {
      clientId: 'google-client-id',
      clientSecret: 'google-secret',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scopes: ['openid', 'email', 'profile'],
      redirectUri: 'http://localhost:3000/callback',
    };

    it('getOAuthAuthorizationUrl builds correct URL', () => {
      adapter.registerOAuthProvider('google', googleConfig);
      const url = adapter.getOAuthAuthorizationUrl('google', 'state123');
      expect(url).toContain('accounts.google.com');
      expect(url).toContain('client_id=google-client-id');
      expect(url).toContain('state=state123');
      expect(url).toContain('response_type=code');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('scope=openid+email+profile');
    });

    it('throws for unregistered provider', () => {
      expect(() => adapter.getOAuthAuthorizationUrl('unknown', 's')).toThrow('not registered');
    });

    it('handleOAuthCallback exchanges code and creates user', async () => {
      adapter.registerOAuthProvider('github', {
        clientId: 'gh-id',
        clientSecret: 'gh-secret',
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
      });

      // Mock fetch
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'tok123' }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ email: 'OAuth@GH.com', name: 'GH User', login: 'ghuser' }), { status: 200 }));

      const user = await adapter.handleOAuthCallback('github', 'code123');
      expect(user.email).toBe('oauth@gh.com');
      expect(user.name).toBe('GH User');

      fetchSpy.mockRestore();
    });

    it('handleOAuthCallback throws for failed token exchange', async () => {
      adapter.registerOAuthProvider('bad', {
        clientId: 'id',
        clientSecret: 'sec',
        authorizationUrl: 'https://bad.com/auth',
        tokenUrl: 'https://bad.com/token',
        userInfoUrl: 'https://bad.com/user',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(new Response('error', { status: 400 }));

      await expect(adapter.handleOAuthCallback('bad', 'code')).rejects.toThrow('token exchange failed');
      fetchSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // API key management
  // -----------------------------------------------------------------------

  describe('API keys', () => {
    it('creates and validates an API key', async () => {
      const user = await adapter.createUser({ email: 'key@test.com' });
      const apiKey = await adapter.createApiKey(user.id, ['read:users', 'write:posts']);

      expect(apiKey.key).toBeDefined();
      expect(apiKey.key!.startsWith('wl_')).toBe(true);
      expect(apiKey.scopes).toEqual(['read:users', 'write:posts']);
      expect(apiKey.revoked).toBe(false);

      const result = await adapter.validateApiKey(apiKey.key!);
      expect(result.valid).toBe(true);
      expect(result.userId).toBe(user.id);
      expect(result.scopes).toEqual(['read:users', 'write:posts']);
    });

    it('returns invalid for unknown key', async () => {
      expect((await adapter.validateApiKey('wl_unknown')).valid).toBe(false);
    });

    it('revokes an API key', async () => {
      const user = await adapter.createUser({ email: 'rev@test.com' });
      const apiKey = await adapter.createApiKey(user.id, ['read']);
      await adapter.revokeApiKey(apiKey.id);
      expect((await adapter.validateApiKey(apiKey.key!)).valid).toBe(false);
    });

    it('throws NotFoundError when revoking unknown key', async () => {
      await expect(adapter.revokeApiKey('nope')).rejects.toThrow('not found');
    });

    it('throws NotFoundError when creating key for unknown user', async () => {
      await expect(adapter.createApiKey('ghost', [])).rejects.toThrow('not found');
    });
  });
});
