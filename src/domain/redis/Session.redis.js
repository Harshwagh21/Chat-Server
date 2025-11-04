/**
 * Session Redis Operations
 * Handles user session management using Redis hash operations
 */

class SessionRedis {
  constructor(redisClient) {
    this.client = redisClient;
    this.sessionPrefix = 'session:'; // Prefix for session keys
    this.activeSessionsKey = 'active_sessions'; // Set of active session IDs
  }

  // Create or update user session
  async createSession(userId, sessionData, ttlSeconds = 86400) {
    try {
      const sessionKey = `${this.sessionPrefix}${userId}`;
      
      // Add timestamp to session data and convert all values to strings
      const sessionWithTimestamp = {};
      for (const [key, value] of Object.entries(sessionData)) {
        sessionWithTimestamp[key] = typeof value === 'string' ? value : String(value);
      }
      sessionWithTimestamp.createdAt = new Date().toISOString();
      sessionWithTimestamp.lastActivity = new Date().toISOString();
      
      // Store session data as hash
      await this.client.hSet(sessionKey, sessionWithTimestamp);
      
      // Set TTL for session
      await this.client.expire(sessionKey, ttlSeconds);
      
      // Add to active sessions set
      await this.client.sAdd(this.activeSessionsKey, userId);
      
      return true;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  // Get user session
  async getSession(userId) {
    try {
      const sessionKey = `${this.sessionPrefix}${userId}`;
      const sessionData = await this.client.hGetAll(sessionKey);
      
      // Return null if session doesn't exist
      if (Object.keys(sessionData).length === 0) {
        return null;
      }
      
      return sessionData;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  // Update session data
  async updateSession(userId, updateData) {
    try {
      const sessionKey = `${this.sessionPrefix}${userId}`;
      
      // Check if session exists
      const exists = await this.client.exists(sessionKey);
      if (!exists) {
        return false;
      }
      
      // Add last activity timestamp and convert all values to strings
      const dataWithActivity = {};
      for (const [key, value] of Object.entries(updateData)) {
        dataWithActivity[key] = typeof value === 'string' ? value : String(value);
      }
      dataWithActivity.lastActivity = new Date().toISOString();
      
      // Update session fields
      await this.client.hSet(sessionKey, dataWithActivity);
      return true;
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }

  // Delete user session
  async deleteSession(userId) {
    try {
      const sessionKey = `${this.sessionPrefix}${userId}`;
      
      // Remove from active sessions set
      await this.client.sRem(this.activeSessionsKey, userId);
      
      // Delete session data
      return await this.client.del(sessionKey);
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  // Check if session is valid (exists and not expired)
  async isSessionValid(userId) {
    try {
      const sessionKey = `${this.sessionPrefix}${userId}`;
      const exists = await this.client.exists(sessionKey);
      return exists === 1;
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  }

  // Get session TTL
  async getSessionTTL(userId) {
    try {
      const sessionKey = `${this.sessionPrefix}${userId}`;
      return await this.client.ttl(sessionKey);
    } catch (error) {
      console.error('Error getting session TTL:', error);
      return -1;
    }
  }

  // Refresh session TTL
  async refreshSession(userId, ttlSeconds = 86400) {
    try {
      const sessionKey = `${this.sessionPrefix}${userId}`;
      
      // Check if session exists
      const exists = await this.client.exists(sessionKey);
      if (!exists) {
        return false;
      }
      
      // Update last activity
      await this.client.hSet(sessionKey, {
        lastActivity: new Date().toISOString()
      });
      
      // Refresh TTL
      await this.client.expire(sessionKey, ttlSeconds);
      return true;
    } catch (error) {
      console.error('Error refreshing session:', error);
      throw error;
    }
  }

  // Get all active sessions
  async getAllActiveSessions() {
    try {
      const activeUserIds = await this.client.sMembers(this.activeSessionsKey);
      const sessions = [];
      
      for (const userId of activeUserIds) {
        const sessionData = await this.getSession(userId);
        if (sessionData) {
          sessions.push(sessionData);
        } else {
          // Clean up stale reference
          await this.client.sRem(this.activeSessionsKey, userId);
        }
      }
      
      return sessions;
    } catch (error) {
      console.error('Error getting all active sessions:', error);
      return [];
    }
  }

  // Get active session count
  async getActiveSessionCount() {
    try {
      return await this.client.sCard(this.activeSessionsKey);
    } catch (error) {
      console.error('Error getting active session count:', error);
      return 0;
    }
  }

  // Clear all sessions (for testing)
  async clearAllSessions() {
    try {
      // Get all active session user IDs
      const activeUserIds = await this.client.sMembers(this.activeSessionsKey);
      
      // Delete all session keys
      for (const userId of activeUserIds) {
        const sessionKey = `${this.sessionPrefix}${userId}`;
        await this.client.del(sessionKey);
      }
      
      // Clear active sessions set
      await this.client.del(this.activeSessionsKey);
      
      return true;
    } catch (error) {
      console.error('Error clearing all sessions:', error);
      throw error;
    }
  }

  // Set session field
  async setSessionField(userId, field, value) {
    try {
      const sessionKey = `${this.sessionPrefix}${userId}`;
      
      // Check if session exists
      const exists = await this.client.exists(sessionKey);
      if (!exists) {
        return false;
      }
      
      await this.client.hSet(sessionKey, field, value);
      return true;
    } catch (error) {
      console.error('Error setting session field:', error);
      throw error;
    }
  }

  // Get session field
  async getSessionField(userId, field) {
    try {
      const sessionKey = `${this.sessionPrefix}${userId}`;
      return await this.client.hGet(sessionKey, field);
    } catch (error) {
      console.error('Error getting session field:', error);
      return null;
    }
  }

  // Check if user is online (has active session)
  async isUserOnline(userId) {
    try {
      return await this.client.sIsMember(this.activeSessionsKey, userId);
    } catch (error) {
      console.error('Error checking if user is online:', error);
      return false;
    }
  }

  // Get online users list
  async getOnlineUsers() {
    try {
      return await this.client.sMembers(this.activeSessionsKey);
    } catch (error) {
      console.error('Error getting online users:', error);
      return [];
    }
  }
}

export default SessionRedis;
