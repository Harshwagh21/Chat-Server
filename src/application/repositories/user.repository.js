/**
 * User Repository
 * Data access layer for user operations using MongoDB models
 */

import User from '../../domain/mongodb/User.model.js';

class UserRepository {
  // Create a new user
  async create(userData) {
    try {
      const user = new User(userData);
      return await user.save();
    } catch (error) {
      throw error;
    }
  }

  // Find user by ID
  async findById(userId) {
    try {
      return await User.findById(userId);
    } catch (error) {
      throw error;
    }
  }

  // Find user by email (case insensitive)
  async findByEmail(email) {
    try {
      return await User.findOne({ email: email.toLowerCase() });
    } catch (error) {
      throw error;
    }
  }

  // Update user by ID (excludes password updates)
  async updateById(userId, updateData) {
    try {
      // Remove password from update data for security
      const { password, ...sanitizedData } = updateData;
      
      return await User.findByIdAndUpdate(
        userId,
        sanitizedData,
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw error;
    }
  }

  // Update user location with coordinate validation
  async updateLocation(userId, longitude, latitude) {
    try {
      // Validate coordinates
      this._validateCoordinates(longitude, latitude);
      
      return await User.updateLocation(userId, longitude, latitude);
    } catch (error) {
      throw error;
    }
  }

  // Find nearby public users
  async findNearbyPublicUsers(longitude, latitude, radiusKm, excludeUserId = null) {
    try {
      // Validate coordinates
      this._validateCoordinates(longitude, latitude);
      
      // Validate radius
      if (radiusKm <= 0 || radiusKm > 1000) {
        throw new Error('Invalid radius: must be between 1 and 1000 km');
      }
      
      return await User.findNearbyPublicUsers(longitude, latitude, radiusKm, excludeUserId);
    } catch (error) {
      throw error;
    }
  }

  // Delete user by ID
  async deleteById(userId) {
    try {
      return await User.findByIdAndDelete(userId);
    } catch (error) {
      throw error;
    }
  }

  // Check if user exists
  async exists(userId) {
    try {
      const result = await User.exists({ _id: userId });
      return result !== null;
    } catch (error) {
      throw error;
    }
  }

  // Count users with optional filter
  async count(filter = {}) {
    try {
      return await User.countDocuments(filter);
    } catch (error) {
      throw error;
    }
  }

  // Find all users with pagination and filtering
  async findAll(options = {}) {
    try {
      const {
        filter = {},
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = -1
      } = options;

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder };

      return await User.find(filter)
        .skip(skip)
        .limit(limit)
        .sort(sort);
    } catch (error) {
      throw error;
    }
  }

  // Update user password (separate method for security)
  async updatePassword(userId, newPassword) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return null;
      }

      user.password = newPassword;
      return await user.save();
    } catch (error) {
      throw error;
    }
  }

  // Verify user password
  async verifyPassword(userId, candidatePassword) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return false;
      }

      return await user.comparePassword(candidatePassword);
    } catch (error) {
      throw error;
    }
  }

  // Update user privacy settings
  async updatePrivacySettings(userId, privacyData) {
    try {
      const allowedFields = ['isPubliclyVisible', 'publicRadiusKm'];
      const updateData = {};

      // Only allow specific privacy fields
      for (const field of allowedFields) {
        if (privacyData.hasOwnProperty(field)) {
          updateData[field] = privacyData[field];
        }
      }

      return await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw error;
    }
  }

  // Find users by IDs (for batch operations)
  async findByIds(userIds) {
    try {
      return await User.find({ _id: { $in: userIds } });
    } catch (error) {
      throw error;
    }
  }

  // Search users by name or email
  async searchUsers(searchTerm, options = {}) {
    try {
      const { limit = 20, excludeUserId = null } = options;
      
      const searchRegex = new RegExp(searchTerm, 'i');
      const query = {
        $or: [
          { name: searchRegex },
          { email: searchRegex }
        ]
      };

      if (excludeUserId) {
        query._id = { $ne: excludeUserId };
      }

      return await User.find(query)
        .select('name email createdAt')
        .limit(limit)
        .sort({ name: 1 });
    } catch (error) {
      throw error;
    }
  }

  // Get user statistics
  async getStatistics() {
    try {
      const [
        totalUsers,
        publicUsers,
        usersWithLocation,
        recentUsers
      ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ isPubliclyVisible: true }),
        User.countDocuments({ lastKnownLocation: { $exists: true } }),
        User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      ]);

      return {
        totalUsers,
        publicUsers,
        usersWithLocation,
        recentUsers,
        privateUsers: totalUsers - publicUsers
      };
    } catch (error) {
      throw error;
    }
  }

  // Private helper method to validate coordinates
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
}

export default UserRepository;
