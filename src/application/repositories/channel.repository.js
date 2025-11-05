/**
 * Channel Repository
 * Data access layer for channel operations using MongoDB models
 */

import Channel from '../../domain/mongodb/Channel.model.js';

class ChannelRepository {
  // Create a new channel
  async create(channelData) {
    try {
      const channel = new Channel(channelData);
      return await channel.save();
    } catch (error) {
      throw error;
    }
  }

  // Find channel by ID with populated references
  async findById(channelId) {
    try {
      const query = Channel.findById(channelId);
      query.populate('owner', 'name email');
      query.populate('members', 'name email');
      return await query;
    } catch (error) {
      throw error;
    }
  }

  // Find channel by invite code with populated references
  async findByInviteCode(inviteCode) {
    try {
      const query = Channel.findByInviteCode(inviteCode);
      query.populate('owner', 'name email');
      query.populate('members', 'name email');
      return await query;
    } catch (error) {
      throw error;
    }
  }

  // Find all channels where user is a member
  async findUserChannels(userId) {
    try {
      this._validateUserId(userId);
      
      return await Channel.findUserChannels(userId);
    } catch (error) {
      throw error;
    }
  }

  // Find channels owned by user
  async findOwnedChannels(userId) {
    try {
      this._validateUserId(userId);
      
      return await Channel.findOwnedChannels(userId);
    } catch (error) {
      throw error;
    }
  }

  // Update channel by ID (excludes owner and members updates)
  async updateById(channelId, updateData) {
    try {
      // Remove sensitive fields from update data
      const { owner, members, inviteCode, ...sanitizedData } = updateData;
      
      return await Channel.findByIdAndUpdate(
        channelId,
        sanitizedData,
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw error;
    }
  }

  // Add member to channel
  async addMember(channelId, userId) {
    try {
      this._validateChannelId(channelId);
      this._validateUserId(userId);
      
      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      return await channel.addMember(userId);
    } catch (error) {
      throw error;
    }
  }

  // Remove member from channel
  async removeMember(channelId, userId) {
    try {
      this._validateChannelId(channelId);
      this._validateUserId(userId);
      
      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      return await channel.removeMember(userId);
    } catch (error) {
      throw error;
    }
  }

  // Check if user is member of channel
  async isMember(channelId, userId) {
    try {
      this._validateChannelId(channelId);
      this._validateUserId(userId);
      
      const channel = await Channel.findById(channelId);
      if (!channel) {
        return false;
      }

      return channel.isMember(userId);
    } catch (error) {
      throw error;
    }
  }

  // Delete channel by ID
  async deleteById(channelId) {
    try {
      return await Channel.findByIdAndDelete(channelId);
    } catch (error) {
      throw error;
    }
  }

  // Deactivate channel (soft delete)
  async deactivateChannel(channelId) {
    try {
      return await Channel.findByIdAndUpdate(
        channelId,
        { isActive: false },
        { new: true }
      );
    } catch (error) {
      throw error;
    }
  }

  // Reactivate channel
  async reactivateChannel(channelId) {
    try {
      return await Channel.findByIdAndUpdate(
        channelId,
        { isActive: true },
        { new: true }
      );
    } catch (error) {
      throw error;
    }
  }

  // Check if channel exists
  async exists(channelId) {
    try {
      const result = await Channel.exists({ _id: channelId });
      return result !== null;
    } catch (error) {
      throw error;
    }
  }

  // Count channels with optional filter
  async count(filter = {}) {
    try {
      return await Channel.countDocuments(filter);
    } catch (error) {
      throw error;
    }
  }

  // Find all channels with pagination and filtering
  async findAll(options = {}) {
    try {
      const {
        filter = {},
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = -1,
        populate = true
      } = options;

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder };

      const query = Channel.find(filter);
      query.skip(skip);
      query.limit(limit);
      query.sort(sort);

      if (populate) {
        query.populate('owner', 'name email');
      }

      return await query;
    } catch (error) {
      throw error;
    }
  }

  // Search channels by name
  async searchChannels(searchTerm, options = {}) {
    try {
      const { limit = 20, includeInactive = false } = options;
      
      const searchRegex = new RegExp(searchTerm, 'i');
      const query = {
        name: searchRegex
      };

      if (!includeInactive) {
        query.isActive = true;
      }

      return await Channel.find(query)
        .populate('owner', 'name email')
        .limit(limit)
        .sort({ name: 1 });
    } catch (error) {
      throw error;
    }
  }

  // Update channel settings (name, description, maxMembers)
  async updateChannelSettings(channelId, settings) {
    try {
      const allowedFields = ['name', 'description', 'maxMembers'];
      const updateData = {};

      // Only allow specific settings fields
      for (const field of allowedFields) {
        if (settings.hasOwnProperty(field)) {
          updateData[field] = settings[field];
        }
      }

      return await Channel.findByIdAndUpdate(
        channelId,
        updateData,
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw error;
    }
  }

  // Generate new invite code for channel
  async regenerateInviteCode(channelId) {
    try {
      // Generate new invite code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let newInviteCode = '';
      for (let i = 0; i < 8; i++) {
        newInviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      return await Channel.findByIdAndUpdate(
        channelId,
        { inviteCode: newInviteCode },
        { new: true }
      );
    } catch (error) {
      throw error;
    }
  }

  // Get channel member count
  async getMemberCount(channelId) {
    try {
      const channel = await Channel.findById(channelId).select('members');
      return channel ? channel.members.length : 0;
    } catch (error) {
      throw error;
    }
  }

  // Check if channel is at member capacity
  async isAtCapacity(channelId) {
    try {
      const channel = await Channel.findById(channelId).select('members maxMembers');
      if (!channel) {
        return false;
      }
      
      return channel.members.length >= channel.maxMembers;
    } catch (error) {
      throw error;
    }
  }

  // Get channels by multiple IDs
  async findByIds(channelIds) {
    try {
      return await Channel.find({ _id: { $in: channelIds } })
        .populate('owner', 'name email')
        .populate('members', 'name email');
    } catch (error) {
      throw error;
    }
  }

  // Transfer channel ownership
  async transferOwnership(channelId, currentOwnerId, newOwnerId) {
    try {
      this._validateChannelId(channelId);
      this._validateUserId(currentOwnerId);
      this._validateUserId(newOwnerId);

      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      // Verify current owner
      if (channel.owner.toString() !== currentOwnerId) {
        throw new Error('Only channel owner can transfer ownership');
      }

      // Verify new owner is a member
      if (!channel.isMember(newOwnerId)) {
        throw new Error('New owner must be a channel member');
      }

      // Update ownership
      channel.owner = newOwnerId;
      return await channel.save();
    } catch (error) {
      throw error;
    }
  }

  // Get channel statistics
  async getChannelStatistics() {
    try {
      const [
        totalChannels,
        activeChannels,
        recentChannels
      ] = await Promise.all([
        Channel.countDocuments({}),
        Channel.countDocuments({ isActive: true }),
        Channel.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      ]);

      return {
        totalChannels,
        activeChannels,
        inactiveChannels: totalChannels - activeChannels,
        recentChannels
      };
    } catch (error) {
      throw error;
    }
  }

  // Get popular channels (by member count)
  async getPopularChannels(limit = 10) {
    try {
      return await Channel.aggregate([
        { $match: { isActive: true } },
        { $addFields: { memberCount: { $size: '$members' } } },
        { $sort: { memberCount: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'owner',
            foreignField: '_id',
            as: 'owner',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        { $unwind: '$owner' }
      ]);
    } catch (error) {
      throw error;
    }
  }

  // Batch add members to channel
  async batchAddMembers(channelId, userIds) {
    try {
      this._validateChannelId(channelId);
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new Error('User IDs must be a non-empty array');
      }

      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      const results = [];
      
      for (const userId of userIds) {
        try {
          await channel.addMember(userId);
          results.push({ userId, success: true });
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
  _validateChannelId(channelId) {
    if (!channelId || typeof channelId !== 'string' || channelId.trim() === '') {
      throw new Error('Channel ID is required');
    }
  }

  _validateUserId(userId) {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('User ID is required');
    }
  }
}

export default ChannelRepository;
