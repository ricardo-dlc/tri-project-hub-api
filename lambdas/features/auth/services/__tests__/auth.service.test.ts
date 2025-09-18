/**
 * Unit tests for AuthService
 * Tests sign up, sign in, sign out, session validation and refresh functionality
 * Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 3.4
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
// Mock dependencies first
jest.mock('../../models/user.model');
jest.mock('../../models/session.model');
jest.mock('../../../../shared/auth/config', () => ({
  config: {
    auth: {
      passwordMinLength: 8,
      passwordMaxLength: 128,
      sessionExpiresIn: 7 * 24 * 60 * 60 * 1000,
      sessionUpdateAge: 24 * 60 * 60 * 1000,
      secret: 'test-secret',
      baseUrl: 'http://localhost:3001',
      frontendUrl: 'http://localhost:3000',
    },
    isDevelopment: true,
    isProduction: false,
  }
}));
jest.mock('../../../../shared/auth/database', () => ({
  db: {}
}));
jest.mock('../../../../shared/auth/better-auth', () => ({
  auth: {
    api: {
      signUpEmail: jest.fn(),
      signInEmail: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    }
  }
}));

import { AuthService, AuthenticationError, ValidationError, UserExistsError } from '../auth.service';
import { userRepository } from '../../models/user.model';
import { sessionRepository } from '../../models/session.model';
import { auth } from '../../../../shared/auth/better-auth';

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
const mockSessionRepository = sessionRepository as jest.Mocked<typeof sessionRepository>;
const mockAuth = auth as jest.Mocked<typeof auth>;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('signUp', () => {
    const validSignUpData = {
      email: 'test@example.com',
      password: 'StrongPass123!',
      name: 'Test User',
    };

    it('should successfully register a new user with valid data', async () => {
      // Arrange
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSession = {
        id: 'session_123',
        sessionToken: 'token_123',
        userId: 'user_123',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.getUserByEmail.mockResolvedValue(null);
      (mockAuth.api.signUpEmail as jest.Mock).mockResolvedValue({
        user: mockUser,
        session: { ...mockSession, token: 'token_123', expiresAt: mockSession.expires },
      });

      // Act
      const result = await authService.signUp(validSignUpData);

      // Assert
      expect(result).toEqual({
        user: expect.objectContaining({
          id: 'user_123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
        }),
        session: expect.objectContaining({
          id: 'session_123',
          sessionToken: 'token_123',
          userId: 'user_123',
        }),
        token: 'token_123',
      });

      expect(mockUserRepository.getUserByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw UserExistsError when email already exists', async () => {
      // Arrange
      const existingUser = { id: 'existing_user', email: 'test@example.com' };
      mockUserRepository.getUserByEmail.mockResolvedValue(existingUser as any);

      // Act & Assert
      await expect(authService.signUp(validSignUpData)).rejects.toThrow(UserExistsError);
    });

    it('should throw ValidationError for weak password', async () => {
      // Arrange
      const weakPasswordData = {
        ...validSignUpData,
        password: 'weak',
      };

      // Act & Assert
      await expect(authService.signUp(weakPasswordData)).rejects.toThrow();
    });

    it('should throw ValidationError for invalid email format', async () => {
      // Arrange
      const invalidEmailData = {
        ...validSignUpData,
        email: 'invalid-email',
      };

      // Act & Assert
      await expect(authService.signUp(invalidEmailData)).rejects.toThrow();
    });
  });

  describe('signIn', () => {
    const validSignInData = {
      email: 'test@example.com',
      password: 'StrongPass123!',
    };

    it('should successfully authenticate user with valid credentials', async () => {
      // Arrange
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSession = {
        id: 'session_123',
        sessionToken: 'token_123',
        userId: 'user_123',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockAuth.api.signInEmail as jest.Mock).mockResolvedValue({
        user: mockUser,
        session: { ...mockSession, token: 'token_123', expiresAt: mockSession.expires },
      });

      // Act
      const result = await authService.signIn(validSignInData);

      // Assert
      expect(result).toEqual({
        user: expect.objectContaining({
          id: 'user_123',
          email: 'test@example.com',
          name: 'Test User',
        }),
        session: expect.objectContaining({
          sessionToken: 'token_123',
          userId: 'user_123',
        }),
        token: 'token_123',
      });
    });

    it('should throw AuthenticationError for invalid credentials', async () => {
      // Arrange
      (mockAuth.api.signInEmail as jest.Mock).mockResolvedValue({ user: null, session: null });

      // Act & Assert
      await expect(authService.signIn(validSignInData)).rejects.toThrow(AuthenticationError);
    });
  });

  describe('signOut', () => {
    const validSessionToken = 'valid_session_token_123';

    it('should successfully sign out user', async () => {
      // Arrange
      (mockAuth.api.signOut as jest.Mock).mockResolvedValue({});
      mockSessionRepository.deleteSessionByToken.mockResolvedValue(undefined);

      // Act
      await authService.signOut(validSessionToken);

      // Assert
      expect(mockAuth.api.signOut).toHaveBeenCalled();
      expect(mockSessionRepository.deleteSessionByToken).toHaveBeenCalledWith(validSessionToken);
    });

    it('should not throw error if Better-Auth signOut fails', async () => {
      // Arrange
      (mockAuth.api.signOut as jest.Mock).mockRejectedValue(new Error('Session not found'));
      mockSessionRepository.deleteSessionByToken.mockResolvedValue(undefined);

      // Act & Assert
      await expect(authService.signOut(validSessionToken)).resolves.toBeUndefined();
    });
  });

  describe('validateSession', () => {
    const validSessionToken = 'valid_session_token_123';

    it('should return valid session for active session', async () => {
      // Arrange
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSession = {
        id: 'session_123',
        sessionToken: validSessionToken,
        userId: 'user_123',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockAuth.api.getSession as jest.Mock).mockResolvedValue({
        user: mockUser,
        session: mockSession,
      });

      // Act
      const result = await authService.validateSession(validSessionToken);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.user).toEqual(expect.objectContaining({
        id: 'user_123',
        email: 'test@example.com',
      }));
    });

    it('should return invalid for non-existent session', async () => {
      // Arrange
      (mockAuth.api.getSession as jest.Mock).mockResolvedValue({ user: null, session: null });

      // Act
      const result = await authService.validateSession(validSessionToken);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid session');
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      // Arrange
      const strongPassword = 'StrongPass123!';

      // Act
      const result = authService.validatePasswordStrength(strongPassword);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.feedback).toHaveLength(0);
    });

    it('should reject weak password', () => {
      // Arrange
      const weakPassword = 'weak';

      // Act
      const result = authService.validatePasswordStrength(weakPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.score).toBeLessThan(4);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('should reject password without uppercase', () => {
      // Arrange
      const password = 'lowercase123!';

      // Act
      const result = authService.validatePasswordStrength(password);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      // Arrange
      const password = 'UPPERCASE123!';

      // Act
      const result = authService.validatePasswordStrength(password);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without numbers', () => {
      // Arrange
      const password = 'NoNumbers!';

      // Act
      const result = authService.validatePasswordStrength(password);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password must contain at least one number');
    });

    it('should reject password without special characters', () => {
      // Arrange
      const password = 'NoSpecialChars123';

      // Act
      const result = authService.validatePasswordStrength(password);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password must contain at least one special character');
    });

    it('should reject password that is too short', () => {
      // Arrange
      const password = 'Short1!';

      // Act
      const result = authService.validatePasswordStrength(password);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password must be at least 8 characters long');
    });

    it('should handle null/undefined password', () => {
      // Act
      const result1 = authService.validatePasswordStrength(null as any);
      const result2 = authService.validatePasswordStrength(undefined as any);

      // Assert
      expect(result1.isValid).toBe(false);
      expect(result1.feedback).toContain('Password is required');
      expect(result2.isValid).toBe(false);
      expect(result2.feedback).toContain('Password is required');
    });
  });

  describe('isEmailAvailable', () => {
    it('should return true for available email', async () => {
      // Arrange
      mockUserRepository.getUserByEmail.mockResolvedValue(null);

      // Act
      const result = await authService.isEmailAvailable('available@example.com');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for taken email', async () => {
      // Arrange
      mockUserRepository.getUserByEmail.mockResolvedValue({ id: 'user_123' } as any);

      // Act
      const result = await authService.isEmailAvailable('taken@example.com');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false on error for safety', async () => {
      // Arrange
      mockUserRepository.getUserByEmail.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await authService.isEmailAvailable('error@example.com');

      // Assert
      expect(result).toBe(false);
    });
  });
});