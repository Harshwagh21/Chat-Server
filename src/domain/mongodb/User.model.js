/**
 * User MongoDB Model
 * Mongoose schema with geospatial indexing and bcrypt password hashing
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import config from '../../infrastructure/config/index.js';

const { Schema } = mongoose;

// User schema with geospatial support
const userSchema = new Schema({
  // Core user fields
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },

  // Location and privacy fields
  isPubliclyVisible: {
    type: Boolean,
    default: false
  },
  
  publicRadiusKm: {
    type: Number,
    default: 50,
    min: [1, 'Public radius must be at least 1 km'],
    max: [1000, 'Public radius cannot exceed 1000 km']
  },
  
  // GeoJSON location with 2dsphere index
  lastKnownLocation: {
    type: {
      type: String,
      enum: ['Point'],
      required: function() { return this.coordinates != null; }
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: function() { return this.type != null; }
    }
  },

  // Notification token for push notifications
  fcmToken: {
    type: String,
    default: null
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password; // Never return password in JSON
      return ret;
    }
  }
});

// Create 2dsphere index for geospatial queries
userSchema.index({ lastKnownLocation: '2dsphere' });

// Create unique index on email for faster lookups and uniqueness
userSchema.index({ email: 1 }, { unique: true });

// Create compound index for public users with location
userSchema.index({ 
  isPubliclyVisible: 1, 
  lastKnownLocation: '2dsphere' 
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash password if it's been modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const saltRounds = config.BCRYPT_SALT_ROUNDS;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static method to find nearby public users
userSchema.statics.findNearbyPublicUsers = function(longitude, latitude, radiusKm, excludeUserId) {
  const query = {
    isPubliclyVisible: true,
    lastKnownLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusKm * 1000 // Convert km to meters
      }
    }
  };

  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  return this.find(query).select('name email lastKnownLocation createdAt');
};

// Static method to update user location
userSchema.statics.updateLocation = function(userId, longitude, latitude) {
  return this.findByIdAndUpdate(
    userId,
    {
      lastKnownLocation: {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    },
    { new: true }
  );
};

const User = mongoose.model('User', userSchema);

export default User;
