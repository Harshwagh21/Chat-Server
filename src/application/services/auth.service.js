/**
 * Auth Service
 * Business logic for user authentication and authorization
 */

class AuthService {
  constructor(userRepository, sessionRepository, jwtUtils, bcryptUtils) {
    if (!userRepository || !sessionRepository || !jwtUtils || !bcryptUtils) {
      throw new Error('All dependencies are required');
    }
    
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.jwtUtils = jwtUtils;
    this.bcryptUtils = bcryptUtils;
  }

  // Register a new user
  async register(userData) {
    try {
      // Validate input data
      this._validateRegistrationData(userData);
      
      const { name, email, password } = userData;
      
      // Check if email already exists
      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Create new user (password will be hashed by the model)
      const user = await this.userRepository.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password
      });

      // Generate JWT token
      const token = this.jwtUtils.sign({ userId: user._id });

      // Create session
      const sessionData = {
        userId: user._id,
        email: user.email,
        loginTime: new Date().toISOString()
      };
      
      await this.sessionRepository.createSession(
        user._id.toString(),
        sessionData,
        86400 // 24 hours
      );

      return {
        success: true,
        user,
        token,
        message: 'User registered successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  // Login user
  async login(loginData) {
    try {
      // Validate input data
      this._validateLoginData(loginData);
      
      const { email, password } = loginData;
      
      // Find user by email
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Generate JWT token
      const token = this.jwtUtils.sign({ userId: user._id });

      // Create/update session
      const sessionData = {
        userId: user._id,
        email: user.email,
        loginTime: new Date().toISOString()
      };
      
      await this.sessionRepository.createSession(
        user._id.toString(),
        sessionData,
        86400 // 24 hours
      );

      return {
        success: true,
        user,
        token,
        message: 'Login successful'
      };
    } catch (error) {
      throw error;
    }
  }

  // Logout user
  async logout(userId) {
    try {
      this._validateUserId(userId);
      
      // Delete session
      await this.sessionRepository.deleteSession(userId);

      return {
        success: true,
        message: 'Logout successful'
      };
    } catch (error) {
      throw error;
    }
  }

  // Verify JWT token and session
  async verifyToken(token) {
    try {
      // Verify JWT token
      const decoded = this.jwtUtils.verify(token);
      
      // Check if user exists
      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        return {
          valid: false,
          error: 'User not found'
        };
      }

      // Check if session is valid
      const isSessionValid = await this.sessionRepository.isSessionValid(decoded.userId);
      if (!isSessionValid) {
        return {
          valid: false,
          error: 'Session expired'
        };
      }

      return {
        valid: true,
        user,
        decoded
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Refresh JWT token
  async refreshToken(token) {
    try {
      // Verify current token
      const decoded = this.jwtUtils.verify(token);
      
      // Check if user exists
      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        throw new Error('Invalid or expired token');
      }

      // Check if session is valid
      const isSessionValid = await this.sessionRepository.isSessionValid(decoded.userId);
      if (!isSessionValid) {
        throw new Error('Invalid or expired token');
      }

      // Generate new token
      const newToken = this.jwtUtils.sign({ userId: decoded.userId });

      // Refresh session
      await this.sessionRepository.refreshSession(decoded.userId, 86400);

      return {
        success: true,
        token: newToken,
        user
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Change user password
  async changePassword(userId, passwordData) {
    try {
      this._validateUserId(userId);
      this._validatePasswordChangeData(passwordData);
      
      const { currentPassword, newPassword } = passwordData;
      
      // Find user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      await this.userRepository.updatePassword(userId, newPassword);

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  // Get current user
  async getCurrentUser(userId) {
    try {
      this._validateUserId(userId);
      
      return await this.userRepository.findById(userId);
    } catch (error) {
      throw error;
    }
  }

  // Check if user is authenticated
  async isAuthenticated(userId) {
    try {
      this._validateUserId(userId);
      
      return await this.sessionRepository.isSessionValid(userId);
    } catch (error) {
      return false;
    }
  }

  // Reset password (for forgot password functionality)
  async resetPassword(email, newPassword) {
    try {
      this._validateEmail(email);
      this._validatePassword(newPassword);
      
      // Find user by email
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        throw new Error('User not found');
      }

      // Update password
      await this.userRepository.updatePassword(user._id, newPassword);

      // Invalidate all sessions for security
      await this.sessionRepository.deleteSession(user._id.toString());

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  // Update user profile
  async updateProfile(userId, profileData) {
    try {
      this._validateUserId(userId);
      
      // Validate profile data
      const allowedFields = ['name', 'isPubliclyVisible', 'publicRadiusKm'];
      const updateData = {};
      
      for (const field of allowedFields) {
        if (profileData.hasOwnProperty(field)) {
          updateData[field] = profileData[field];
        }
      }

      // Validate name if provided
      if (updateData.name && updateData.name.trim().length < 2) {
        throw new Error('Name must be at least 2 characters long');
      }

      // Validate radius if provided
      if (updateData.publicRadiusKm && (updateData.publicRadiusKm < 1 || updateData.publicRadiusKm > 1000)) {
        throw new Error('Public radius must be between 1 and 1000 km');
      }

      const updatedUser = await this.userRepository.updateById(userId, updateData);
      if (!updatedUser) {
        throw new Error('User not found');
      }

      return {
        success: true,
        user: updatedUser,
        message: 'Profile updated successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  // Get user session info
  async getSessionInfo(userId) {
    try {
      this._validateUserId(userId);
      
      const session = await this.sessionRepository.getSession(userId);
      return session;
    } catch (error) {
      throw error;
    }
  }

  // Validate user permissions for actions
  async validatePermissions(userId, action, resourceId = null) {
    try {
      this._validateUserId(userId);
      
      // Check if user is authenticated
      const isAuthenticated = await this.isAuthenticated(userId);
      if (!isAuthenticated) {
        return {
          allowed: false,
          reason: 'User not authenticated'
        };
      }

      // Get user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          allowed: false,
          reason: 'User not found'
        };
      }

      // Basic permission checks
      switch (action) {
        case 'update_profile':
        case 'change_password':
        case 'view_profile':
          return { allowed: true };
          
        case 'update_other_profile':
          return {
            allowed: false,
            reason: 'Cannot update other users profiles'
          };
          
        default:
          return { allowed: true };
      }
    } catch (error) {
      return {
        allowed: false,
        reason: error.message
      };
    }
  }

  // Private validation methods
  _validateRegistrationData(userData) {
    const { name, email, password } = userData;
    
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new Error('Name is required and must be at least 2 characters long');
    }
    
    this._validateEmail(email);
    this._validatePassword(password);
  }

  _validateLoginData(loginData) {
    const { email, password } = loginData;
    
    if (!email || typeof email !== 'string' || email.trim() === '') {
      throw new Error('Email is required');
    }
    
    if (!password || typeof password !== 'string' || password.trim() === '') {
      throw new Error('Password is required');
    }
  }

  _validatePasswordChangeData(passwordData) {
    const { currentPassword, newPassword } = passwordData;
    
    if (!currentPassword || typeof currentPassword !== 'string') {
      throw new Error('Current password is required');
    }
    
    this._validatePassword(newPassword, 'New password');
  }

  _validateEmail(email) {
    if (!email || typeof email !== 'string' || email.trim() === '') {
      throw new Error('Email is required');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Invalid email format');
    }
  }

  _validatePassword(password, fieldName = 'Password') {
    if (!password || typeof password !== 'string') {
      throw new Error(`${fieldName} is required`);
    }
    
    if (password.length < 6) {
      throw new Error(`${fieldName} must be at least 6 characters long`);
    }
  }

  _validateUserId(userId) {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('User ID is required');
    }
  }
}

export default AuthService;
