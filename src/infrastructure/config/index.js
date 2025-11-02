/**
 * Configuration Management
 * Loads and validates environment variables
 */

const config = {
  // Server
  PORT: process.env.PORT || 9000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  MONGO_URI: process.env.MONGO_URI || '',
  REDIS_URI: process.env.REDIS_URI || 'redis://localhost:6379',
  
  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Security
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,
  
  // Location
  LOCATION_OBFUSCATION_RADIUS: parseInt(process.env.LOCATION_OBFUSCATION_RADIUS) || 100,
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // CORS
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []
};

// Validate required environment variables
const requiredVars = ['MONGO_URI', 'REDIS_URI', 'JWT_SECRET'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && config.NODE_ENV === 'production') {
  console.error('❌ Missing required environment variables:', missingVars);
  process.exit(1);
}

export default config;
