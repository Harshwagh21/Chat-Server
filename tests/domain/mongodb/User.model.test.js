/**
 * User Model Tests
 * Tests User MongoDB schema, validation, and bcrypt hooks
 */

import mongoose from 'mongoose';
import { connectDB, disconnectDB, resetConnections } from '../../../src/infrastructure/config/database.js';
import User from '../../../src/domain/mongodb/User.model.js';

describe('User Model', () => {
  beforeAll(async () => {
    await connectDB();
    // Ensure indexes are created
    await User.createIndexes();
  });

  afterAll(async () => {
    await disconnectDB();
    resetConnections();
  });

  beforeEach(async () => {
    // Clean up before each test
    await User.deleteMany({});
  });

  describe('Schema Validation', () => {
    test('should create user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        isPubliclyVisible: true,
        publicRadiusKm: 50
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.name).toBe(userData.name);
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.password).not.toBe(userData.password); // Should be hashed
      expect(savedUser.isPubliclyVisible).toBe(true);
      expect(savedUser.publicRadiusKm).toBe(50);
    });

    test('should require name field', async () => {
      const userData = {
        email: 'john@example.com',
        password: 'password123'
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/name.*required/i);
    });

    test('should require email field', async () => {
      const userData = {
        name: 'John Doe',
        password: 'password123'
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/email.*required/i);
    });

    test('should require unique email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      await User.create(userData);
      
      const duplicateUser = new User({
        name: 'Jane Doe',
        email: 'john@example.com',
        password: 'password456'
      });

      await expect(duplicateUser.save()).rejects.toThrow(/duplicate key/i);
    });

    test('should validate email format', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'password123'
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/valid email/i);
    });

    test('should require password field', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/password.*required/i);
    });
  });

  describe('Password Hashing', () => {
    test('should hash password before saving', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const user = new User(userData);
      await user.save();

      expect(user.password).not.toBe('password123');
      expect(user.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
    });

    test('should not rehash password if not modified', async () => {
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      });

      const originalHash = user.password;
      user.name = 'John Smith';
      await user.save();

      expect(user.password).toBe(originalHash);
    });
  });

  describe('Location Fields', () => {
    test('should have default values for location fields', async () => {
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      });

      expect(user.isPubliclyVisible).toBe(false);
      expect(user.publicRadiusKm).toBe(50);
      expect(user.lastKnownLocation).toEqual({});
    });

    test('should accept valid GeoJSON location', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        lastKnownLocation: {
          type: 'Point',
          coordinates: [-74.006, 40.7128] // NYC
        }
      };

      const user = await User.create(userData);
      expect(user.lastKnownLocation.type).toBe('Point');
      expect(user.lastKnownLocation.coordinates).toEqual([-74.006, 40.7128]);
    });

    test('should validate publicRadiusKm range', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        publicRadiusKm: -5 // Invalid negative value
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow(/Public radius must be at least 1 km/i);
    });
  });

  describe('Timestamps', () => {
    test('should have createdAt and updatedAt timestamps', async () => {
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      });

      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });
  });
});
