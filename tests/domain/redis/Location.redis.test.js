/**
 * Location Redis Operations Tests
 * Tests Redis GEO operations for location data
 */

import { connectRedis, disconnectRedis, resetConnections } from '../../../src/infrastructure/config/database.js';
import LocationRedis from '../../../src/domain/redis/Location.redis.js';

describe('Location Redis Operations', () => {
  let redisClient;
  let locationRedis;

  beforeAll(async () => {
    redisClient = await connectRedis();
    locationRedis = new LocationRedis(redisClient);
  });

  afterAll(async () => {
    await disconnectRedis();
    resetConnections();
  });

  beforeEach(async () => {
    // Clean up location data before each test
    await locationRedis.clearAllLocations();
  });

  describe('Add Location', () => {
    test('should add user location to geospatial index', async () => {
      const userId = 'user123';
      const longitude = -74.006;
      const latitude = 40.7128;

      await locationRedis.addLocation(userId, longitude, latitude);

      const locations = await locationRedis.getAllLocations();
      expect(locations).toHaveLength(1);
      expect(locations[0].member).toBe(userId);
    });

    test('should update existing user location', async () => {
      const userId = 'user123';
      
      // Add initial location
      await locationRedis.addLocation(userId, -74.006, 40.7128);
      
      // Update location
      await locationRedis.addLocation(userId, -118.2437, 34.0522);

      const locations = await locationRedis.getAllLocations();
      expect(locations).toHaveLength(1); // Should still be only one entry
      
      const userLocation = await locationRedis.getLocation(userId);
      expect(userLocation.longitude).toBeCloseTo(-118.2437, 3);
      expect(userLocation.latitude).toBeCloseTo(34.0522, 3);
    });

    test('should store location metadata', async () => {
      const userId = 'user123';
      const metadata = {
        city: 'New York',
        lastUpdate: new Date().toISOString(),
        isActive: true
      };

      await locationRedis.addLocationWithMetadata(userId, -74.006, 40.7128, metadata);

      const storedMetadata = await locationRedis.getLocationMetadata(userId);
      expect(storedMetadata.city).toBe('New York');
      expect(storedMetadata.isActive).toBe('true'); // Redis stores as string
    });
  });

  describe('Get Nearby Users', () => {
    beforeEach(async () => {
      // Add test users at different locations
      await locationRedis.addLocation('user1', -74.006, 40.7128);   // NYC
      await locationRedis.addLocation('user2', -74.007, 40.7130);   // NYC nearby
      await locationRedis.addLocation('user3', -118.2437, 34.0522); // LA (far)
      await locationRedis.addLocation('user4', -74.008, 40.7125);   // NYC nearby
    });

    test('should find users within radius', async () => {
      const centerLng = -74.006;
      const centerLat = 40.7128;
      const radiusKm = 1; // 1km radius

      const nearbyUsers = await locationRedis.getNearbyUsers(
        centerLng, 
        centerLat, 
        radiusKm
      );

      expect(nearbyUsers.length).toBeGreaterThan(0);
      expect(nearbyUsers.length).toBeLessThan(4); // Should not include LA user
      
      // Should include user1 (same location)
      const userIds = nearbyUsers.map(user => user.member);
      expect(userIds).toContain('user1');
    });

    test('should return users with distances', async () => {
      const nearbyUsers = await locationRedis.getNearbyUsers(-74.006, 40.7128, 5);

      nearbyUsers.forEach(user => {
        expect(user.member).toBeDefined();
        expect(user.distance).toBeDefined();
        expect(typeof user.distance).toBe('string');
      });
    });

    test('should exclude specific user from results', async () => {
      const nearbyUsers = await locationRedis.getNearbyUsers(
        -74.006, 
        40.7128, 
        5,
        'user1' // Exclude user1
      );

      const userIds = nearbyUsers.map(user => user.member);
      expect(userIds).not.toContain('user1');
    });

    test('should limit number of results', async () => {
      const nearbyUsers = await locationRedis.getNearbyUsers(
        -74.006, 
        40.7128, 
        10,
        null,
        2 // Limit to 2 results
      );

      expect(nearbyUsers.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Remove Location', () => {
    test('should remove user location', async () => {
      const userId = 'user123';
      
      await locationRedis.addLocation(userId, -74.006, 40.7128);
      expect(await locationRedis.getLocation(userId)).toBeDefined();

      await locationRedis.removeLocation(userId);
      expect(await locationRedis.getLocation(userId)).toBeNull();
    });

    test('should remove location metadata', async () => {
      const userId = 'user123';
      const metadata = { city: 'NYC' };
      
      await locationRedis.addLocationWithMetadata(userId, -74.006, 40.7128, metadata);
      expect(await locationRedis.getLocationMetadata(userId)).toBeDefined();

      await locationRedis.removeLocation(userId);
      expect(await locationRedis.getLocationMetadata(userId)).toEqual({});
    });
  });

  describe('Location TTL', () => {
    test('should set TTL for location data', async () => {
      const userId = 'user123';
      const ttlSeconds = 3600; // 1 hour

      await locationRedis.addLocationWithTTL(userId, -74.006, 40.7128, ttlSeconds);

      const ttl = await locationRedis.getLocationTTL(userId);
      expect(ttl).toBeGreaterThan(3500); // Should be close to 3600
      expect(ttl).toBeLessThanOrEqual(3600);
    });
  });

  describe('Distance Calculation', () => {
    test('should calculate distance between two points', async () => {
      const distance = locationRedis.calculateDistance(
        -74.006, 40.7128,  // NYC
        -118.2437, 34.0522 // LA
      );

      expect(distance).toBeGreaterThan(3900); // ~3944 km
      expect(distance).toBeLessThan(4000);
    });

    test('should return zero for same coordinates', async () => {
      const distance = locationRedis.calculateDistance(
        -74.006, 40.7128,
        -74.006, 40.7128
      );

      expect(distance).toBe(0);
    });
  });
});
