/**
 * Location Repository
 * Data access layer for location operations using Redis geospatial operations
 */

import LocationRedis from '../../domain/redis/Location.redis.js';

class LocationRepository {
  constructor(redisClient) {
    if (!redisClient) {
      throw new Error('Redis client is required');
    }
    
    this.locationRedis = new LocationRedis(redisClient);
  }

  // Add user location to geospatial index
  async addUserLocation(userId, longitude, latitude) {
    try {
      this._validateUserId(userId);
      this._validateCoordinates(longitude, latitude);
      
      return await this.locationRedis.addLocation(userId, longitude, latitude);
    } catch (error) {
      throw error;
    }
  }

  // Add user location with metadata
  async addUserLocationWithMetadata(userId, longitude, latitude, metadata = {}) {
    try {
      this._validateUserId(userId);
      this._validateCoordinates(longitude, latitude);
      
      return await this.locationRedis.addLocationWithMetadata(
        userId, longitude, latitude, metadata
      );
    } catch (error) {
      throw error;
    }
  }

  // Add user location with TTL
  async addUserLocationWithTTL(userId, longitude, latitude, ttlSeconds = 86400) {
    try {
      this._validateUserId(userId);
      this._validateCoordinates(longitude, latitude);
      this._validateTTL(ttlSeconds);
      
      return await this.locationRedis.addLocationWithTTL(
        userId, longitude, latitude, ttlSeconds
      );
    } catch (error) {
      throw error;
    }
  }

  // Get user's current location
  async getUserLocation(userId) {
    try {
      this._validateUserId(userId);
      
      return await this.locationRedis.getLocation(userId);
    } catch (error) {
      throw error;
    }
  }

  // Get user location metadata
  async getUserLocationMetadata(userId) {
    try {
      this._validateUserId(userId);
      
      return await this.locationRedis.getLocationMetadata(userId);
    } catch (error) {
      throw error;
    }
  }

  // Find nearby users within radius
  async findNearbyUsers(longitude, latitude, radiusKm, excludeUserId = null, limit = 50) {
    try {
      this._validateCoordinates(longitude, latitude);
      this._validateRadius(radiusKm);
      this._validateLimit(limit);
      
      return await this.locationRedis.getNearbyUsers(
        longitude, latitude, radiusKm, excludeUserId, limit
      );
    } catch (error) {
      throw error;
    }
  }

  // Remove user location
  async removeUserLocation(userId) {
    try {
      this._validateUserId(userId);
      
      return await this.locationRedis.removeLocation(userId);
    } catch (error) {
      throw error;
    }
  }

  // Get distance between two users
  async getDistanceBetweenUsers(userId1, userId2) {
    try {
      if (!userId1 || !userId2) {
        throw new Error('Both user IDs are required');
      }
      
      return await this.locationRedis.getDistanceBetweenUsers(userId1, userId2);
    } catch (error) {
      throw error;
    }
  }

  // Get location TTL
  async getLocationTTL(userId) {
    try {
      this._validateUserId(userId);
      
      return await this.locationRedis.getLocationTTL(userId);
    } catch (error) {
      throw error;
    }
  }

  // Get all locations (for testing/admin purposes)
  async getAllLocations() {
    try {
      return await this.locationRedis.getAllLocations();
    } catch (error) {
      throw error;
    }
  }

  // Clear all locations (for testing/cleanup)
  async clearAllLocations() {
    try {
      return await this.locationRedis.clearAllLocations();
    } catch (error) {
      throw error;
    }
  }

  // Calculate distance between coordinates
  calculateDistance(lng1, lat1, lng2, lat2) {
    try {
      this._validateCoordinates(lng1, lat1);
      this._validateCoordinates(lng2, lat2);
      
      return this.locationRedis.calculateDistance(lng1, lat1, lng2, lat2);
    } catch (error) {
      throw error;
    }
  }

  // Update user location with automatic TTL refresh
  async updateUserLocation(userId, longitude, latitude, ttlSeconds = 86400) {
    try {
      this._validateUserId(userId);
      this._validateCoordinates(longitude, latitude);
      this._validateTTL(ttlSeconds);
      
      // Add location with metadata including timestamp
      const metadata = {
        lastUpdate: new Date().toISOString(),
        source: 'location_update'
      };
      
      return await this.locationRedis.addLocationWithMetadata(
        userId, longitude, latitude, metadata
      );
    } catch (error) {
      throw error;
    }
  }

  // Get nearby users with distance information
  async getNearbyUsersWithDistance(longitude, latitude, radiusKm, excludeUserId = null) {
    try {
      this._validateCoordinates(longitude, latitude);
      this._validateRadius(radiusKm);
      
      const nearbyUsers = await this.locationRedis.getNearbyUsers(
        longitude, latitude, radiusKm, excludeUserId, 50
      );
      
      // Convert distance strings to numbers and add additional metadata
      return nearbyUsers.map(user => ({
        userId: user.member,
        distanceKm: Math.round(parseFloat(user.distance) / 1000 * 100) / 100, // Convert to km, round to 2 decimals
        distanceMeters: Math.round(parseFloat(user.distance))
      }));
    } catch (error) {
      throw error;
    }
  }

  // Check if user has active location
  async hasActiveLocation(userId) {
    try {
      this._validateUserId(userId);
      
      const location = await this.locationRedis.getLocation(userId);
      return location !== null;
    } catch (error) {
      throw error;
    }
  }

  // Get location statistics
  async getLocationStatistics() {
    try {
      const allLocations = await this.locationRedis.getAllLocations();
      
      return {
        totalActiveLocations: allLocations.length,
        users: allLocations.map(loc => loc.member)
      };
    } catch (error) {
      throw error;
    }
  }

  // Batch update multiple user locations
  async batchUpdateLocations(locationUpdates) {
    try {
      if (!Array.isArray(locationUpdates)) {
        throw new Error('Location updates must be an array');
      }
      
      const results = [];
      
      for (const update of locationUpdates) {
        const { userId, longitude, latitude, ttlSeconds = 86400 } = update;
        
        try {
          const result = await this.addUserLocationWithTTL(
            userId, longitude, latitude, ttlSeconds
          );
          results.push({ userId, success: result });
        } catch (error) {
          results.push({ userId, success: false, error: error.message });
        }
      }
      
      return results;
    } catch (error) {
      throw error;
    }
  }

  // Private validation methods
  _validateUserId(userId) {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('User ID is required');
    }
  }

  _validateCoordinates(longitude, latitude) {
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      throw new Error('Coordinates must be numbers');
    }

    if (longitude < -180 || longitude > 180) {
      throw new Error('Invalid longitude: must be between -180 and 180');
    }

    if (latitude < -90 || latitude > 90) {
      throw new Error('Invalid latitude: must be between -90 and 90');
    }
  }

  _validateRadius(radiusKm) {
    if (typeof radiusKm !== 'number' || radiusKm <= 0) {
      throw new Error('Radius must be a positive number');
    }

    if (radiusKm > 1000) {
      throw new Error('Radius cannot exceed 1000 km');
    }
  }

  _validateLimit(limit) {
    if (typeof limit !== 'number' || limit <= 0) {
      throw new Error('Limit must be a positive number');
    }

    if (limit > 1000) {
      throw new Error('Limit cannot exceed 1000');
    }
  }

  _validateTTL(ttlSeconds) {
    if (typeof ttlSeconds !== 'number' || ttlSeconds <= 0) {
      throw new Error('TTL must be a positive number');
    }

    if (ttlSeconds > 86400 * 30) { // 30 days max
      throw new Error('TTL cannot exceed 30 days');
    }
  }
}

export default LocationRepository;
