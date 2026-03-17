import { randomBytes, createHash, timingSafeEqual, pbkdf2 as nodePbkdf2 } from 'node:crypto';
import type {
  AuthAdapter,
  Session,
  SessionValidationResult,
  User,
  UserData,
  ApiKey,
  ApiKeyValidationResult,
} from '@web-loom/api-core';
import { ConflictError, NotFoundError, AuthenticationError } from '@web-loom/api-shared';

// ---------------------------------------------------------------------------
// OAuth provider configuration
// ---------------------------------------------------------------------------

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes?: string[];
  redirectUri?: string;
}

// ---------------------------------------------------------------------------
// Lucia adapter options
// ---------------------------------------------------------------------------

export interface LuciaAuthAdapterOptions {
  /** Session lifetime in milliseconds (default: 30 days) */
  sessionExpiresIn?: number;
  /** Interval for automatic session cleanup in ms (0 = disabled, default: 0) */
  cleanupIntervalMs?: number;
  /** Number of PBKDF2 iterations for password hashing (default: 100_000) */
  hashIterations?: number;
}

// ---------------------------------------------------------------------------
// Internal stored-user type (includes password hash)
// ---------------------------------------------------------------------------

interface StoredUser {
  id: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
  role?: string;
  createdAt?: Date;
  updatedAt?: Date;
  passwordHash?: string;

  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// LuciaAuthAdapter
// ---------------------------------------------------------------------------

const DEFAULT_SESSION_EXPIRES_IN = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEFAULT_HASH_ITERATIONS = 100_000;
const HASH_KEY_LENGTH = 64;
const SALT_LENGTH = 32;

function toSafeUser(stored: StoredUser): User {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = stored;
  return rest as User;
}

export class LuciaAuthAdapter implements AuthAdapter {
  // In-memory stores
  private sessions = new Map<string, Session>();
  private users = new Map<string, StoredUser>();
  private usersByEmail = new Map<string, string>(); // email -> userId
  private apiKeys = new Map<string, ApiKey>(); // keyId -> ApiKey
  private apiKeysByHash = new Map<string, string>(); // keyHash -> keyId

  // OAuth provider registry
  private oauthProviders = new Map<string, OAuthProviderConfig>();

  // Options
  private readonly sessionExpiresIn: number;
  private readonly hashIterations: number;

  // Cleanup timer
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: LuciaAuthAdapterOptions = {}) {
    this.sessionExpiresIn = options.sessionExpiresIn ?? DEFAULT_SESSION_EXPIRES_IN;
    this.hashIterations = options.hashIterations ?? DEFAULT_HASH_ITERATIONS;

    if (options.cleanupIntervalMs && options.cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(
        () => this.cleanupExpiredSessions(),
        options.cleanupIntervalMs,
      );
      // Allow the process to exit even if the timer is still running
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  // -----------------------------------------------------------------------
  // OAuth provider registration
  // -----------------------------------------------------------------------

  registerOAuthProvider(name: string, config: OAuthProviderConfig): void {
    this.oauthProviders.set(name.toLowerCase(), config);
  }

  // -----------------------------------------------------------------------
  // Session management (Requirement 2.4, 14.1, 14.2)
  // -----------------------------------------------------------------------

  async createSession(
    userId: string,
    attributes: Record<string, unknown> = {},
  ): Promise<Session> {
    const user = this.users.get(userId);
    if (!user) {
      throw new NotFoundError(`User not found: ${userId}`, 'user');
    }

    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + this.sessionExpiresIn),
      attributes,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return { valid: false };
    }

    // Check expiration
    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(sessionId);
      return { valid: false };
    }

    const stored = this.users.get(session.userId);
    if (!stored) {
      this.sessions.delete(sessionId);
      return { valid: false };
    }

    // Sliding window: refresh expiration on validation
    session.expiresAt = new Date(Date.now() + this.sessionExpiresIn);

    return { valid: true, session, user: toSafeUser(stored) };
  }

  async invalidateSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  /** Remove all expired sessions */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (session.expiresAt.getTime() <= now) {
        this.sessions.delete(id);
        removed++;
      }
    }
    return removed;
  }

  // -----------------------------------------------------------------------
  // User management (Requirement 14.3, 14.4)
  // -----------------------------------------------------------------------

  async createUser(data: UserData): Promise<User> {
    if (!data.email || typeof data.email !== 'string') {
      throw new Error('Email is required');
    }

    const normalizedEmail = data.email.toLowerCase().trim();

    if (this.usersByEmail.has(normalizedEmail)) {
      throw new ConflictError(`User with email ${normalizedEmail} already exists`);
    }

    const id = crypto.randomUUID();
    const now = new Date();

    let passwordHash: string | undefined;
    if (data.password) {
      passwordHash = await this.hashPassword(data.password);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email: _e, password: _p, name, role, ...rest } = data;

    const storedUser: StoredUser = {
      id,
      email: normalizedEmail,
      name,
      role,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
      passwordHash,
      ...rest,
    };

    this.users.set(id, storedUser);
    this.usersByEmail.set(normalizedEmail, id);

    return toSafeUser(storedUser);
  }

  async getUser(userId: string): Promise<User | null> {
    const stored = this.users.get(userId);
    if (!stored) return null;
    return toSafeUser(stored);
  }

  async updateUser(userId: string, data: Partial<UserData>): Promise<User> {
    const stored = this.users.get(userId);
    if (!stored) {
      throw new NotFoundError(`User not found: ${userId}`, 'user');
    }

    // Handle email change
    if (data.email !== undefined) {
      const normalizedEmail = data.email.toLowerCase().trim();
      const existingId = this.usersByEmail.get(normalizedEmail);
      if (existingId && existingId !== userId) {
        throw new ConflictError(`User with email ${normalizedEmail} already exists`);
      }
      this.usersByEmail.delete(stored.email);
      stored.email = normalizedEmail;
      this.usersByEmail.set(normalizedEmail, userId);
    }

    // Handle password change
    if (data.password) {
      stored.passwordHash = await this.hashPassword(data.password);
    }

    // Update other fields
    if (data.name !== undefined) stored.name = data.name;
    if (data.role !== undefined) stored.role = data.role;

    stored.updatedAt = new Date();

    return toSafeUser(stored);
  }

  // -----------------------------------------------------------------------
  // Password hashing (Requirement 14.3, 14.4)
  // -----------------------------------------------------------------------

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derived = await this.deriveKey(password, salt, this.hashIterations, HASH_KEY_LENGTH);
    return `${this.hashIterations}:${salt.toString('hex')}:${derived.toString('hex')}`;
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    const parts = hash.split(':');
    if (parts.length !== 3) return false;

    const iterStr = parts[0]!;
    const saltHex = parts[1]!;
    const hashHex = parts[2]!;

    const iterations = parseInt(iterStr, 10);
    if (isNaN(iterations)) return false;

    const salt = Buffer.from(saltHex, 'hex');
    const storedHash = Buffer.from(hashHex, 'hex');

    const derived = await this.deriveKey(password, salt, iterations, storedHash.length);

    if (derived.length !== storedHash.length) return false;
    return timingSafeEqual(derived, storedHash);
  }

  // -----------------------------------------------------------------------
  // OAuth integration (Requirement 14.5)
  // -----------------------------------------------------------------------

  getOAuthAuthorizationUrl(provider: string, state: string): string {
    const config = this.oauthProviders.get(provider.toLowerCase());
    if (!config) {
      throw new Error(`OAuth provider not registered: ${provider}`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      state,
    });

    if (config.redirectUri) {
      params.set('redirect_uri', config.redirectUri);
    }

    if (config.scopes && config.scopes.length > 0) {
      params.set('scope', config.scopes.join(' '));
    }

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  async handleOAuthCallback(provider: string, code: string): Promise<User> {
    const config = this.oauthProviders.get(provider.toLowerCase());
    if (!config) {
      throw new AuthenticationError(`OAuth provider not registered: ${provider}`);
    }

    // Exchange code for access token
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    if (config.redirectUri) {
      tokenBody.set('redirect_uri', config.redirectUri);
    }

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenBody.toString(),
    });

    if (!tokenResponse.ok) {
      throw new AuthenticationError(`OAuth token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new AuthenticationError('OAuth token exchange did not return an access token');
    }

    // Fetch user info
    const userInfoResponse = await fetch(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoResponse.ok) {
      throw new AuthenticationError(`OAuth user info fetch failed: ${userInfoResponse.status}`);
    }

    const profile = (await userInfoResponse.json()) as Record<string, unknown>;

    const email = (
      (profile.email as string | undefined) ?? ''
    ).toLowerCase().trim();

    if (!email) {
      throw new AuthenticationError('OAuth provider did not return an email');
    }

    // Find or create user
    const existingUserId = this.usersByEmail.get(email);
    if (existingUserId) {
      const user = await this.getUser(existingUserId);
      if (user) {
        return this.updateUser(existingUserId, {
          email,
          name: (profile.name as string | undefined) ?? user.name,
          emailVerified: true,
        } as Partial<UserData>);
      }
    }

    return this.createUser({
      email,
      name: (profile.name as string | undefined) ?? (profile.login as string | undefined),
      role: 'user',
    } as UserData);
  }

  // -----------------------------------------------------------------------
  // API key management (Requirement 14.6)
  // -----------------------------------------------------------------------

  async createApiKey(userId: string, scopes: string[]): Promise<ApiKey> {
    const user = this.users.get(userId);
    if (!user) {
      throw new NotFoundError(`User not found: ${userId}`, 'user');
    }

    const id = crypto.randomUUID();
    const rawKey = `wl_${randomBytes(32).toString('hex')}`;
    const keyHash = this.sha256(rawKey);

    const apiKey: ApiKey = {
      id,
      userId,
      key: rawKey,
      keyHash,
      scopes: [...scopes],
      revoked: false,
      createdAt: new Date(),
    };

    this.apiKeys.set(id, apiKey);
    this.apiKeysByHash.set(keyHash, id);

    return apiKey;
  }

  async validateApiKey(key: string): Promise<ApiKeyValidationResult> {
    const keyHash = this.sha256(key);
    const keyId = this.apiKeysByHash.get(keyHash);

    if (!keyId) {
      return { valid: false };
    }

    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey || apiKey.revoked) {
      return { valid: false };
    }

    apiKey.lastUsedAt = new Date();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { key: _k, ...safeKey } = apiKey;
    return {
      valid: true,
      userId: apiKey.userId,
      scopes: [...apiKey.scopes],
      apiKey: safeKey as ApiKey,
    };
  }

  async revokeApiKey(keyId: string): Promise<void> {
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey) {
      throw new NotFoundError(`API key not found: ${keyId}`, 'apiKey');
    }
    apiKey.revoked = true;
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private deriveKey(
    password: string,
    salt: Buffer,
    iterations: number,
    keyLength: number,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      nodePbkdf2(password, salt, iterations, keyLength, 'sha512', (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
  }
}
