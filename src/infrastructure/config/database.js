// Database Configuration - Optimized for Cloud Resources
// Efficient MongoDB and Redis connections with connection pooling

import mongoose from 'mongoose';
import { createClient } from 'redis';
import config from './index.js';

// Singleton instances for efficient resource usage
let mongoConnection = null;
let redisClient = null;

// MongoDB connection options for cloud efficiency
const getMongoOptions = () => ({
  maxPoolSize: 32,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
});

// Setup MongoDB event handlers
const setupMongoHandlers = () => {
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });
  
  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
  });
};

// Connect to MongoDB with optimized settings
export const connectDB = async () => {
  if (mongoConnection?.readyState === 1) {
    return mongoConnection;
  }

  try {
    mongoConnection = await mongoose.connect(config.MONGO_URI, getMongoOptions());
    setupMongoHandlers();
    console.log(`📊 MongoDB connected: ${mongoose.connection.host}`);
    return mongoConnection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
};

// Redis connection options for cloud efficiency
const getRedisOptions = () => ({
  url: config.REDIS_URI,
  socket: {
    connectTimeout: 5000,
    lazyConnect: true,
    keepAlive: 30000,
  },
  isolationPoolOptions: {
    min: 1,
    max: 16
  }
});

// Setup Redis event handlers
const setupRedisHandlers = (client) => {
  client.on('error', (err) => {
    console.error('Redis connection error:', err);
  });
  
  client.on('connect', () => {
    console.log('📊 Redis connected');
  });
  
  client.on('ready', () => {
    console.log('✅ Redis ready for operations');
  });
};

// Connect to Redis with optimized settings
export const connectRedis = async () => {
  if (redisClient?.isOpen) {
    return redisClient;
  }

  try {
    redisClient = createClient(getRedisOptions());
    setupRedisHandlers(redisClient);
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    throw error;
  }
};

// Gracefully disconnect from MongoDB
export const disconnectDB = async () => {
  if (mongoConnection) {
    await mongoose.disconnect();
    mongoConnection = null;
    console.log('📊 MongoDB disconnected');
  }
};

// Gracefully disconnect from Redis
export const disconnectRedis = async () => {
  if (redisClient?.isOpen) {
    await redisClient.quit();
    redisClient = null;
    console.log('📊 Redis disconnected');
  }
};

// Get existing MongoDB connection (for repositories)
export const getMongoConnection = () => {
  if (!mongoConnection || mongoConnection.readyState !== 1) {
    throw new Error('MongoDB not connected. Call connectDB() first.');
  }
  return mongoConnection;
};

// Get existing Redis client (for repositories)
export const getRedisClient = () => {
  if (!redisClient?.isOpen) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redisClient;
};

// Reset connections (for testing purposes)
export const resetConnections = () => {
  mongoConnection = null;
  redisClient = null;
};
