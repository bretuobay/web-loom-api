/**
 * Mock authentication adapter for testing
 */
import { randomUUID } from './factory';

export interface MockUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

export interface MockSession {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface MockAuth {
  /** Create a test user */
  createUser(data: Partial<MockUser> & { email: string }): MockUser;
  /** Create a session for a user */
  createSession(userId: string, options?: { expiresIn?: number }): MockSession;
  /** Validate a session by ID */
  validateSession(sessionId: string): MockSession | null;
  /** Get all created users */
  getUsers(): MockUser[];
  /** Get all active sessions */
  getSessions(): MockSession[];
  /** Reset all users and sessions */
  reset(): void;
}

export function createMockAuth(): MockAuth {
  let users: MockUser[] = [];
  let sessions: MockSession[] = [];

  const auth: MockAuth = {
    createUser(data: Partial<MockUser> & { email: string }): MockUser {
      const user: MockUser = {
        id: randomUUID(),
        role: 'user',
        ...data,
      } as MockUser;
      users.push(user);
      return user;
    },

    createSession(userId: string, options?: { expiresIn?: number }): MockSession {
      const user = users.find((u) => u.id === userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      const now = new Date();
      const expiresIn = options?.expiresIn ?? 3600000; // 1 hour default
      const session: MockSession = {
        id: randomUUID(),
        userId,
        createdAt: now,
        expiresAt: new Date(now.getTime() + expiresIn),
      };
      sessions.push(session);
      return session;
    },

    validateSession(sessionId: string): MockSession | null {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return null;
      if (session.expiresAt < new Date()) return null;
      return session;
    },

    getUsers(): MockUser[] {
      return [...users];
    },

    getSessions(): MockSession[] {
      return [...sessions];
    },

    reset(): void {
      users = [];
      sessions = [];
    },
  };

  return auth;
}
