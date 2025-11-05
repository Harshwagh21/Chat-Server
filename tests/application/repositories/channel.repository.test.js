/**
 * Channel Repository Tests
 * Tests for channel data access layer operations
 */

import { jest } from '@jest/globals';
import ChannelRepository from '../../../src/application/repositories/channel.repository.js';
import Channel from '../../../src/domain/mongodb/Channel.model.js';

// Mock the Channel model
jest.mock('../../../src/domain/mongodb/Channel.model.js');

describe('ChannelRepository', () => {
  let channelRepository;
  let mockChannel;

  // Helper function to create proper thenable mocks for Mongoose queries
  const createMockQuery = (resolveValue) => {
    const mockQuery = {};
    
    // Define methods that return the query object itself for chaining
    mockQuery.populate = jest.fn().mockReturnValue(mockQuery);
    mockQuery.skip = jest.fn().mockReturnValue(mockQuery);
    mockQuery.limit = jest.fn().mockReturnValue(mockQuery);
    mockQuery.sort = jest.fn().mockReturnValue(mockQuery);
    
    // Define the then method to make it thenable
    mockQuery.then = jest.fn((resolve) => {
      resolve(resolveValue);
      return Promise.resolve(resolveValue);
    });
    
    // Make it awaitable by adding the Symbol.toStringTag
    mockQuery[Symbol.toStringTag] = 'Promise';
    
    return mockQuery;
  };

  beforeEach(() => {
    channelRepository = new ChannelRepository();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock channel data
    mockChannel = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test Channel',
      description: 'A test channel',
      owner: '507f1f77bcf86cd799439012',
      members: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'],
      inviteCode: 'ABC12345',
      isActive: true,
      maxMembers: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
      isMember: jest.fn(),
      save: jest.fn()
    };
  });

  describe('create', () => {
    it('should create a new channel successfully', async () => {
      const channelData = {
        name: 'Test Channel',
        description: 'A test channel',
        owner: '507f1f77bcf86cd799439012'
      };

      Channel.mockImplementation(() => ({
        ...mockChannel,
        save: jest.fn().mockResolvedValue(mockChannel)
      }));

      const result = await channelRepository.create(channelData);

      expect(Channel).toHaveBeenCalledWith(channelData);
      expect(result).toEqual(mockChannel);
    });

    it('should throw error when channel creation fails', async () => {
      const channelData = {
        name: 'Test Channel',
        owner: '507f1f77bcf86cd799439012'
      };

      const error = new Error('Channel name already exists');
      Channel.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(error)
      }));

      await expect(channelRepository.create(channelData)).rejects.toThrow('Channel name already exists');
    });

    it('should validate required fields', async () => {
      const invalidChannelData = {
        description: 'A test channel'
        // missing name and owner
      };

      const validationError = new Error('Channel name is required');
      Channel.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(validationError)
      }));

      await expect(channelRepository.create(invalidChannelData)).rejects.toThrow('Channel name is required');
    });
  });

  describe('findById', () => {
    it('should find channel by ID successfully', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const mockQuery = createMockQuery(mockChannel);
      Channel.findById = jest.fn().mockReturnValue(mockQuery);

      const result = await channelRepository.findById(channelId);

      expect(Channel.findById).toHaveBeenCalledWith(channelId);
      expect(mockQuery.populate).toHaveBeenCalledWith('owner', 'name email');
      expect(mockQuery.populate).toHaveBeenCalledWith('members', 'name email');
      expect(result).toEqual(mockChannel);
    });

    it('should return null when channel not found', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const mockQuery = createMockQuery(null);
      Channel.findById = jest.fn().mockReturnValue(mockQuery);

      const result = await channelRepository.findById(channelId);

      expect(result).toBeNull();
    });
  });

  describe('findByInviteCode', () => {
    it('should find channel by invite code successfully', async () => {
      const inviteCode = 'ABC12345';
      const mockQuery = createMockQuery(mockChannel);
      Channel.findByInviteCode = jest.fn().mockReturnValue(mockQuery);

      const result = await channelRepository.findByInviteCode(inviteCode);

      expect(Channel.findByInviteCode).toHaveBeenCalledWith(inviteCode);
      expect(mockQuery.populate).toHaveBeenCalledWith('owner', 'name email');
      expect(mockQuery.populate).toHaveBeenCalledWith('members', 'name email');
      expect(result).toEqual(mockChannel);
    });

    it('should handle case insensitive invite code search', async () => {
      const inviteCode = 'abc12345';
      const mockQuery = createMockQuery(mockChannel);
      Channel.findByInviteCode = jest.fn().mockReturnValue(mockQuery);

      await channelRepository.findByInviteCode(inviteCode);

      expect(Channel.findByInviteCode).toHaveBeenCalledWith(inviteCode);
    });

    it('should return null when channel not found', async () => {
      const inviteCode = 'INVALID123';
      const mockQuery = createMockQuery(null);
      Channel.findByInviteCode = jest.fn().mockReturnValue(mockQuery);

      const result = await channelRepository.findByInviteCode(inviteCode);

      expect(result).toBeNull();
    });
  });

  describe('findUserChannels', () => {
    it('should find user channels successfully', async () => {
      const userId = '507f1f77bcf86cd799439012';
      const channels = [mockChannel];

      Channel.findUserChannels = jest.fn().mockResolvedValue(channels);

      const result = await channelRepository.findUserChannels(userId);

      expect(Channel.findUserChannels).toHaveBeenCalledWith(userId);
      expect(result).toEqual(channels);
    });

    it('should return empty array when user has no channels', async () => {
      const userId = '507f1f77bcf86cd799439012';

      Channel.findUserChannels = jest.fn().mockResolvedValue([]);

      const result = await channelRepository.findUserChannels(userId);

      expect(result).toEqual([]);
    });

    it('should validate user ID', async () => {
      await expect(
        channelRepository.findUserChannels(null)
      ).rejects.toThrow('User ID is required');

      await expect(
        channelRepository.findUserChannels('')
      ).rejects.toThrow('User ID is required');
    });
  });

  describe('findOwnedChannels', () => {
    it('should find owned channels successfully', async () => {
      const userId = '507f1f77bcf86cd799439012';
      const ownedChannels = [mockChannel];

      Channel.findOwnedChannels = jest.fn().mockResolvedValue(ownedChannels);

      const result = await channelRepository.findOwnedChannels(userId);

      expect(Channel.findOwnedChannels).toHaveBeenCalledWith(userId);
      expect(result).toEqual(ownedChannels);
    });

    it('should return empty array when user owns no channels', async () => {
      const userId = '507f1f77bcf86cd799439012';

      Channel.findOwnedChannels = jest.fn().mockResolvedValue([]);

      const result = await channelRepository.findOwnedChannels(userId);

      expect(result).toEqual([]);
    });
  });

  describe('updateById', () => {
    it('should update channel successfully', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const updateData = { name: 'Updated Channel', description: 'Updated description' };
      const updatedChannel = { ...mockChannel, ...updateData };

      Channel.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedChannel);

      const result = await channelRepository.updateById(channelId, updateData);

      expect(Channel.findByIdAndUpdate).toHaveBeenCalledWith(
        channelId,
        updateData,
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updatedChannel);
    });

    it('should return null when channel not found', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const updateData = { name: 'Updated Channel' };

      Channel.findByIdAndUpdate = jest.fn().mockResolvedValue(null);

      const result = await channelRepository.updateById(channelId, updateData);

      expect(result).toBeNull();
    });

    it('should not allow owner updates through this method', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const updateData = { name: 'Updated Channel', owner: 'newowner123' };
      const sanitizedData = { name: 'Updated Channel' };

      Channel.findByIdAndUpdate = jest.fn().mockResolvedValue(mockChannel);

      await channelRepository.updateById(channelId, updateData);

      expect(Channel.findByIdAndUpdate).toHaveBeenCalledWith(
        channelId,
        sanitizedData,
        { new: true, runValidators: true }
      );
    });
  });

  describe('addMember', () => {
    it('should add member to channel successfully', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439014';
      const updatedChannel = { ...mockChannel };

      Channel.findById = jest.fn().mockResolvedValue(mockChannel);
      mockChannel.addMember.mockResolvedValue(updatedChannel);

      const result = await channelRepository.addMember(channelId, userId);

      expect(Channel.findById).toHaveBeenCalledWith(channelId);
      expect(mockChannel.addMember).toHaveBeenCalledWith(userId);
      expect(result).toEqual(updatedChannel);
    });

    it('should throw error when channel not found', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439014';

      Channel.findById = jest.fn().mockResolvedValue(null);

      await expect(
        channelRepository.addMember(channelId, userId)
      ).rejects.toThrow('Channel not found');
    });

    it('should validate parameters', async () => {
      await expect(
        channelRepository.addMember(null, 'user123')
      ).rejects.toThrow('Channel ID is required');

      await expect(
        channelRepository.addMember('channel123', null)
      ).rejects.toThrow('User ID is required');
    });
  });

  describe('removeMember', () => {
    it('should remove member from channel successfully', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439013';
      const updatedChannel = { ...mockChannel };

      Channel.findById = jest.fn().mockResolvedValue(mockChannel);
      mockChannel.removeMember.mockResolvedValue(updatedChannel);

      const result = await channelRepository.removeMember(channelId, userId);

      expect(Channel.findById).toHaveBeenCalledWith(channelId);
      expect(mockChannel.removeMember).toHaveBeenCalledWith(userId);
      expect(result).toEqual(updatedChannel);
    });

    it('should throw error when trying to remove owner', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const ownerId = '507f1f77bcf86cd799439012';

      Channel.findById = jest.fn().mockResolvedValue(mockChannel);
      mockChannel.removeMember.mockRejectedValue(new Error('Cannot remove channel owner'));

      await expect(
        channelRepository.removeMember(channelId, ownerId)
      ).rejects.toThrow('Cannot remove channel owner');
    });
  });

  describe('isMember', () => {
    it('should check if user is member successfully', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439013';

      Channel.findById = jest.fn().mockResolvedValue(mockChannel);
      mockChannel.isMember.mockReturnValue(true);

      const result = await channelRepository.isMember(channelId, userId);

      expect(Channel.findById).toHaveBeenCalledWith(channelId);
      expect(mockChannel.isMember).toHaveBeenCalledWith(userId);
      expect(result).toBe(true);
    });

    it('should return false when user is not member', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439015';

      Channel.findById = jest.fn().mockResolvedValue(mockChannel);
      mockChannel.isMember.mockReturnValue(false);

      const result = await channelRepository.isMember(channelId, userId);

      expect(result).toBe(false);
    });

    it('should return false when channel not found', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439013';

      Channel.findById = jest.fn().mockResolvedValue(null);

      const result = await channelRepository.isMember(channelId, userId);

      expect(result).toBe(false);
    });
  });

  describe('deleteById', () => {
    it('should delete channel successfully', async () => {
      const channelId = '507f1f77bcf86cd799439011';

      Channel.findByIdAndDelete = jest.fn().mockResolvedValue(mockChannel);

      const result = await channelRepository.deleteById(channelId);

      expect(Channel.findByIdAndDelete).toHaveBeenCalledWith(channelId);
      expect(result).toEqual(mockChannel);
    });

    it('should return null when channel not found', async () => {
      const channelId = '507f1f77bcf86cd799439011';

      Channel.findByIdAndDelete = jest.fn().mockResolvedValue(null);

      const result = await channelRepository.deleteById(channelId);

      expect(result).toBeNull();
    });
  });

  describe('deactivateChannel', () => {
    it('should deactivate channel successfully', async () => {
      const channelId = '507f1f77bcf86cd799439011';
      const deactivatedChannel = { ...mockChannel, isActive: false };

      Channel.findByIdAndUpdate = jest.fn().mockResolvedValue(deactivatedChannel);

      const result = await channelRepository.deactivateChannel(channelId);

      expect(Channel.findByIdAndUpdate).toHaveBeenCalledWith(
        channelId,
        { isActive: false },
        { new: true }
      );
      expect(result).toEqual(deactivatedChannel);
    });
  });

  describe('count', () => {
    it('should return total channel count', async () => {
      const totalChannels = 25;
      Channel.countDocuments = jest.fn().mockResolvedValue(totalChannels);

      const result = await channelRepository.count();

      expect(Channel.countDocuments).toHaveBeenCalledWith({});
      expect(result).toBe(totalChannels);
    });

    it('should return count with filter', async () => {
      const activeChannels = 20;
      const filter = { isActive: true };
      Channel.countDocuments = jest.fn().mockResolvedValue(activeChannels);

      const result = await channelRepository.count(filter);

      expect(Channel.countDocuments).toHaveBeenCalledWith(filter);
      expect(result).toBe(activeChannels);
    });
  });

  describe('findAll', () => {
    it('should return all channels with pagination', async () => {
      const channels = [mockChannel];
      const mockQuery = createMockQuery(channels);
      Channel.find = jest.fn().mockReturnValue(mockQuery);

      const result = await channelRepository.findAll({ page: 1, limit: 10 });

      expect(Channel.find).toHaveBeenCalledWith({});
      expect(mockQuery.populate).toHaveBeenCalledWith('owner', 'name email');
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual(channels);
    });
  });

  describe('searchChannels', () => {
    it('should search channels by name successfully', async () => {
      const searchTerm = 'test';
      const channels = [mockChannel];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(channels)
      };
      Channel.find = jest.fn().mockReturnValue(mockQuery);

      const result = await channelRepository.searchChannels(searchTerm);

      expect(Channel.find).toHaveBeenCalledWith({
        name: new RegExp(searchTerm, 'i'),
        isActive: true
      });
      expect(result).toEqual(channels);
    });
  });

  describe('getChannelStatistics', () => {
    it('should return channel statistics', async () => {
      const totalChannels = 25;
      const activeChannels = 20;
      const recentChannels = 5;

      Channel.countDocuments = jest.fn()
        .mockResolvedValueOnce(totalChannels)
        .mockResolvedValueOnce(activeChannels)
        .mockResolvedValueOnce(recentChannels);

      const result = await channelRepository.getChannelStatistics();

      expect(result).toEqual({
        totalChannels,
        activeChannels,
        inactiveChannels: 5,
        recentChannels
      });
    });
  });
});
