/**
 * Authentication Adapter Interface
 * 
 * Abstracts authentication systems (e.g., Lucia, NextAuth, custom auth) to provide
 * a unified interface for session management, user authentication, and API key handling.
 * 
 * This adapter enables the framework to support multiple authentication providers,
 * allowing developers to choose their preferred auth solution.
 * 
 * **Default Implementation:** Lucia (lightweight session management)
 * **Alternative Implementations:** NextAuth, Auth0, custom implementations
 * 
 * @example
 * ```typescript
 * const adapter = new LuciaAdapter();
 * 
 * // Create user and session
 * const user = await adapter.createUser({
 *   email: 'user@example.com',
 *   password: 'secure-password'
 * });
 * 
 * const session = await adapter.createSession(user.id);
 * 
 * // Validate session
 * const result = await adapter.validateSession(session.id);
 * if (result.valid) {
 *   console.log('Authenticated user:', result.user);
 * }
 * ```
 * 
 * **Requirements:** 2.4, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */
export interface AuthAdapter {
  /**
   * Create a new session for a user
   * 
   * Generates a session ID, stores session data in the database,
   * and returns the session object with expiration time.
   * 
   * @param userId - User ID to create session for
   * @param attributes - Optional session attributes (e.g., device info, IP address)
   * @returns Promise resolving to the created session
   * 
   * @example
   * ```typescript
   * const session = await adapter.createSession('user-123', {
   *   device: 'Chrome on macOS',
   *   ipAddress: '192.168.1.1'
   * });
   * 
   * // Store session.id in cookie or return to client
   * ```
   */
  createSession(userId: string, attributes?: Record<string, unknown>): Promise<Session>;

  /**
   * Validate a session and return user information
   * 
   * Checks if session exists, is not expired, and returns associated user data.
   * Updates session expiration on successful validation (sliding window).
   * 
   * @param sessionId - Session ID to validate
   * @returns Promise resolving to validation result with session and user
   * 
   * @example
   * ```typescript
   * const result = await adapter.validateSession(sessionId);
   * 
   * if (!result.valid) {
   *   return new Response('Unauthorized', { status: 401 });
   * }
   * 
   * // Access authenticated user
   * console.log('User:', result.user);
   * ```
   */
  validateSession(sessionId: string): Promise<SessionValidationResult>;

  /**
   * Invalidate a session (logout)
   * 
   * Deletes the session from the database, preventing further use.
   * Used for logout and session revocation.
   * 
   * @param sessionId - Session ID to invalidate
   * @returns Promise that resolves when session is invalidated
   * 
   * @example
   * ```typescript
   * await adapter.invalidateSession(sessionId);
   * // Clear session cookie
   * ```
   */
  invalidateSession(sessionId: string): Promise<void>;

  /**
   * Create a new user account
   * 
   * Validates user data, hashes password if provided, and stores user in database.
   * Returns the created user with generated ID.
   * 
   * @param data - User data including email and optional password
   * @returns Promise resolving to the created user
   * 
   * @throws {ConflictError} If user with email already exists
   * @throws {ValidationError} If user data is invalid
   * 
   * @example
   * ```typescript
   * const user = await adapter.createUser({
   *   email: 'user@example.com',
   *   password: 'secure-password',
   *   name: 'John Doe'
   * });
   * ```
   */
  createUser(data: UserData): Promise<User>;

  /**
   * Get a user by ID
   * 
   * Retrieves user data from the database. Returns null if user not found.
   * 
   * @param userId - User ID to retrieve
   * @returns Promise resolving to user or null
   * 
   * @example
   * ```typescript
   * const user = await adapter.getUser('user-123');
   * if (!user) {
   *   return new Response('User not found', { status: 404 });
   * }
   * ```
   */
  getUser(userId: string): Promise<User | null>;

  /**
   * Update user data
   * 
   * Performs partial update of user fields. Password updates are automatically
   * hashed if password field is included.
   * 
   * @param userId - User ID to update
   * @param data - Fields to update
   * @returns Promise resolving to updated user
   * 
   * @throws {NotFoundError} If user doesn't exist
   * 
   * @example
   * ```typescript
   * const user = await adapter.updateUser('user-123', {
   *   name: 'Jane Doe',
   *   emailVerified: true
   * });
   * ```
   */
  updateUser(userId: string, data: Partial<UserData>): Promise<User>;

  /**
   * Hash a password securely
   * 
   * Uses bcrypt or similar algorithm with appropriate cost factor.
   * Should be called before storing passwords in database.
   * 
   * @param password - Plain text password
   * @returns Promise resolving to hashed password
   * 
   * @example
   * ```typescript
   * const hash = await adapter.hashPassword('user-password');
   * // Store hash in database
   * ```
   */
  hashPassword(password: string): Promise<string>;

  /**
   * Verify a password against a hash
   * 
   * Uses timing-safe comparison to prevent timing attacks.
   * Returns true if password matches hash.
   * 
   * @param hash - Stored password hash
   * @param password - Plain text password to verify
   * @returns Promise resolving to true if password matches
   * 
   * @example
   * ```typescript
   * const isValid = await adapter.verifyPassword(user.passwordHash, inputPassword);
   * if (!isValid) {
   *   return new Response('Invalid credentials', { status: 401 });
   * }
   * ```
   */
  verifyPassword(hash: string, password: string): Promise<boolean>;

  /**
   * Get OAuth authorization URL for a provider
   * 
   * Generates the URL to redirect users to for OAuth authentication.
   * Includes state parameter for CSRF protection.
   * 
   * @param provider - OAuth provider name (google, github, etc.)
   * @param state - CSRF state token
   * @returns Authorization URL to redirect user to
   * 
   * @example
   * ```typescript
   * const state = generateRandomState();
   * const url = adapter.getOAuthAuthorizationUrl('google', state);
   * // Redirect user to url
   * ```
   */
  getOAuthAuthorizationUrl(provider: string, state: string): string;

  /**
   * Handle OAuth callback and create/update user
   * 
   * Exchanges authorization code for access token, fetches user profile,
   * and creates or updates user in database.
   * 
   * @param provider - OAuth provider name
   * @param code - Authorization code from OAuth callback
   * @returns Promise resolving to user
   * 
   * @throws {AuthenticationError} If OAuth flow fails
   * 
   * @example
   * ```typescript
   * const user = await adapter.handleOAuthCallback('google', code);
   * const session = await adapter.createSession(user.id);
   * ```
   */
  handleOAuthCallback(provider: string, code: string): Promise<User>;

  /**
   * Create an API key for a user
   * 
   * Generates a secure API key with specified scopes/permissions.
   * Returns the key object with the plain text key (only shown once).
   * 
   * @param userId - User ID to create key for
   * @param scopes - Permission scopes for the key
   * @returns Promise resolving to API key with plain text key
   * 
   * @example
   * ```typescript
   * const apiKey = await adapter.createApiKey('user-123', ['read:users', 'write:posts']);
   * // Return apiKey.key to user (only shown once)
   * ```
   */
  createApiKey(userId: string, scopes: string[]): Promise<ApiKey>;

  /**
   * Validate an API key and return user information
   * 
   * Checks if key exists, is not revoked, and returns associated user and scopes.
   * 
   * @param key - API key to validate
   * @returns Promise resolving to validation result
   * 
   * @example
   * ```typescript
   * const result = await adapter.validateApiKey(apiKey);
   * 
   * if (!result.valid) {
   *   return new Response('Invalid API key', { status: 401 });
   * }
   * 
   * // Check scopes
   * if (!result.scopes.includes('write:posts')) {
   *   return new Response('Insufficient permissions', { status: 403 });
   * }
   * ```
   */
  validateApiKey(key: string): Promise<ApiKeyValidationResult>;

  /**
   * Revoke an API key
   * 
   * Marks the key as revoked, preventing further use.
   * 
   * @param keyId - API key ID to revoke
   * @returns Promise that resolves when key is revoked
   * 
   * @example
   * ```typescript
   * await adapter.revokeApiKey('key-123');
   * ```
   */
  revokeApiKey(keyId: string): Promise<void>;
}

/**
 * Session object
 * 
 * Represents an authenticated user session with expiration and metadata.
 */
export interface Session {
  /** Unique session identifier */
  id: string;
  
  /** User ID associated with session */
  userId: string;
  
  /** Session expiration timestamp */
  expiresAt: Date;
  
  /** Additional session attributes (device info, IP, etc.) */
  attributes: Record<string, unknown>;
}

/**
 * Session validation result
 * 
 * Contains validation status and associated user/session data.
 */
export interface SessionValidationResult {
  /** Whether session is valid and not expired */
  valid: boolean;
  
  /** Session object (only present if valid) */
  session?: Session;
  
  /** User object (only present if valid) */
  user?: User;
}

/**
 * User object
 * 
 * Represents a user account in the system.
 */
export interface User {
  /** Unique user identifier */
  id: string;
  
  /** User email address (unique) */
  email: string;
  
  /** User display name */
  name?: string;
  
  /** Whether email is verified */
  emailVerified?: boolean;
  
  /** User role for authorization */
  role?: string;
  
  /** Account creation timestamp */
  createdAt?: Date;
  
  /** Last update timestamp */
  updatedAt?: Date;
  
  /** Additional user fields */
  [key: string]: unknown;
}

/**
 * User data for creating/updating users
 */
export interface UserData {
  /** User email address (required) */
  email: string;
  
  /** User password (optional, for password-based auth) */
  password?: string;
  
  /** User display name */
  name?: string;
  
  /** User role */
  role?: string;
  
  /** Additional user fields */
  [key: string]: unknown;
}

/**
 * API key object
 * 
 * Represents an API key for programmatic access.
 */
export interface ApiKey {
  /** Unique key identifier */
  id: string;
  
  /** User ID that owns the key */
  userId: string;
  
  /** Plain text key (only returned on creation) */
  key?: string;
  
  /** Hashed key (stored in database) */
  keyHash: string;
  
  /** Permission scopes */
  scopes: string[];
  
  /** Key name/description */
  name?: string;
  
  /** Whether key is revoked */
  revoked: boolean;
  
  /** Key creation timestamp */
  createdAt: Date;
  
  /** Last used timestamp */
  lastUsedAt?: Date;
}

/**
 * API key validation result
 */
export interface ApiKeyValidationResult {
  /** Whether key is valid and not revoked */
  valid: boolean;
  
  /** User ID associated with key */
  userId?: string;
  
  /** Permission scopes */
  scopes?: string[];
  
  /** API key object */
  apiKey?: ApiKey;
}
