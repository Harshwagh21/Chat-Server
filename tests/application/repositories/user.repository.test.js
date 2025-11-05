/**
 * User Repository Tests
 * Tests for user data access layer operations
 */

import { jest } from '@jest/globals';
import UserRepository from '../../../src/application/repositories/user.repository.js';
import User from '../../../src/domain/mongodb/User.model.js';

// Mock the User model
jest.mock('../../../src/domain/mongodb/User.model.js');

describe('UserRepository', () => {
  let userRepository;
  let mockUser;

  beforeEach(() => {
    userRepository = new UserRepository();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock user data
    mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'John Doe',
      email: 'john@example.com',
      password: 'hashedpassword123',
      isPubliclyVisible: true,
      publicRadiusKm: 50,
      lastKnownLocation: {
        type: 'Point',
        coordinates: [-122.4194, 37.7749] // San Francisco
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      comparePassword: jest.fn(),
      save: jest.fn()
    };
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      User.mockImplementation(() => ({
        ...mockUser,
        save: jest.fn().mockResolvedValue(mockUser)
      }));

      const result = await userRepository.create(userData);

      expect(User).toHaveBeenCalledWith(userData);
      expect(result).toEqual(mockUser);
    });

    it('should throw error when user creation fails', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const error = new Error('Email already exists');
      User.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(error)
      }));

      await expect(userRepository.create(userData)).rejects.toThrow('Email already exists');
    });

    it('should validate required fields', async () => {
      const invalidUserData = {
        email: 'john@example.com'
        // missing name and password
      };

      const validationError = new Error('Name is required');
      User.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(validationError)
      }));

      await expect(userRepository.create(invalidUserData)).rejects.toThrow('Name is required');
    });
  });

  describe('findById', () => {
    it('should find user by ID successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      User.findById = jest.fn().mockResolvedValue(mockUser);

      const result = await userRepository.findById(userId);

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      User.findById = jest.fn().mockResolvedValue(null);

      const result = await userRepository.findById(userId);

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(result).toBeNull();
    });

    it('should throw error when database operation fails', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const error = new Error('Database connection failed');
      User.findById = jest.fn().mockRejectedValue(error);

      await expect(userRepository.findById(userId)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByEmail', () => {
    it('should find user by email successfully', async () => {
      const email = 'john@example.com';
      User.findOne = jest.fn().mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail(email);

      expect(User.findOne).toHaveBeenCalledWith({ email: email.toLowerCase() });
      expect(result).toEqual(mockUser);
    });

    it('should handle case insensitive email search', async () => {
      const email = 'JOHN@EXAMPLE.COM';
      User.findOne = jest.fn().mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail(email);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'john@example.com' });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      const email = 'nonexistent@example.com';
      User.findOne = jest.fn().mockResolvedValue(null);

      const result = await userRepository.findByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe('updateById', () => {
    it('should update user successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const updateData = { name: 'Jane Doe', isPubliclyVisible: false };
      const updatedUser = { ...mockUser, ...updateData };

      User.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedUser);

      const result = await userRepository.updateById(userId, updateData);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        updateData,
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updatedUser);
    });

    it('should return null when user not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const updateData = { name: 'Jane Doe' };

      User.findByIdAndUpdate = jest.fn().mockResolvedValue(null);

      const result = await userRepository.updateById(userId, updateData);

      expect(result).toBeNull();
    });

    it('should not allow password updates through this method', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const updateData = { name: 'Jane Doe', password: 'newpassword' };
      const sanitizedData = { name: 'Jane Doe' };

      User.findByIdAndUpdate = jest.fn().mockResolvedValue(mockUser);

      await userRepository.updateById(userId, updateData);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        sanitizedData,
        { new: true, runValidators: true }
      );
    });
  });

  describe('updateLocation', () => {
    it('should update user location successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const longitude = -122.4194;
      const latitude = 37.7749;
      const updatedUser = {
        ...mockUser,
        lastKnownLocation: {
          type: 'Point',
          coordinates: [longitude, latitude]
        }
      };

      User.updateLocation = jest.fn().mockResolvedValue(updatedUser);

      const result = await userRepository.updateLocation(userId, longitude, latitude);

      expect(User.updateLocation).toHaveBeenCalledWith(userId, longitude, latitude);
      expect(result).toEqual(updatedUser);
    });

    it('should validate longitude range', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const invalidLongitude = 200; // Invalid: > 180
      const latitude = 37.7749;

      await expect(
        userRepository.updateLocation(userId, invalidLongitude, latitude)
      ).rejects.toThrow('Invalid longitude: must be between -180 and 180');
    });

    it('should validate latitude range', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const longitude = -122.4194;
      const invalidLatitude = 100; // Invalid: > 90

      await expect(
        userRepository.updateLocation(userId, longitude, invalidLatitude)
      ).rejects.toThrow('Invalid latitude: must be between -90 and 90');
    });
  });

  describe('findNearbyPublicUsers', () => {
    it('should find nearby public users successfully', async () => {
      const longitude = -122.4194;
      const latitude = 37.7749;
      const radiusKm = 10;
      const excludeUserId = '507f1f77bcf86cd799439012';
      const nearbyUsers = [mockUser];

      User.findNearbyPublicUsers = jest.fn().mockResolvedValue(nearbyUsers);

      const result = await userRepository.findNearbyPublicUsers(
        longitude, latitude, radiusKm, excludeUserId
      );

      expect(User.findNearbyPublicUsers).toHaveBeenCalledWith(
        longitude, latitude, radiusKm, excludeUserId
      );
      expect(result).toEqual(nearbyUsers);
    });

    it('should return empty array when no nearby users found', async () => {
      const longitude = -122.4194;
      const latitude = 37.7749;
      const radiusKm = 1; // Very small radius

      User.findNearbyPublicUsers = jest.fn().mockResolvedValue([]);

      const result = await userRepository.findNearbyPublicUsers(longitude, latitude, radiusKm);

      expect(result).toEqual([]);
    });

    it('should validate coordinate parameters', async () => {
      const invalidLongitude = 200;
      const latitude = 37.7749;
      const radiusKm = 10;

      await expect(
        userRepository.findNearbyPublicUsers(invalidLongitude, latitude, radiusKm)
      ).rejects.toThrow('Invalid longitude: must be between -180 and 180');
    });
  });

  describe('deleteById', () => {
    it('should delete user successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      User.findByIdAndDelete = jest.fn().mockResolvedValue(mockUser);

      const result = await userRepository.deleteById(userId);

      expect(User.findByIdAndDelete).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      User.findByIdAndDelete = jest.fn().mockResolvedValue(null);

      const result = await userRepository.deleteById(userId);

      expect(result).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true when user exists', async () => {
      const userId = '507f1f77bcf86cd799439011';
      User.exists = jest.fn().mockResolvedValue({ _id: userId });

      const result = await userRepository.exists(userId);

      expect(User.exists).toHaveBeenCalledWith({ _id: userId });
      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      const userId = '507f1f77bcf86cd799439011';
      User.exists = jest.fn().mockResolvedValue(null);

      const result = await userRepository.exists(userId);

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should return total user count', async () => {
      const totalUsers = 150;
      User.countDocuments = jest.fn().mockResolvedValue(totalUsers);

      const result = await userRepository.count();

      expect(User.countDocuments).toHaveBeenCalledWith({});
      expect(result).toBe(totalUsers);
    });

    it('should return count with filter', async () => {
      const publicUsers = 75;
      const filter = { isPubliclyVisible: true };
      User.countDocuments = jest.fn().mockResolvedValue(publicUsers);

      const result = await userRepository.count(filter);

      expect(User.countDocuments).toHaveBeenCalledWith(filter);
      expect(result).toBe(publicUsers);
    });
  });

  describe('findAll', () => {
    it('should return all users with pagination', async () => {
      const users = [mockUser];
      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(users)
      };
      User.find = jest.fn().mockReturnValue(mockQuery);

      const result = await userRepository.findAll({ page: 1, limit: 10 });

      expect(User.find).toHaveBeenCalledWith({});
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual(users);
    });

    it('should apply filters correctly', async () => {
      const users = [mockUser];
      const filter = { isPubliclyVisible: true };
      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(users)
      };
      User.find = jest.fn().mockReturnValue(mockQuery);

      const result = await userRepository.findAll({ filter, page: 1, limit: 10 });

      expect(User.find).toHaveBeenCalledWith(filter);
      expect(result).toEqual(users);
    });
  });
});
