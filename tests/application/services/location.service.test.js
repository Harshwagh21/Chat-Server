/**
 * Location Service Tests
 * Tests for location business logic with coordinate obfuscation
 */

import { jest } from '@jest/globals';
import LocationService from '../../../src/application/services/location.service.js';

// Mock dependencies
const mockLocationRepository = {
  addUserLocation: jest.fn(),
  addUserLocationWithTTL: jest.fn(),
  getUserLocation: jest.fn(),
  getUserLocationMetadata: jest.fn(),
  findNearbyUsers: jest.fn(),
  removeUserLocation: jest.fn(),
  getDistanceBetweenUsers: jest.fn(),
  calculateDistance: jest.fn(),
  getLocationStatistics: jest.fn()
};

const mockUserRepository = {
  findById: jest.fn(),
  updateLocation: jest.fn(),
  findNearbyPublicUsers: jest.fn(),
  updatePrivacySettings: jest.fn(),
  getStatistics: jest.fn()
};

describe('LocationService', () => {
  let locationService;
  let mockUser;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    locationService = new LocationService(mockLocationRepository, mockUserRepository);

    // Mock user data
    mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'John Doe',
      email: 'john@example.com',
      isPubliclyVisible: true,
      publicRadiusKm: 50,
      lastKnownLocation: {
        type: 'Point',
        coordinates: [-122.4194, 37.7749] // San Francisco
      }
    };
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(locationService.locationRepository).toBe(mockLocationRepository);
      expect(locationService.userRepository).toBe(mockUserRepository);
    });

    it('should throw error if dependencies are missing', () => {
      expect(() => new LocationService()).toThrow('LocationRepository and UserRepository are required');
      expect(() => new LocationService(mockLocationRepository)).toThrow('LocationRepository and UserRepository are required');
    });
  });

  describe('updateUserLocation', () => {
    it('should update user location with obfuscation successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const longitude = -122.4194;
      const latitude = 37.7749;
      const accuracy = 10;

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockLocationRepository.addUserLocationWithTTL.mockResolvedValue(true);
      mockUserRepository.updateLocation.mockResolvedValue(mockUser);

      const result = await locationService.updateUserLocation(userId, longitude, latitude, accuracy);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockLocationRepository.addUserLocationWithTTL).toHaveBeenCalled();
      expect(mockUserRepository.updateLocation).toHaveBeenCalled();
      
      // Check that coordinates were obfuscated (should be slightly different)
      const addLocationCall = mockLocationRepository.addUserLocationWithTTL.mock.calls[0];
      const obfuscatedLng = addLocationCall[1];
      const obfuscatedLat = addLocationCall[2];
      
      expect(obfuscatedLng).not.toBe(longitude);
      expect(obfuscatedLat).not.toBe(latitude);
      expect(Math.abs(obfuscatedLng - longitude)).toBeLessThan(0.01); // Within reasonable range
      expect(Math.abs(obfuscatedLat - latitude)).toBeLessThan(0.01);

      expect(result).toEqual({
        success: true,
        message: 'Location updated successfully'
      });
    });

    it('should validate coordinates', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const invalidLongitude = 200;
      const latitude = 37.7749;

      await expect(
        locationService.updateUserLocation(userId, invalidLongitude, latitude)
      ).rejects.toThrow('Invalid longitude: must be between -180 and 180');
    });

    it('should validate user existence', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const longitude = -122.4194;
      const latitude = 37.7749;

      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        locationService.updateUserLocation(userId, longitude, latitude)
      ).rejects.toThrow('User not found');
    });

    it('should validate accuracy parameter', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const longitude = -122.4194;
      const latitude = 37.7749;
      const invalidAccuracy = -5;

      await expect(
        locationService.updateUserLocation(userId, longitude, latitude, invalidAccuracy)
      ).rejects.toThrow('Accuracy must be a positive number');
    });
  });

  describe('getNearbyUsers', () => {
    it('should get nearby users with distance-only responses', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const radiusKm = 10;
      
      const nearbyUsersFromRedis = [
        { userId: 'user456', distanceKm: 2.5 },
        { userId: 'user789', distanceKm: 5.0 }
      ];

      const nearbyUsersFromMongo = [
        { _id: 'user456', name: 'Jane Doe', email: 'jane@example.com' },
        { _id: 'user789', name: 'Bob Smith', email: 'bob@example.com' }
      ];

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockLocationRepository.getUserLocation.mockResolvedValue({
        longitude: -122.4194,
        latitude: 37.7749
      });
      mockLocationRepository.findNearbyUsers.mockResolvedValue(nearbyUsersFromRedis);
      mockUserRepository.findNearbyPublicUsers.mockResolvedValue(nearbyUsersFromMongo);

      const result = await locationService.getNearbyUsers(userId, radiusKm);

      expect(result).toEqual({
        success: true,
        users: [
          {
            userId: 'user456',
            name: 'Jane Doe',
            email: 'jane@example.com',
            distanceKm: 2.5,
            // Note: No coordinates returned for privacy
          },
          {
            userId: 'user789',
            name: 'Bob Smith',
            email: 'bob@example.com',
            distanceKm: 5.0,
          }
        ],
        totalCount: 2
      });
    });

    it('should return empty array when no nearby users found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const radiusKm = 1;

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockLocationRepository.getUserLocation.mockResolvedValue({
        longitude: -122.4194,
        latitude: 37.7749
      });
      mockLocationRepository.findNearbyUsers.mockResolvedValue([]);

      const result = await locationService.getNearbyUsers(userId, radiusKm);

      expect(result).toEqual({
        success: true,
        users: [],
        totalCount: 0
      });
    });

    it('should throw error if user has no location', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const radiusKm = 10;

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockLocationRepository.getUserLocation.mockResolvedValue(null);

      await expect(
        locationService.getNearbyUsers(userId, radiusKm)
      ).rejects.toThrow('User location not found');
    });

    it('should validate radius parameter', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const invalidRadius = 0;

      await expect(
        locationService.getNearbyUsers(userId, invalidRadius)
      ).rejects.toThrow('Radius must be between 1 and 1000 km');
    });
  });

  describe('getDistanceBetweenUsers', () => {
    it('should calculate distance between users without revealing coordinates', async () => {
      const userId1 = '507f1f77bcf86cd799439011';
      const userId2 = '507f1f77bcf86cd799439012';
      const expectedDistance = 5.25;

      mockLocationRepository.getDistanceBetweenUsers.mockResolvedValue(expectedDistance);

      const result = await locationService.getDistanceBetweenUsers(userId1, userId2);

      expect(mockLocationRepository.getDistanceBetweenUsers).toHaveBeenCalledWith(userId1, userId2);
      expect(result).toEqual({
        success: true,
        distanceKm: expectedDistance,
        // Note: No coordinates returned
      });
    });

    it('should return null when one user location not found', async () => {
      const userId1 = '507f1f77bcf86cd799439011';
      const userId2 = '507f1f77bcf86cd799439012';

      mockLocationRepository.getDistanceBetweenUsers.mockResolvedValue(null);

      const result = await locationService.getDistanceBetweenUsers(userId1, userId2);

      expect(result).toEqual({
        success: false,
        error: 'One or both users do not have location data'
      });
    });

    it('should validate user IDs', async () => {
      await expect(
        locationService.getDistanceBetweenUsers(null, 'user456')
      ).rejects.toThrow('Both user IDs are required');

      await expect(
        locationService.getDistanceBetweenUsers('user123', '')
      ).rejects.toThrow('Both user IDs are required');
    });
  });

  describe('removeUserLocation', () => {
    it('should remove user location successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockLocationRepository.removeUserLocation.mockResolvedValue(true);

      const result = await locationService.removeUserLocation(userId);

      expect(mockLocationRepository.removeUserLocation).toHaveBeenCalledWith(userId);
      expect(result).toEqual({
        success: true,
        message: 'Location removed successfully'
      });
    });

    it('should validate user ID', async () => {
      await expect(
        locationService.removeUserLocation('')
      ).rejects.toThrow('User ID is required');
    });
  });

  describe('updateLocationPrivacy', () => {
    it('should update location privacy settings successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const privacySettings = {
        isPubliclyVisible: false,
        publicRadiusKm: 25
      };

      const updatedUser = { ...mockUser, ...privacySettings };
      mockUserRepository.updatePrivacySettings.mockResolvedValue(updatedUser);

      const result = await locationService.updateLocationPrivacy(userId, privacySettings);

      expect(mockUserRepository.updatePrivacySettings).toHaveBeenCalledWith(userId, privacySettings);
      expect(result).toEqual({
        success: true,
        user: updatedUser,
        message: 'Privacy settings updated successfully'
      });
    });

    it('should validate privacy settings', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const invalidSettings = {
        isPubliclyVisible: true,
        publicRadiusKm: 2000 // Too large
      };

      await expect(
        locationService.updateLocationPrivacy(userId, invalidSettings)
      ).rejects.toThrow('Public radius must be between 1 and 1000 km');
    });
  });

  describe('coordinate obfuscation', () => {
    it('should obfuscate coordinates consistently for same user', () => {
      const userId = 'user123';
      const longitude = -122.4194;
      const latitude = 37.7749;

      const obfuscated1 = locationService._obfuscateCoordinates(userId, longitude, latitude);
      const obfuscated2 = locationService._obfuscateCoordinates(userId, longitude, latitude);

      // Should be consistent for same user
      expect(obfuscated1.longitude).toBe(obfuscated2.longitude);
      expect(obfuscated1.latitude).toBe(obfuscated2.latitude);
    });

    it('should obfuscate coordinates differently for different users', () => {
      const longitude = -122.4194;
      const latitude = 37.7749;

      const obfuscated1 = locationService._obfuscateCoordinates('user1', longitude, latitude);
      const obfuscated2 = locationService._obfuscateCoordinates('user2', longitude, latitude);

      // Should be different for different users
      expect(obfuscated1.longitude).not.toBe(obfuscated2.longitude);
      expect(obfuscated1.latitude).not.toBe(obfuscated2.latitude);
    });

    it('should keep obfuscated coordinates within reasonable bounds', () => {
      const userId = 'user123';
      const longitude = -122.4194;
      const latitude = 37.7749;

      const obfuscated = locationService._obfuscateCoordinates(userId, longitude, latitude);

      // Should be close to original but not exact
      expect(Math.abs(obfuscated.longitude - longitude)).toBeLessThan(0.02);
      expect(Math.abs(obfuscated.latitude - latitude)).toBeLessThan(0.02);
      expect(obfuscated.longitude).not.toBe(longitude);
      expect(obfuscated.latitude).not.toBe(latitude);
    });
  });

  describe('getUserLocationStatus', () => {
    it('should return location status for user', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockLocationRepository.getUserLocation.mockResolvedValue({
        longitude: -122.4194,
        latitude: 37.7749
      });
      mockLocationRepository.getUserLocationMetadata.mockResolvedValue({
        lastUpdate: '2023-01-01T00:00:00.000Z'
      });

      const result = await locationService.getUserLocationStatus(userId);

      expect(result).toEqual({
        hasLocation: true,
        isPubliclyVisible: true,
        publicRadiusKm: 50,
        lastUpdate: expect.any(String)
      });
    });

    it('should return status when user has no location', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockLocationRepository.getUserLocation.mockResolvedValue(null);
      mockLocationRepository.getUserLocationMetadata.mockResolvedValue({});

      const result = await locationService.getUserLocationStatus(userId);

      expect(result).toEqual({
        hasLocation: false,
        isPubliclyVisible: true,
        publicRadiusKm: 50,
        lastUpdate: null
      });
    });
  });

  describe('validateLocationAccess', () => {
    it('should allow access for public user within radius', async () => {
      const requestingUserId = '507f1f77bcf86cd799439011';
      const targetUserId = '507f1f77bcf86cd799439012';
      const distance = 25; // Within 50km radius

      const targetUser = { ...mockUser, _id: targetUserId };
      mockUserRepository.findById.mockResolvedValue(targetUser);
      mockLocationRepository.getDistanceBetweenUsers.mockResolvedValue(distance);

      const result = await locationService.validateLocationAccess(requestingUserId, targetUserId);

      expect(result).toEqual({
        allowed: true,
        reason: 'Access granted'
      });
    });

    it('should deny access for private user', async () => {
      const requestingUserId = '507f1f77bcf86cd799439011';
      const targetUserId = '507f1f77bcf86cd799439012';

      const privateUser = { ...mockUser, _id: targetUserId, isPubliclyVisible: false };
      mockUserRepository.findById.mockResolvedValue(privateUser);

      const result = await locationService.validateLocationAccess(requestingUserId, targetUserId);

      expect(result).toEqual({
        allowed: false,
        reason: 'User location is private'
      });
    });

    it('should deny access for user outside radius', async () => {
      const requestingUserId = '507f1f77bcf86cd799439011';
      const targetUserId = '507f1f77bcf86cd799439012';
      const distance = 75; // Outside 50km radius

      const targetUser = { ...mockUser, _id: targetUserId };
      mockUserRepository.findById.mockResolvedValue(targetUser);
      mockLocationRepository.getDistanceBetweenUsers.mockResolvedValue(distance);

      const result = await locationService.validateLocationAccess(requestingUserId, targetUserId);

      expect(result).toEqual({
        allowed: false,
        reason: 'Outside public radius'
      });
    });
  });
});
