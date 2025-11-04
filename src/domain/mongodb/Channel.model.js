/**
 * Channel MongoDB Model
 * Mongoose schema for private channels with invite codes
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

// Generate unique invite code
const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Channel schema
const channelSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Channel name is required'],
    trim: true,
    minlength: [2, 'Channel name must be at least 2 characters'],
    maxlength: [100, 'Channel name cannot exceed 100 characters']
  },

  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },

  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Channel owner is required']
  },

  members: {
    type: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: [],
    validate: {
      validator: function(members) {
        // Check for duplicate members
        const uniqueMembers = [...new Set(members.map(id => id.toString()))];
        return uniqueMembers.length === members.length;
      },
      message: 'Duplicate members are not allowed'
    }
  },

  inviteCode: {
    type: String,
    uppercase: true,
    minlength: [8, 'Invite code must be 8 characters'],
    maxlength: [8, 'Invite code must be 8 characters'],
    match: [/^[A-Z0-9]{8}$/, 'Invite code must contain only uppercase letters and numbers'],
    default: generateInviteCode
  },

  isActive: {
    type: Boolean,
    default: true
  },

  maxMembers: {
    type: Number,
    default: 50,
    min: [2, 'Channel must allow at least 2 members'],
    max: [500, 'Channel cannot exceed 500 members']
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Create indexes for efficient queries
channelSchema.index({ owner: 1 });
channelSchema.index({ members: 1 });
channelSchema.index({ inviteCode: 1 }, { unique: true });
channelSchema.index({ isActive: 1, createdAt: -1 });

// Compound index for owner's active channels
channelSchema.index({ owner: 1, isActive: 1 });

// Pre-save middleware to ensure owner is in members array
channelSchema.pre('save', function(next) {
  // Add owner to members if not already present
  if (!this.members.includes(this.owner)) {
    this.members.unshift(this.owner); // Add owner as first member
  }
  next();
});

// Instance method to add member
channelSchema.methods.addMember = function(userId) {
  if (this.members.length >= this.maxMembers) {
    throw new Error('Channel has reached maximum member limit');
  }
  
  if (!this.members.includes(userId)) {
    this.members.push(userId);
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Instance method to remove member
channelSchema.methods.removeMember = function(userId) {
  // Cannot remove owner
  if (this.owner.toString() === userId.toString()) {
    throw new Error('Cannot remove channel owner');
  }
  
  this.members = this.members.filter(
    memberId => memberId.toString() !== userId.toString()
  );
  
  return this.save();
};

// Instance method to check if user is member
channelSchema.methods.isMember = function(userId) {
  return this.members.some(
    memberId => memberId.toString() === userId.toString()
  );
};

// Static method to find by invite code
channelSchema.statics.findByInviteCode = function(inviteCode) {
  return this.findOne({ 
    inviteCode: inviteCode.toUpperCase(),
    isActive: true 
  });
};

// Static method to find user's channels
channelSchema.statics.findUserChannels = function(userId) {
  return this.find({
    members: userId,
    isActive: true
  })
  .populate('owner', 'name email')
  .populate('members', 'name email')
  .sort({ updatedAt: -1 });
};

// Static method to find channels owned by user
channelSchema.statics.findOwnedChannels = function(userId) {
  return this.find({
    owner: userId,
    isActive: true
  })
  .populate('members', 'name email')
  .sort({ createdAt: -1 });
};

// Virtual for member count
channelSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Ensure virtuals are included in JSON output
channelSchema.set('toJSON', { virtuals: true });

const Channel = mongoose.model('Channel', channelSchema);

export default Channel;
