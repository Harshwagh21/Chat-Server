/**
 * Chat-Server - Main Entry Point
 * Clean Architecture: Infrastructure layer entry point
 * 
 * Responsibilities:
 * - Initialize Express app from infrastructure layer
 * - Connect to databases (MongoDB & Redis)
 * - Set up Socket.IO server
 * - Handle graceful shutdown
 */

import 'dotenv/config';
import app from './http/app.js';
import { connectDB, connectRedis } from './config/database.js';
import config from './config/index.js';

const startServer = async () => {
  try {
    console.log('🚀 Starting Radius server...');
    
    // Connect to databases
    console.log('📊 Connecting to databases...');
    await connectDB();
    await connectRedis();
    console.log('✅ Database connections established');
    
    // Start HTTP server
    const server = app.listen(config.PORT, () => {
      console.log(`🌐 Radius server running on port ${config.PORT}`);
      console.log(`📍 Environment: ${config.NODE_ENV}`);
      console.log(`🏗️  Architecture: Clean Architecture (Domain/Application/Infrastructure)`);
    });

    // TODO: Initialize Socket.IO server here when implemented
    // Uncomment imports at top: import { Server } from 'socket.io';
    // import socketHandler from './sockets/index.js';
    // Then initialize: const io = new Server(server);
    // socketHandler(io);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
