/**
 * Session Redis Operations Tests
 * Tests Redis session management operations
 */

import { connectRedis, disconnectRedis, resetConnections } from '../../../src/infrastructure/config/database.js';
import SessionRedis from '../../../src/domain/redis/Session.redis.js';

describe('Session Redis Operations', () => {
  let redisClient;
  let sessionRedis;

  beforeAll(async () => {
    redisClient = await connectRedis();
    sessionRedis = new SessionRedis(redisClient);
  });

  afterAll(async () => {
    await disconnectRedis();
    resetConnections();
  });

  beforeEach(async () => {
    // Clean up session data before each test
    await sessionRedis.clearAllSessions();
  });

  describe('Create Session', () => {
    test('should create user session', async () => {
      const userId = 'user123';
      const sessionData = {
        userId,
        email: 'user@example.com',
        name: 'Test User',
        loginTime: new Date().toISOString()
      };

      await sessionRedis.createSession(userId, sessionData);

      const retrievedSession = await sessionRedis.getSession(userId);
      expect(retrievedSession.userId).toBe(userId);
      expect(retrievedSession.email).toBe('user@example.com');
      expect(retrievedSession.name).toBe('Test User');
    });

    test('should set session TTL', async () => {
      const userId = 'user123';
      const sessionData = { userId, email: 'user@example.com' };
      const ttlSeconds = 3600;

      await sessionRedis.createSession(userId, sessionData, ttlSeconds);

      const ttl = await sessionRedis.getSessionTTL(userId);
      expect(ttl).toBeGreaterThan(3500);
      expect(ttl).toBeLessThanOrEqual(3600);
    });

    test('should update existing session', async () => {
      const userId = 'user123';
      const initialData = { userId, status: 'online' };
      const updatedData = { userId, status: 'away', lastActivity: Date.now() };

      await sessionRedis.createSession(userId, initialData);
      await sessionRedis.createSession(userId, updatedData);

      const session = await sessionRedis.getSession(userId);
      expect(session.status).toBe('away');
      expect(session.lastActivity).toBeDefined();
    });
  });

  describe('Get Session', () => {
    test('should retrieve existing session', async () => {
      const userId = 'user123';
      const sessionData = {
        userId,
        email: 'user@example.com',
        isActive: true
      };

      await sessionRedis.createSession(userId, sessionData);
      const session = await sessionRedis.getSession(userId);

      expect(session.userId).toBe(userId);
      expect(session.email).toBe('user@example.com');
      expect(session.isActive).toBe('true'); // Redis stores as string
    });

    test('should return null for non-existent session', async () => {
      const session = await sessionRedis.getSession('nonexistent');
      expect(session).toBeNull();
    });
  });

  describe('Update Session', () => {
    test('should update session fields', async () => {
      const userId = 'user123';
      const initialData = { userId, status: 'online' };

      await sessionRedis.createSession(userId, initialData);
      await sessionRedis.updateSession(userId, { 
        status: 'busy',
        lastActivity: Date.now()
      });

      const session = await sessionRedis.getSession(userId);
      expect(session.status).toBe('busy');
      expect(session.lastActivity).toBeDefined();
    });

    test('should not update non-existent session', async () => {
      const result = await sessionRedis.updateSession('nonexistent', { status: 'online' });
      expect(result).toBe(false);
    });
  });

  describe('Delete Session', () => {
    test('should delete existing session', async () => {
      const userId = 'user123';
      const sessionData = { userId, email: 'user@example.com' };

      await sessionRedis.createSession(userId, sessionData);
      expect(await sessionRedis.getSession(userId)).toBeDefined();

      await sessionRedis.deleteSession(userId);
      expect(await sessionRedis.getSession(userId)).toBeNull();
    });

    test('should handle deleting non-existent session', async () => {
      const result = await sessionRedis.deleteSession('nonexistent');
      expect(result).toBe(0); // Redis DEL returns 0 for non-existent keys
    });
  });

  describe('Session Validation', () => {
    test('should validate active session', async () => {
      const userId = 'user123';
      const sessionData = { userId, isActive: true };

      await sessionRedis.createSession(userId, sessionData);
      const isValid = await sessionRedis.isSessionValid(userId);

      expect(isValid).toBe(true);
    });

    test('should invalidate expired session', async () => {
      const userId = 'user123';
      const sessionData = { userId, isActive: true };

      await sessionRedis.createSession(userId, sessionData, 1); // 1 second TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const isValid = await sessionRedis.isSessionValid(userId);
      expect(isValid).toBe(false);
    });
  });

  describe('Multiple Sessions', () => {
    test('should handle multiple user sessions', async () => {
      const users = ['user1', 'user2', 'user3'];
      
      for (const userId of users) {
        await sessionRedis.createSession(userId, { 
          userId, 
          email: `${userId}@example.com` 
        });
      }

      for (const userId of users) {
        const session = await sessionRedis.getSession(userId);
        expect(session.userId).toBe(userId);
      }
    });

    test('should get all active sessions', async () => {
      const users = ['user1', 'user2', 'user3'];
      
      for (const userId of users) {
        await sessionRedis.createSession(userId, { userId, status: 'online' });
      }

      const activeSessions = await sessionRedis.getAllActiveSessions();
      expect(activeSessions.length).toBe(3);
      
      const userIds = activeSessions.map(session => session.userId);
      expect(userIds).toEqual(expect.arrayContaining(users));
    });
  });

  describe('Session Refresh', () => {
    test('should refresh session TTL', async () => {
      const userId = 'user123';
      const sessionData = { userId, email: 'user@example.com' };

      await sessionRedis.createSession(userId, sessionData, 3600);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await sessionRedis.refreshSession(userId, 7200); // Extend to 2 hours

      const ttl = await sessionRedis.getSessionTTL(userId);
      expect(ttl).toBeGreaterThan(7100);
      expect(ttl).toBeLessThanOrEqual(7200);
    });
  });
});
