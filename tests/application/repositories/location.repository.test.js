/**
 * Location Repository Tests
 * Tests for location data access layer operations using Redis
 */

import { jest } from '@jest/globals';
import LocationRepository from '../../../src/application/repositories/location.repository.js';
import LocationRedis from '../../../src/domain/redis/Location.redis.js';

// Mock the LocationRedis class
jest.mock('../../../src/domain/redis/Location.redis.js');

describe('LocationRepository', () => {
  let locationRepository;
  let mockLocationRedis;
  let mockRedisClient;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock Redis client
    mockRedisClient = {
      geoAdd: jest.fn(),
      geoPos: jest.fn(),
      zRange: jest.fn(),
      zRem: jest.fn(),
      hSet: jest.fn(),
      hGetAll: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn()
    };

    // Mock LocationRedis instance
    mockLocationRedis = {
      addLocation: jest.fn(),
      addLocationWithMetadata: jest.fn(),
      addLocationWithTTL: jest.fn(),
      getLocation: jest.fn(),
      getLocationMetadata: jest.fn(),
      getNearbyUsers: jest.fn(),
      removeLocation: jest.fn(),
      getAllLocations: jest.fn(),
      clearAllLocations: jest.fn(),
      getLocationTTL: jest.fn(),
      calculateDistance: jest.fn(),
      getDistanceBetweenUsers: jest.fn()
    };

    // Mock LocationRedis constructor
    LocationRedis.mockImplementation(() => mockLocationRedis);

    locationRepository = new LocationRepository(mockRedisClient);
  });

  describe('constructor', () => {
    it('should initialize with Redis client', () => {
      expect(LocationRedis).toHaveBeenCalledWith(mockRedisClient);
      expect(locationRepository.locationRedis).toBe(mockLocationRedis);
    });

    it('should throw error if no Redis client provided', () => {
      expect(() => new LocationRepository()).toThrow('Redis client is required');
    });
  });

  describe('addUserLocation', () => {
    it('should add user location successfully', async () => {
      const userId = 'user123';
      const longitude = -122.4194;
      const latitude = 37.7749;

      mockLocationRedis.addLocation.mockResolvedValue(true);

      const result = await locationRepository.addUserLocation(userId, longitude, latitude);

      expect(mockLocationRedis.addLocation).toHaveBeenCalledWith(userId, longitude, latitude);
      expect(result).toBe(true);
    });

    it('should validate coordinates before adding', async () => {
      const userId = 'user123';
      const invalidLongitude = 200;
      const latitude = 37.7749;

      await expect(
        locationRepository.addUserLocation(userId, invalidLongitude, latitude)
      ).rejects.toThrow('Invalid longitude: must be between -180 and 180');

      expect(mockLocationRedis.addLocation).not.toHaveBeenCalled();
    });

    it('should validate user ID', async () => {
      const longitude = -122.4194;
      const latitude = 37.7749;

      await expect(
        locationRepository.addUserLocation(null, longitude, latitude)
      ).rejects.toThrow('User ID is required');

      await expect(
        locationRepository.addUserLocation('', longitude, latitude)
      ).rejects.toThrow('User ID is required');
    });

    it('should handle Redis errors', async () => {
      const userId = 'user123';
      const longitude = -122.4194;
      const latitude = 37.7749;
      const error = new Error('Redis connection failed');

      mockLocationRedis.addLocation.mockRejectedValue(error);

      await expect(
        locationRepository.addUserLocation(userId, longitude, latitude)
      ).rejects.toThrow('Redis connection failed');
    });
  });

  describe('addUserLocationWithMetadata', () => {
    it('should add user location with metadata successfully', async () => {
      const userId = 'user123';
      const longitude = -122.4194;
      const latitude = 37.7749;
      const metadata = { accuracy: 10, speed: 5 };

      mockLocationRedis.addLocationWithMetadata.mockResolvedValue(true);

      const result = await locationRepository.addUserLocationWithMetadata(
        userId, longitude, latitude, metadata
      );

      expect(mockLocationRedis.addLocationWithMetadata).toHaveBeenCalledWith(
        userId, longitude, latitude, metadata
      );
      expect(result).toBe(true);
    });

    it('should handle empty metadata', async () => {
      const userId = 'user123';
      const longitude = -122.4194;
      const latitude = 37.7749;

      mockLocationRedis.addLocationWithMetadata.mockResolvedValue(true);

      const result = await locationRepository.addUserLocationWithMetadata(
        userId, longitude, latitude
      );

      expect(mockLocationRedis.addLocationWithMetadata).toHaveBeenCalledWith(
        userId, longitude, latitude, {}
      );
      expect(result).toBe(true);
    });
  });

  describe('addUserLocationWithTTL', () => {
    it('should add user location with TTL successfully', async () => {
      const userId = 'user123';
      const longitude = -122.4194;
      const latitude = 37.7749;
      const ttlSeconds = 3600;

      mockLocationRedis.addLocationWithTTL.mockResolvedValue(true);

      const result = await locationRepository.addUserLocationWithTTL(
        userId, longitude, latitude, ttlSeconds
      );

      expect(mockLocationRedis.addLocationWithTTL).toHaveBeenCalledWith(
        userId, longitude, latitude, ttlSeconds
      );
      expect(result).toBe(true);
    });

    it('should use default TTL when not provided', async () => {
      const userId = 'user123';
      const longitude = -122.4194;
      const latitude = 37.7749;

      mockLocationRedis.addLocationWithTTL.mockResolvedValue(true);

      await locationRepository.addUserLocationWithTTL(userId, longitude, latitude);

      expect(mockLocationRedis.addLocationWithTTL).toHaveBeenCalledWith(
        userId, longitude, latitude, 86400 // Default 24 hours
      );
    });

    it('should validate TTL value', async () => {
      const userId = 'user123';
      const longitude = -122.4194;
      const latitude = 37.7749;
      const invalidTTL = -100;

      await expect(
        locationRepository.addUserLocationWithTTL(userId, longitude, latitude, invalidTTL)
      ).rejects.toThrow('TTL must be a positive number');
    });
  });

  describe('getUserLocation', () => {
    it('should get user location successfully', async () => {
      const userId = 'user123';
      const expectedLocation = {
        longitude: -122.4194,
        latitude: 37.7749
      };

      mockLocationRedis.getLocation.mockResolvedValue(expectedLocation);

      const result = await locationRepository.getUserLocation(userId);

      expect(mockLocationRedis.getLocation).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedLocation);
    });

    it('should return null when user location not found', async () => {
      const userId = 'user123';

      mockLocationRedis.getLocation.mockResolvedValue(null);

      const result = await locationRepository.getUserLocation(userId);

      expect(result).toBeNull();
    });

    it('should validate user ID', async () => {
      await expect(
        locationRepository.getUserLocation(null)
      ).rejects.toThrow('User ID is required');
    });
  });

  describe('getUserLocationMetadata', () => {
    it('should get user location metadata successfully', async () => {
      const userId = 'user123';
      const expectedMetadata = {
        accuracy: '10',
        speed: '5',
        lastUpdate: '2023-01-01T00:00:00.000Z'
      };

      mockLocationRedis.getLocationMetadata.mockResolvedValue(expectedMetadata);

      const result = await locationRepository.getUserLocationMetadata(userId);

      expect(mockLocationRedis.getLocationMetadata).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedMetadata);
    });

    it('should return empty object when no metadata found', async () => {
      const userId = 'user123';

      mockLocationRedis.getLocationMetadata.mockResolvedValue({});

      const result = await locationRepository.getUserLocationMetadata(userId);

      expect(result).toEqual({});
    });
  });

  describe('findNearbyUsers', () => {
    it('should find nearby users successfully', async () => {
      const longitude = -122.4194;
      const latitude = 37.7749;
      const radiusKm = 10;
      const excludeUserId = 'user123';
      const limit = 20;

      const expectedUsers = [
        { member: 'user456', distance: '500' },
        { member: 'user789', distance: '1000' }
      ];

      mockLocationRedis.getNearbyUsers.mockResolvedValue(expectedUsers);

      const result = await locationRepository.findNearbyUsers(
        longitude, latitude, radiusKm, excludeUserId, limit
      );

      expect(mockLocationRedis.getNearbyUsers).toHaveBeenCalledWith(
        longitude, latitude, radiusKm, excludeUserId, limit
      );
      expect(result).toEqual(expectedUsers);
    });

    it('should use default parameters when not provided', async () => {
      const longitude = -122.4194;
      const latitude = 37.7749;
      const radiusKm = 10;

      mockLocationRedis.getNearbyUsers.mockResolvedValue([]);

      await locationRepository.findNearbyUsers(longitude, latitude, radiusKm);

      expect(mockLocationRedis.getNearbyUsers).toHaveBeenCalledWith(
        longitude, latitude, radiusKm, null, 50
      );
    });

    it('should validate radius parameter', async () => {
      const longitude = -122.4194;
      const latitude = 37.7749;
      const invalidRadius = -5;

      await expect(
        locationRepository.findNearbyUsers(longitude, latitude, invalidRadius)
      ).rejects.toThrow('Radius must be a positive number');
    });

    it('should validate limit parameter', async () => {
      const longitude = -122.4194;
      const latitude = 37.7749;
      const radiusKm = 10;
      const limit = 0;

      await expect(
        locationRepository.findNearbyUsers(longitude, latitude, radiusKm, null, limit)
      ).rejects.toThrow('Limit must be a positive number');
    });
  });

  describe('removeUserLocation', () => {
    it('should remove user location successfully', async () => {
      const userId = 'user123';

      mockLocationRedis.removeLocation.mockResolvedValue(true);

      const result = await locationRepository.removeUserLocation(userId);

      expect(mockLocationRedis.removeLocation).toHaveBeenCalledWith(userId);
      expect(result).toBe(true);
    });

    it('should validate user ID', async () => {
      await expect(
        locationRepository.removeUserLocation('')
      ).rejects.toThrow('User ID is required');
    });
  });

  describe('getDistanceBetweenUsers', () => {
    it('should calculate distance between users successfully', async () => {
      const userId1 = 'user123';
      const userId2 = 'user456';
      const expectedDistance = 5.25;

      mockLocationRedis.getDistanceBetweenUsers.mockResolvedValue(expectedDistance);

      const result = await locationRepository.getDistanceBetweenUsers(userId1, userId2);

      expect(mockLocationRedis.getDistanceBetweenUsers).toHaveBeenCalledWith(userId1, userId2);
      expect(result).toBe(expectedDistance);
    });

    it('should return null when one user location not found', async () => {
      const userId1 = 'user123';
      const userId2 = 'user456';

      mockLocationRedis.getDistanceBetweenUsers.mockResolvedValue(null);

      const result = await locationRepository.getDistanceBetweenUsers(userId1, userId2);

      expect(result).toBeNull();
    });

    it('should validate user IDs', async () => {
      await expect(
        locationRepository.getDistanceBetweenUsers(null, 'user456')
      ).rejects.toThrow('Both user IDs are required');

      await expect(
        locationRepository.getDistanceBetweenUsers('user123', '')
      ).rejects.toThrow('Both user IDs are required');
    });
  });

  describe('getLocationTTL', () => {
    it('should get location TTL successfully', async () => {
      const userId = 'user123';
      const expectedTTL = 3600;

      mockLocationRedis.getLocationTTL.mockResolvedValue(expectedTTL);

      const result = await locationRepository.getLocationTTL(userId);

      expect(mockLocationRedis.getLocationTTL).toHaveBeenCalledWith(userId);
      expect(result).toBe(expectedTTL);
    });

    it('should return -1 when location has no TTL', async () => {
      const userId = 'user123';

      mockLocationRedis.getLocationTTL.mockResolvedValue(-1);

      const result = await locationRepository.getLocationTTL(userId);

      expect(result).toBe(-1);
    });
  });

  describe('getAllLocations', () => {
    it('should get all locations successfully', async () => {
      const expectedLocations = [
        { member: 'user123', longitude: -122.4194, latitude: 37.7749 },
        { member: 'user456', longitude: -122.4094, latitude: 37.7849 }
      ];

      mockLocationRedis.getAllLocations.mockResolvedValue(expectedLocations);

      const result = await locationRepository.getAllLocations();

      expect(mockLocationRedis.getAllLocations).toHaveBeenCalled();
      expect(result).toEqual(expectedLocations);
    });

    it('should return empty array when no locations found', async () => {
      mockLocationRedis.getAllLocations.mockResolvedValue([]);

      const result = await locationRepository.getAllLocations();

      expect(result).toEqual([]);
    });
  });

  describe('clearAllLocations', () => {
    it('should clear all locations successfully', async () => {
      mockLocationRedis.clearAllLocations.mockResolvedValue(true);

      const result = await locationRepository.clearAllLocations();

      expect(mockLocationRedis.clearAllLocations).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between coordinates', () => {
      const lng1 = -122.4194;
      const lat1 = 37.7749;
      const lng2 = -122.4094;
      const lat2 = 37.7849;
      const expectedDistance = 1.23;

      mockLocationRedis.calculateDistance.mockReturnValue(expectedDistance);

      const result = locationRepository.calculateDistance(lng1, lat1, lng2, lat2);

      expect(mockLocationRedis.calculateDistance).toHaveBeenCalledWith(lng1, lat1, lng2, lat2);
      expect(result).toBe(expectedDistance);
    });

    it('should validate all coordinates', () => {
      const validLng = -122.4194;
      const validLat = 37.7749;
      const invalidLng = 200;
      const invalidLat = 100;

      expect(() => {
        locationRepository.calculateDistance(invalidLng, validLat, validLng, validLat);
      }).toThrow('Invalid longitude: must be between -180 and 180');

      expect(() => {
        locationRepository.calculateDistance(validLng, invalidLat, validLng, validLat);
      }).toThrow('Invalid latitude: must be between -90 and 90');

      expect(() => {
        locationRepository.calculateDistance(validLng, validLat, invalidLng, validLat);
      }).toThrow('Invalid longitude: must be between -180 and 180');

      expect(() => {
        locationRepository.calculateDistance(validLng, validLat, validLng, invalidLat);
      }).toThrow('Invalid latitude: must be between -90 and 90');
    });
  });
});
