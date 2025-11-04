/**
 * Channel Model Tests
 * Tests Channel MongoDB schema, validation, and indexes
 */

import mongoose from 'mongoose';
import { connectDB, disconnectDB, resetConnections } from '../../../src/infrastructure/config/database.js';
import Channel from '../../../src/domain/mongodb/Channel.model.js';
import User from '../../../src/domain/mongodb/User.model.js';

describe('Channel Model', () => {
  let testUser;

  beforeAll(async () => {
    await connectDB();
    
    // Ensure indexes are created
    await User.createIndexes();
    await Channel.createIndexes();
    
    // Create a test user for channel ownership
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await disconnectDB();
    resetConnections();
  });

  beforeEach(async () => {
    // Clean up before each test
    await Channel.deleteMany({});
  });

  describe('Schema Validation', () => {
    test('should create channel with valid data', async () => {
      const channelData = {
        name: 'Test Channel',
        owner: testUser._id,
        members: [testUser._id],
        inviteCode: 'ABC12345'
      };

      const channel = new Channel(channelData);
      const savedChannel = await channel.save();

      expect(savedChannel._id).toBeDefined();
      expect(savedChannel.name).toBe(channelData.name);
      expect(savedChannel.owner.toString()).toBe(testUser._id.toString());
      expect(savedChannel.members).toHaveLength(1);
      expect(savedChannel.inviteCode).toBe(channelData.inviteCode);
    });

    test('should require name field', async () => {
      const channelData = {
        owner: testUser._id,
        members: [testUser._id],
        inviteCode: 'ABC12345'
      };

      const channel = new Channel(channelData);
      await expect(channel.save()).rejects.toThrow(/name.*required/i);
    });

    test('should require owner field', async () => {
      const channelData = {
        name: 'Test Channel',
        members: [testUser._id],
        inviteCode: 'ABC12345'
      };

      const channel = new Channel(channelData);
      await expect(channel.save()).rejects.toThrow(/owner.*required/i);
    });

    test('should require unique invite code', async () => {
      const channelData = {
        name: 'Test Channel',
        owner: testUser._id,
        members: [testUser._id],
        inviteCode: 'ABC12345'
      };

      await Channel.create(channelData);

      const duplicateChannel = new Channel({
        name: 'Another Channel',
        owner: testUser._id,
        members: [testUser._id],
        inviteCode: 'ABC12345' // Same invite code
      });

      await expect(duplicateChannel.save()).rejects.toThrow(/duplicate key/i);
    });

    test('should validate invite code format', async () => {
      const channelData = {
        name: 'Test Channel',
        owner: testUser._id,
        members: [testUser._id],
        inviteCode: 'abc' // Too short
      };

      const channel = new Channel(channelData);
      await expect(channel.save()).rejects.toThrow(/Invite code must be 8 characters/i);
    });

    test('should validate name length', async () => {
      const channelData = {
        name: 'A'.repeat(101), // Too long
        owner: testUser._id,
        members: [testUser._id],
        inviteCode: 'ABC12345'
      };

      const channel = new Channel(channelData);
      await expect(channel.save()).rejects.toThrow(/Channel name cannot exceed 100 characters/i);
    });
  });

  describe('Default Values', () => {
    test('should have default empty members array but add owner automatically', async () => {
      const channelData = {
        name: 'Test Channel',
        owner: testUser._id,
        inviteCode: 'ABC12345'
      };

      const channel = await Channel.create(channelData);
      expect(channel.members).toHaveLength(1);
      expect(channel.members[0].toString()).toBe(testUser._id.toString());
    });

    test('should auto-generate invite code if not provided', async () => {
      const channelData = {
        name: 'Test Channel',
        owner: testUser._id,
        members: [testUser._id]
      };

      const channel = await Channel.create(channelData);
      expect(channel.inviteCode).toBeDefined();
      expect(channel.inviteCode).toMatch(/^[A-Z0-9]{8}$/);
    });
  });

  describe('Member Management', () => {
    test('should allow adding multiple members', async () => {
      const member2 = await User.create({
        name: 'Member 2',
        email: 'member2@example.com',
        password: 'password123'
      });

      const channelData = {
        name: 'Test Channel',
        owner: testUser._id,
        members: [testUser._id, member2._id],
        inviteCode: 'ABC12345'
      };

      const channel = await Channel.create(channelData);
      expect(channel.members).toHaveLength(2);
      expect(channel.members.map(id => id.toString())).toContain(testUser._id.toString());
      expect(channel.members.map(id => id.toString())).toContain(member2._id.toString());
    });

    test('should prevent duplicate members', async () => {
      const channelData = {
        name: 'Test Channel',
        owner: testUser._id,
        members: [testUser._id, testUser._id], // Duplicate member
        inviteCode: 'ABC12345'
      };

      const channel = new Channel(channelData);
      await expect(channel.save()).rejects.toThrow();
    });
  });

  describe('Timestamps', () => {
    test('should have createdAt and updatedAt timestamps', async () => {
      const channel = await Channel.create({
        name: 'Test Channel',
        owner: testUser._id,
        members: [testUser._id],
        inviteCode: 'ABC12345'
      });

      expect(channel.createdAt).toBeDefined();
      expect(channel.updatedAt).toBeDefined();
      expect(channel.createdAt).toBeInstanceOf(Date);
      expect(channel.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Population', () => {
    test('should populate owner and members', async () => {
      // Create a fresh test user for this test
      const freshUser = await User.create({
        name: 'Fresh User',
        email: 'fresh@example.com',
        password: 'password123'
      });

      const channel = await Channel.create({
        name: 'Test Channel',
        owner: freshUser._id,
        members: [freshUser._id],
        inviteCode: 'ABC12345'
      });

      const populatedChannel = await Channel.findById(channel._id)
        .populate('owner', 'name email')
        .populate('members', 'name email');

      expect(populatedChannel.owner).toBeTruthy();
      expect(populatedChannel.owner.name).toBe('Fresh User');
      expect(populatedChannel.members[0]).toBeTruthy();
      expect(populatedChannel.members[0].name).toBe('Fresh User');
    });
  });
});
