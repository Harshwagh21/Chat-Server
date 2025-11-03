/**
 * Database Connection Tests
 * Tests MongoDB and Redis connections with proper cleanup
 */

import { connectDB, connectRedis, disconnectDB, disconnectRedis, resetConnections } from '../../../src/infrastructure/config/database.js';
import config from '../../../src/infrastructure/config/index.js';

describe('Database Connections', () => {
  afterAll(async () => {
    // Clean up connections after tests
    await disconnectDB();
    await disconnectRedis();
  });

  describe('MongoDB Connection', () => {
    test('should connect to MongoDB successfully (if URI provided)', async () => {
      // Skip test if no MongoDB URI is provided or is empty/default
      if (!config.MONGO_URI || config.MONGO_URI === '' || config.MONGO_URI.includes('localhost')) {
        console.log('⚠️  Skipping MongoDB test - no production MONGO_URI provided');
        return;
      }
      
      const connection = await connectDB();
      expect(connection).toBeDefined();
      expect(connection.connection.readyState).toBe(1); // Connected state
    });

    test('should return same connection on subsequent calls (singleton)', async () => {
      // Skip test if no MongoDB URI is provided or is empty/default
      if (!config.MONGO_URI || config.MONGO_URI === '' || config.MONGO_URI.includes('localhost')) {
        console.log('⚠️  Skipping MongoDB singleton test - no production MONGO_URI provided');
        return;
      }
      
      const connection1 = await connectDB();
      const connection2 = await connectDB();
      expect(connection1).toBe(connection2); // Should be same instance (singleton)
    });
  });

  describe('Redis Connection', () => {
    test('should connect to Redis successfully (if URI provided)', async () => {
      // Skip test if using default localhost Redis URI
      if (config.REDIS_URI === 'redis://localhost:6379') {
        console.log('⚠️  Skipping Redis test - using default localhost URI');
        return;
      }
      
      const client = await connectRedis();
      expect(client).toBeDefined();
      expect(client.isOpen).toBe(true);
    });

    test('should return same client on subsequent calls (singleton)', async () => {
      // Skip test if using default localhost Redis URI
      if (config.REDIS_URI === 'redis://localhost:6379') {
        console.log('⚠️  Skipping Redis singleton test - using default localhost URI');
        return;
      }
      
      const client1 = await connectRedis();
      const client2 = await connectRedis();
      expect(client1).toBe(client2); // Should be same instance (singleton)
    });

    test('should perform basic Redis operations (if connected)', async () => {
      // Skip test if using default localhost Redis URI
      if (config.REDIS_URI === 'redis://localhost:6379') {
        console.log('⚠️  Skipping Redis operations test - using default localhost URI');
        return;
      }
      
      const client = await connectRedis();
      
      // Test basic set/get operations
      await client.set('test:key', 'test-value');
      const value = await client.get('test:key');
      expect(value).toBe('test-value');
      
      // Clean up test data
      await client.del('test:key');
    });
  });
});
