/**
 * Location Service
 * Business logic for location management with coordinate obfuscation and privacy
 */

import crypto from 'crypto';

class LocationService {
  constructor(locationRepository, userRepository) {
    if (!locationRepository || !userRepository) {
      throw new Error('LocationRepository and UserRepository are required');
    }
    
    this.locationRepository = locationRepository;
    this.userRepository = userRepository;
    
    // Obfuscation settings
    this.obfuscationRange = 0.005; // ~500 meters at equator
    this.saltPrefix = 'location_salt_';
  }

  // Update user location with coordinate obfuscation
  async updateUserLocation(userId, longitude, latitude, accuracy = null) {
    try {
      this._validateUserId(userId);
      this._validateCoordinates(longitude, latitude);
      
      if (accuracy !== null && (typeof accuracy !== 'number' || accuracy <= 0)) {
        throw new Error('Accuracy must be a positive number');
      }

      // Verify user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Obfuscate coordinates for privacy
      const obfuscated = this._obfuscateCoordinates(userId, longitude, latitude);
      
      // Store obfuscated location in Redis with TTL
      const metadata = {
        accuracy: accuracy ? accuracy.toString() : 'unknown',
        originalTimestamp: new Date().toISOString(),
        source: 'user_update'
      };
      
      await this.locationRepository.addUserLocationWithTTL(
        userId,
        obfuscated.longitude,
        obfuscated.latitude,
        86400 // 24 hours TTL
      );

      // Update user's last known location in MongoDB (also obfuscated)
      await this.userRepository.updateLocation(
        userId,
        obfuscated.longitude,
        obfuscated.latitude
      );

      return {
        success: true,
        message: 'Location updated successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  // Get nearby users (returns distance only, no coordinates)
  async getNearbyUsers(userId, radiusKm, limit = 50) {
    try {
      this._validateUserId(userId);
      this._validateRadius(radiusKm);
      
      if (limit <= 0 || limit > 1000) {
        throw new Error('Limit must be between 1 and 1000');
      }

      // Verify user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get user's current location
      const userLocation = await this.locationRepository.getUserLocation(userId);
      if (!userLocation) {
        throw new Error('User location not found');
      }

      // Find nearby users from Redis (fast geospatial query)
      const nearbyUsersRedis = await this.locationRepository.findNearbyUsers(
        userLocation.longitude,
        userLocation.latitude,
        radiusKm,
        userId,
        limit
      );

      if (nearbyUsersRedis.length === 0) {
        return {
          success: true,
          users: [],
          totalCount: 0
        };
      }

      // Get user details from MongoDB for public users only
      const userIds = nearbyUsersRedis.map(u => u.userId || u.member);
      const publicUsers = await this.userRepository.findNearbyPublicUsers(
        userLocation.longitude,
        userLocation.latitude,
        radiusKm,
        userId
      );

      // Combine Redis distance data with MongoDB user data
      const result = [];
      for (const redisUser of nearbyUsersRedis) {
        const userId = redisUser.userId || redisUser.member;
        const mongoUser = publicUsers.find(u => u._id.toString() === userId);
        
        if (mongoUser) {
          result.push({
            userId: mongoUser._id,
            name: mongoUser.name,
            email: mongoUser.email,
            distanceKm: redisUser.distanceKm || Math.round(parseFloat(redisUser.distance) / 1000 * 100) / 100
            // Note: No coordinates returned for privacy
          });
        }
      }

      return {
        success: true,
        users: result,
        totalCount: result.length
      };
    } catch (error) {
      throw error;
    }
  }

  // Get distance between two users (no coordinates returned)
  async getDistanceBetweenUsers(userId1, userId2) {
    try {
      if (!userId1 || !userId2) {
        throw new Error('Both user IDs are required');
      }

      const distance = await this.locationRepository.getDistanceBetweenUsers(userId1, userId2);
      
      if (distance === null) {
        return {
          success: false,
          error: 'One or both users do not have location data'
        };
      }

      return {
        success: true,
        distanceKm: distance
        // Note: No coordinates returned for privacy
      };
    } catch (error) {
      throw error;
    }
  }

  // Remove user location
  async removeUserLocation(userId) {
    try {
      this._validateUserId(userId);
      
      await this.locationRepository.removeUserLocation(userId);

      return {
        success: true,
        message: 'Location removed successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  // Update location privacy settings
  async updateLocationPrivacy(userId, privacySettings) {
    try {
      this._validateUserId(userId);
      this._validatePrivacySettings(privacySettings);
      
      const updatedUser = await this.userRepository.updatePrivacySettings(userId, privacySettings);
      if (!updatedUser) {
        throw new Error('User not found');
      }

      return {
        success: true,
        user: updatedUser,
        message: 'Privacy settings updated successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  // Get user location status (no coordinates)
  async getUserLocationStatus(userId) {
    try {
      this._validateUserId(userId);
      
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const location = await this.locationRepository.getUserLocation(userId);
      const metadata = await this.locationRepository.getUserLocationMetadata(userId);

      return {
        hasLocation: location !== null,
        isPubliclyVisible: user.isPubliclyVisible,
        publicRadiusKm: user.publicRadiusKm,
        lastUpdate: metadata.lastUpdate || null
      };
    } catch (error) {
      throw error;
    }
  }

  // Validate if requesting user can access target user's location
  async validateLocationAccess(requestingUserId, targetUserId) {
    try {
      this._validateUserId(requestingUserId);
      this._validateUserId(targetUserId);
      
      // Users can always access their own location
      if (requestingUserId === targetUserId) {
        return {
          allowed: true,
          reason: 'Own location access'
        };
      }

      // Get target user
      const targetUser = await this.userRepository.findById(targetUserId);
      if (!targetUser) {
        return {
          allowed: false,
          reason: 'Target user not found'
        };
      }

      // Check if target user's location is public
      if (!targetUser.isPubliclyVisible) {
        return {
          allowed: false,
          reason: 'User location is private'
        };
      }

      // Check if requesting user is within target user's public radius
      const distance = await this.locationRepository.getDistanceBetweenUsers(
        requestingUserId,
        targetUserId
      );

      if (distance === null) {
        return {
          allowed: false,
          reason: 'Location data not available'
        };
      }

      if (distance > targetUser.publicRadiusKm) {
        return {
          allowed: false,
          reason: 'Outside public radius'
        };
      }

      return {
        allowed: true,
        reason: 'Access granted'
      };
    } catch (error) {
      throw error;
    }
  }

  // Get location statistics (admin/analytics)
  async getLocationStatistics() {
    try {
      const stats = await this.locationRepository.getLocationStatistics();
      const userStats = await this.userRepository.getStatistics();

      return {
        activeLocations: stats.totalActiveLocations,
        totalUsers: userStats.totalUsers,
        publicUsers: userStats.publicUsers,
        usersWithLocation: userStats.usersWithLocation,
        locationCoverage: userStats.totalUsers > 0 
          ? Math.round((userStats.usersWithLocation / userStats.totalUsers) * 100) 
          : 0
      };
    } catch (error) {
      throw error;
    }
  }

  // Batch update locations (for bulk operations)
  async batchUpdateLocations(locationUpdates) {
    try {
      if (!Array.isArray(locationUpdates)) {
        throw new Error('Location updates must be an array');
      }

      const results = [];
      
      for (const update of locationUpdates) {
        try {
          const { userId, longitude, latitude, accuracy } = update;
          
          const result = await this.updateUserLocation(userId, longitude, latitude, accuracy);
          results.push({ userId, success: true });
        } catch (error) {
          results.push({ 
            userId: update.userId, 
            success: false, 
            error: error.message 
          });
        }
      }

      return {
        success: true,
        results,
        totalProcessed: locationUpdates.length,
        successCount: results.filter(r => r.success).length,
        errorCount: results.filter(r => !r.success).length
      };
    } catch (error) {
      throw error;
    }
  }

  // Calculate area coverage for a user's public radius
  calculatePublicAreaCoverage(publicRadiusKm) {
    try {
      if (typeof publicRadiusKm !== 'number' || publicRadiusKm <= 0) {
        throw new Error('Radius must be a positive number');
      }

      // Calculate area in square kilometers
      const areaKm2 = Math.PI * Math.pow(publicRadiusKm, 2);
      
      return {
        radiusKm: publicRadiusKm,
        areaKm2: Math.round(areaKm2 * 100) / 100,
        areaMiles2: Math.round(areaKm2 * 0.386102 * 100) / 100
      };
    } catch (error) {
      throw error;
    }
  }

  // Private method: Obfuscate coordinates for privacy
  _obfuscateCoordinates(userId, longitude, latitude) {
    // Create deterministic but unpredictable offset based on user ID
    const salt = this.saltPrefix + userId;
    const hash = crypto.createHash('sha256').update(salt).digest('hex');
    
    // Use first 8 characters of hash to generate offset
    const offsetSeed = parseInt(hash.substring(0, 8), 16);
    
    // Generate consistent offsets between -obfuscationRange and +obfuscationRange
    const lngOffset = ((offsetSeed % 10000) / 10000 - 0.5) * 2 * this.obfuscationRange;
    const latOffset = (((offsetSeed >> 16) % 10000) / 10000 - 0.5) * 2 * this.obfuscationRange;
    
    return {
      longitude: longitude + lngOffset,
      latitude: latitude + latOffset
    };
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
    if (typeof radiusKm !== 'number' || radiusKm < 1 || radiusKm > 1000) {
      throw new Error('Radius must be between 1 and 1000 km');
    }
  }

  _validatePrivacySettings(settings) {
    if (typeof settings !== 'object' || settings === null) {
      throw new Error('Privacy settings must be an object');
    }

    if (settings.hasOwnProperty('isPubliclyVisible') && typeof settings.isPubliclyVisible !== 'boolean') {
      throw new Error('isPubliclyVisible must be a boolean');
    }

    if (settings.hasOwnProperty('publicRadiusKm')) {
      if (typeof settings.publicRadiusKm !== 'number' || 
          settings.publicRadiusKm < 1 || 
          settings.publicRadiusKm > 1000) {
        throw new Error('Public radius must be between 1 and 1000 km');
      }
    }
  }
}

export default LocationService;
