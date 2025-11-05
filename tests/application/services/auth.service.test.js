/**
 * Auth Service Tests
 * Tests for authentication business logic
 */

import { jest } from '@jest/globals';
import AuthService from '../../../src/application/services/auth.service.js';

// Mock dependencies
const mockUserRepository = {
  create: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  updateById: jest.fn(),
  verifyPassword: jest.fn(),
  updatePassword: jest.fn()
};

const mockSessionRepository = {
  createSession: jest.fn(),
  getSession: jest.fn(),
  deleteSession: jest.fn(),
  refreshSession: jest.fn(),
  isSessionValid: jest.fn()
};

const mockJwtUtils = {
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn()
};

const mockBcryptUtils = {
  hash: jest.fn(),
  compare: jest.fn()
};

describe('AuthService', () => {
  let authService;
  let mockUser;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    authService = new AuthService(
      mockUserRepository,
      mockSessionRepository,
      mockJwtUtils,
      mockBcryptUtils
    );

    // Mock user data
    mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'John Doe',
      email: 'john@example.com',
      password: 'hashedpassword123',
      isPubliclyVisible: true,
      createdAt: new Date(),
      comparePassword: jest.fn()
    };
  });

  describe('constructor', () => {
    it('should initialize with all required dependencies', () => {
      expect(authService.userRepository).toBe(mockUserRepository);
      expect(authService.sessionRepository).toBe(mockSessionRepository);
      expect(authService.jwtUtils).toBe(mockJwtUtils);
      expect(authService.bcryptUtils).toBe(mockBcryptUtils);
    });

    it('should throw error if dependencies are missing', () => {
      expect(() => new AuthService()).toThrow('All dependencies are required');
      expect(() => new AuthService(mockUserRepository)).toThrow('All dependencies are required');
      expect(() => new AuthService(mockUserRepository, mockSessionRepository)).toThrow('All dependencies are required');
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const token = 'jwt.token.here';
      const sessionData = { userId: mockUser._id, email: mockUser.email };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockUser);
      mockJwtUtils.sign.mockReturnValue(token);
      mockSessionRepository.createSession.mockResolvedValue(true);

      const result = await authService.register(userData);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockUserRepository.create).toHaveBeenCalledWith(userData);
      expect(mockJwtUtils.sign).toHaveBeenCalledWith({ userId: mockUser._id });
      expect(mockSessionRepository.createSession).toHaveBeenCalledWith(
        mockUser._id.toString(),
        expect.objectContaining({
          userId: mockUser._id,
          email: mockUser.email,
          loginTime: expect.any(String)
        }),
        86400
      );
      expect(result).toEqual({
        success: true,
        user: mockUser,
        token,
        message: 'User registered successfully'
      });
    });

    it('should throw error if email already exists', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.register(userData)).rejects.toThrow('Email already registered');
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const invalidData = {
        email: 'john@example.com'
        // missing name and password
      };

      await expect(authService.register(invalidData)).rejects.toThrow('Name is required');

      const invalidData2 = {
        name: 'John Doe'
        // missing email and password
      };

      await expect(authService.register(invalidData2)).rejects.toThrow('Email is required');

      const invalidData3 = {
        name: 'John Doe',
        email: 'john@example.com'
        // missing password
      };

      await expect(authService.register(invalidData3)).rejects.toThrow('Password is required');
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'password123'
      };

      await expect(authService.register(invalidEmailData)).rejects.toThrow('Invalid email format');
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: '123'
      };

      await expect(authService.register(weakPasswordData)).rejects.toThrow('Password must be at least 6 characters long');
    });

    it('should handle database errors during registration', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const dbError = new Error('Database connection failed');
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockRejectedValue(dbError);

      await expect(authService.register(userData)).rejects.toThrow('Database connection failed');
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginData = {
        email: 'john@example.com',
        password: 'password123'
      };

      const token = 'jwt.token.here';
      const sessionData = { userId: mockUser._id, email: mockUser.email };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(true);
      mockJwtUtils.sign.mockReturnValue(token);
      mockSessionRepository.createSession.mockResolvedValue(true);

      const result = await authService.login(loginData);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(loginData.email);
      expect(mockUser.comparePassword).toHaveBeenCalledWith(loginData.password);
      expect(mockJwtUtils.sign).toHaveBeenCalledWith({ userId: mockUser._id });
      expect(mockSessionRepository.createSession).toHaveBeenCalledWith(
        mockUser._id.toString(),
        expect.objectContaining({
          userId: mockUser._id,
          email: mockUser.email,
          loginTime: expect.any(String)
        }),
        86400
      );
      expect(result).toEqual({
        success: true,
        user: mockUser,
        token,
        message: 'Login successful'
      });
    });

    it('should throw error for invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginData)).rejects.toThrow('Invalid email or password');
      expect(mockJwtUtils.sign).not.toHaveBeenCalled();
    });

    it('should throw error for invalid password', async () => {
      const loginData = {
        email: 'john@example.com',
        password: 'wrongpassword'
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(false);

      await expect(authService.login(loginData)).rejects.toThrow('Invalid email or password');
      expect(mockJwtUtils.sign).not.toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const invalidData = {
        password: 'password123'
        // missing email
      };

      await expect(authService.login(invalidData)).rejects.toThrow('Email is required');

      const invalidData2 = {
        email: 'john@example.com'
        // missing password
      };

      await expect(authService.login(invalidData2)).rejects.toThrow('Password is required');
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockSessionRepository.deleteSession.mockResolvedValue(true);

      const result = await authService.logout(userId);

      expect(mockSessionRepository.deleteSession).toHaveBeenCalledWith(userId);
      expect(result).toEqual({
        success: true,
        message: 'Logout successful'
      });
    });

    it('should validate user ID', async () => {
      await expect(authService.logout(null)).rejects.toThrow('User ID is required');
      await expect(authService.logout('')).rejects.toThrow('User ID is required');
    });

    it('should handle session deletion errors', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const error = new Error('Redis connection failed');

      mockSessionRepository.deleteSession.mockRejectedValue(error);

      await expect(authService.logout(userId)).rejects.toThrow('Redis connection failed');
    });
  });

  describe('verifyToken', () => {
    it('should verify token successfully', async () => {
      const token = 'valid.jwt.token';
      const decoded = { userId: '507f1f77bcf86cd799439011' };

      mockJwtUtils.verify.mockReturnValue(decoded);
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockSessionRepository.isSessionValid.mockResolvedValue(true);

      const result = await authService.verifyToken(token);

      expect(mockJwtUtils.verify).toHaveBeenCalledWith(token);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(decoded.userId);
      expect(mockSessionRepository.isSessionValid).toHaveBeenCalledWith(decoded.userId);
      expect(result).toEqual({
        valid: true,
        user: mockUser,
        decoded
      });
    });

    it('should return invalid for malformed token', async () => {
      const token = 'invalid.token';
      const error = new Error('Invalid token');

      mockJwtUtils.verify.mockImplementation(() => {
        throw error;
      });

      const result = await authService.verifyToken(token);

      expect(result).toEqual({
        valid: false,
        error: 'Invalid token'
      });
    });

    it('should return invalid for non-existent user', async () => {
      const token = 'valid.jwt.token';
      const decoded = { userId: '507f1f77bcf86cd799439011' };

      mockJwtUtils.verify.mockReturnValue(decoded);
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await authService.verifyToken(token);

      expect(result).toEqual({
        valid: false,
        error: 'User not found'
      });
    });

    it('should return invalid for expired session', async () => {
      const token = 'valid.jwt.token';
      const decoded = { userId: '507f1f77bcf86cd799439011' };

      mockJwtUtils.verify.mockReturnValue(decoded);
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockSessionRepository.isSessionValid.mockResolvedValue(false);

      const result = await authService.verifyToken(token);

      expect(result).toEqual({
        valid: false,
        error: 'Session expired'
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const oldToken = 'old.jwt.token';
      const newToken = 'new.jwt.token';
      const decoded = { userId: '507f1f77bcf86cd799439011' };

      mockJwtUtils.verify.mockReturnValue(decoded);
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockSessionRepository.isSessionValid.mockResolvedValue(true);
      mockJwtUtils.sign.mockReturnValue(newToken);
      mockSessionRepository.refreshSession.mockResolvedValue(true);

      const result = await authService.refreshToken(oldToken);

      expect(mockJwtUtils.verify).toHaveBeenCalledWith(oldToken);
      expect(mockJwtUtils.sign).toHaveBeenCalledWith({ userId: decoded.userId });
      expect(mockSessionRepository.refreshSession).toHaveBeenCalledWith(decoded.userId, 86400);
      expect(result).toEqual({
        success: true,
        token: newToken,
        user: mockUser
      });
    });

    it('should throw error for invalid token', async () => {
      const token = 'invalid.token';
      const error = new Error('Invalid token');

      mockJwtUtils.verify.mockImplementation(() => {
        throw error;
      });

      await expect(authService.refreshToken(token)).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(true);
      mockUserRepository.updatePassword.mockResolvedValue(mockUser);

      const result = await authService.changePassword(userId, passwordData);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUser.comparePassword).toHaveBeenCalledWith(passwordData.currentPassword);
      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(userId, passwordData.newPassword);
      expect(result).toEqual({
        success: true,
        message: 'Password changed successfully'
      });
    });

    it('should throw error for wrong current password', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(false);

      await expect(authService.changePassword(userId, passwordData)).rejects.toThrow('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: '123'
      };

      await expect(authService.changePassword(userId, passwordData)).rejects.toThrow('New password must be at least 6 characters long');
    });

    it('should throw error if user not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      };

      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.changePassword(userId, passwordData)).rejects.toThrow('User not found');
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser(userId);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(result).toBe(mockUser);
    });

    it('should return null if user not found', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockUserRepository.findById.mockResolvedValue(null);

      const result = await authService.getCurrentUser(userId);

      expect(result).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true for authenticated user', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockSessionRepository.isSessionValid.mockResolvedValue(true);

      const result = await authService.isAuthenticated(userId);

      expect(mockSessionRepository.isSessionValid).toHaveBeenCalledWith(userId);
      expect(result).toBe(true);
    });

    it('should return false for unauthenticated user', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockSessionRepository.isSessionValid.mockResolvedValue(false);

      const result = await authService.isAuthenticated(userId);

      expect(result).toBe(false);
    });
  });
});
