/**
 * Location Redis Operations
 * Handles geospatial operations for user locations using Redis GEO commands
 */

class LocationRedis {
  constructor(redisClient) {
    this.client = redisClient;
    this.geoKey = 'user_locations'; // Main geospatial index
    this.metadataPrefix = 'location:'; // Prefix for location metadata
  }

  // Add user location to geospatial index
  async addLocation(userId, longitude, latitude) {
    try {
      await this.client.geoAdd(this.geoKey, {
        longitude,
        latitude,
        member: userId
      });
      return true;
    } catch (error) {
      console.error('Error adding location:', error);
      throw error;
    }
  }

  // Add location with metadata
  async addLocationWithMetadata(userId, longitude, latitude, metadata = {}) {
    try {
      // Add to geospatial index
      await this.addLocation(userId, longitude, latitude);
      
      // Store metadata (convert all values to strings for Redis)
      const metadataKey = `${this.metadataPrefix}${userId}`;
      const metadataWithTimestamp = {};
      for (const [key, value] of Object.entries(metadata)) {
        metadataWithTimestamp[key] = typeof value === 'string' ? value : String(value);
      }
      metadataWithTimestamp.lastUpdate = new Date().toISOString();
      metadataWithTimestamp.longitude = longitude.toString();
      metadataWithTimestamp.latitude = latitude.toString();
      
      await this.client.hSet(metadataKey, metadataWithTimestamp);
      return true;
    } catch (error) {
      console.error('Error adding location with metadata:', error);
      throw error;
    }
  }

  // Add location with TTL
  async addLocationWithTTL(userId, longitude, latitude, ttlSeconds = 86400) {
    try {
      await this.addLocation(userId, longitude, latitude);
      
      const metadataKey = `${this.metadataPrefix}${userId}`;
      await this.client.hSet(metadataKey, {
        lastUpdate: new Date().toISOString(),
        longitude: longitude.toString(),
        latitude: latitude.toString()
      });
      
      // Set TTL for metadata
      await this.client.expire(metadataKey, ttlSeconds);
      return true;
    } catch (error) {
      console.error('Error adding location with TTL:', error);
      throw error;
    }
  }

  // Get user's current location
  async getLocation(userId) {
    try {
      const position = await this.client.geoPos(this.geoKey, userId);
      if (!position || !position[0]) {
        return null;
      }
      
      return {
        longitude: parseFloat(position[0].longitude),
        latitude: parseFloat(position[0].latitude)
      };
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  }

  // Get location metadata
  async getLocationMetadata(userId) {
    try {
      const metadataKey = `${this.metadataPrefix}${userId}`;
      return await this.client.hGetAll(metadataKey);
    } catch (error) {
      console.error('Error getting location metadata:', error);
      return {};
    }
  }

  // Find nearby users within radius
  async getNearbyUsers(longitude, latitude, radiusKm, excludeUserId = null, limit = 50) {
    try {
      const radiusMeters = radiusKm * 1000;
      
      // Get all members in the geospatial index
      const allMembers = await this.client.zRange(this.geoKey, 0, -1);
      const nearbyUsers = [];
      
      // Calculate distances manually for each member
      for (const member of allMembers) {
        if (excludeUserId && member === excludeUserId) {
          continue;
        }
        
        const memberLocation = await this.getLocation(member);
        if (memberLocation) {
          const distance = this.calculateDistance(
            longitude, latitude,
            memberLocation.longitude, memberLocation.latitude
          );
          
          // Convert distance to meters and check if within radius
          const distanceMeters = distance * 1000;
          if (distanceMeters <= radiusMeters) {
            nearbyUsers.push({
              member,
              distance: distanceMeters.toString()
            });
          }
        }
      }
      
      // Sort by distance and limit results
      return nearbyUsers
        .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
        .slice(0, limit);
    } catch (error) {
      console.error('Error finding nearby users:', error);
      return [];
    }
  }

  // Remove user location
  async removeLocation(userId) {
    try {
      // Remove from geospatial index
      await this.client.zRem(this.geoKey, userId);
      
      // Remove metadata
      const metadataKey = `${this.metadataPrefix}${userId}`;
      await this.client.del(metadataKey);
      
      return true;
    } catch (error) {
      console.error('Error removing location:', error);
      throw error;
    }
  }

  // Get all locations (for testing)
  async getAllLocations() {
    try {
      const members = await this.client.zRange(this.geoKey, 0, -1);
      const locations = [];
      
      for (const member of members) {
        const position = await this.getLocation(member);
        if (position) {
          locations.push({
            member,
            ...position
          });
        }
      }
      
      return locations;
    } catch (error) {
      console.error('Error getting all locations:', error);
      return [];
    }
  }

  // Clear all location data (for testing)
  async clearAllLocations() {
    try {
      // Get all members first
      const members = await this.client.zRange(this.geoKey, 0, -1);
      
      // Remove geospatial index
      await this.client.del(this.geoKey);
      
      // Remove all metadata
      for (const member of members) {
        const metadataKey = `${this.metadataPrefix}${member}`;
        await this.client.del(metadataKey);
      }
      
      return true;
    } catch (error) {
      console.error('Error clearing all locations:', error);
      throw error;
    }
  }

  // Get location TTL
  async getLocationTTL(userId) {
    try {
      const metadataKey = `${this.metadataPrefix}${userId}`;
      return await this.client.ttl(metadataKey);
    } catch (error) {
      console.error('Error getting location TTL:', error);
      return -1;
    }
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(lng1, lat1, lng2, lat2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100; // Round to 2 decimal places
  }

  // Convert degrees to radians
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Get distance between two users
  async getDistanceBetweenUsers(userId1, userId2) {
    try {
      const location1 = await this.getLocation(userId1);
      const location2 = await this.getLocation(userId2);
      
      if (!location1 || !location2) {
        return null;
      }
      
      return this.calculateDistance(
        location1.longitude, location1.latitude,
        location2.longitude, location2.latitude
      );
    } catch (error) {
      console.error('Error calculating distance between users:', error);
      return null;
    }
  }
}

export default LocationRedis;
