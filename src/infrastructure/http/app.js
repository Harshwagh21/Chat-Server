/**
 * Express Application Setup
 * Configures middleware, routes, and error handling
 */

import express from 'express';
import cors from 'cors';
import config from '../config/index.js';

const app = express();

// Security middleware
app.use(cors({
  origin: config.NODE_ENV === 'production' ? config.ALLOWED_ORIGINS : true,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes (will be added as we build them)
// import authRoutes from './routes/auth.routes.js';
// import userRoutes from './routes/user.routes.js';
// import channelRoutes from './routes/channel.routes.js';
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/channels', channelRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(config.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

export default app;
