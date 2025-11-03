/**
 * Configuration Tests
 * Tests environment configuration loading
 */

import config from '../../../src/infrastructure/config/index.js';

describe('Configuration', () => {
  test('should load default configuration values', () => {
    expect(config).toBeDefined();
    expect(config.PORT).toBeDefined();
    expect(config.NODE_ENV).toBeDefined();
    expect(typeof config.PORT).toBe('number');
    expect(typeof config.NODE_ENV).toBe('string');
  });

  test('should have required database configuration', () => {
    expect(config.MONGO_URI).toBeDefined();
    expect(config.REDIS_URI).toBeDefined();
    expect(typeof config.MONGO_URI).toBe('string');
    expect(typeof config.REDIS_URI).toBe('string');
  });

  test('should have security configuration', () => {
    expect(config.JWT_SECRET).toBeDefined();
    expect(config.BCRYPT_SALT_ROUNDS).toBeDefined();
    expect(typeof config.JWT_SECRET).toBe('string');
    expect(typeof config.BCRYPT_SALT_ROUNDS).toBe('number');
  });
});
