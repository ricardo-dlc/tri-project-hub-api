/**
 * Unit tests for SessionService
 * Tests session management operations with validation and cleanup
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  SessionService, 
  SessionNotFoundError, 
  SessionExpiredError, 
  UnauthorizedError, 
  ValidationError 
} from '../session.service';
import { sessionRepository } from '../../models/session.model';

// Mock dependencies
jest.mock('../../models/session.model');
jest.mock('../../../../shared/auth/config', () => ({
  config: {
    auth: {
      passwordMinLength: 8,
      passwordMaxLength: 128,
    }
  }
}));
jest.mock('../../../../shared/auth/database', () => ({
  db: {}
}));

const mockSessionRepository = sessionRepository as jest.Mocked<typeof sessionRepository>;

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    sessionService = new SessionService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createSession', () => {
    const validUserId = 'user_01234567890123456789012345';

    it('should create a new session for valid user ID', async () => {
      // Arrange
      const mockSession = {
        id: 'session_123',
        sessionToken: 'token_123',
        userId: validUserId,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSessionRepository.createSession.mockResolvedValue(mockSession);

      // Act
      const result = await sessionService.createSession(validUserId);

      // Assert
      expect(result).toEqual(mockSession);
      expect(mockSessionRepository.createSession).toHaveBeenCalledWith({
        userId: validUserId,
        expiresIn: undefined,
      });
    });

    it('should create session with custom expiration', async () => {
      // Arrange
      const customExpiresIn = 24 * 60 * 60 * 1000; // 1 day
      const mockSession = {
        id: 'session_123',
        sessionToken: 'token_123',
        userId: validUserId,
        expires: new Date(Date.now() + customExpiresIn),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSessionRepository.createSession.mockResolvedValue(mockSession);

      // Act
      const result = await sessionService.createSession(validUserId, customExpiresIn);

      // Assert
      expect(result).toEqual(mockSession);
      expect(mockSessionRepository.createSession).toHaveBeenCalledWith({
        userId: validUserId,
        expiresIn: customExpiresIn,
      });
    });

    it('should throw ValidationError for invalid user ID', async () => {
      // Arrange
      const invalidUserId = 'invalid_id';

      // Act & Assert
      await expect(sessionService.createSession(invalidUserId)).rejects.toThrow();
    });

    it('should handle repository errors', async () => {
      // Arrange
      mockSessionRepository.createSession.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(sessionService.createSession(validUserId)).rejects.toThrow(ValidationError);
    });
  });

  describe('validateSession', () => {
    const validSessionToken = 'valid_session_token_123';

    it('should return valid session result for active session', async () => {
      // Arrange
      const mockValidationResult = {
        valid: true,
        user: {
          id: 'user_123',
          email: 'test@example.com',
          role: 'user',
        },
        session: {
          id: 'session_123',
          sessionToken: validSessionToken,
          userId: 'user_123',
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      };

      mockSessionRepository.validateSession.mockResolvedValue(mockValidationResult);

      // Act
      const result = await sessionService.validateSession(validSessionToken);

      // Assert
      expect(result).toEqual(mockValidationResult);
      expect(mockSessionRepository.validateSession).toHaveBeenCalledWith(validSessionToken);
    });

    it('should return invalid result for expired session', async () => {
      // Arrange
      const mockValidationResult = {
        valid: false,
        error: 'Session expired',
      };

      mockSessionRepository.validateSession.mockResolvedValue(mockValidationResult);

      // Act
      const result = await sessionService.validateSession(validSessionToken);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session expired');
    });

    it('should handle invalid session token format', async () => {
      // Arrange
      const invalidToken = '';

      // Act
      const result = await sessionService.validateSession(invalidToken);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Session token is required');
    });
  });

  describe('getSessionWithUser', () => {
    const validSessionToken = 'valid_session_token_123';

    it('should return session with user data for valid session', async () => {
      // Arrange
      const mockSessionWithUser = {
        session: {
          id: 'session_123',
          sessionToken: validSessionToken,
          userId: 'user_123',
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        user: {
          id: 'user_123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockSessionRepository.getSessionWithUser.mockResolvedValue(mockSessionWithUser);

      // Act
      const result = await sessionService.getSessionWithUser(validSessionToken);

      // Assert
      expect(result).toEqual({
        session: mockSessionWithUser.session,
        user: {
          ...mockSessionWithUser.user,
          role: 'user',
        },
      });
    });

    it('should return null for non-existent session', async () => {
      // Arrange
      mockSessionRepository.getSessionWithUser.mockResolvedValue(null);

      // Act
      const result = await sessionService.getSessionWithUser(validSessionToken);

      // Assert
      expect(result).toBeNull();
    });

    it('should clean up expired session and return null', async () => {
      // Arrange
      const expiredSessionWithUser = {
        session: {
          id: 'session_123',
          sessionToken: validSessionToken,
          userId: 'user_123',
          expires: new Date(Date.now() - 1000), // Expired
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        user: {
          id: 'user_123',
          email: 'test@example.com',
          role: 'user',
        },
      };

      mockSessionRepository.getSessionWithUser.mockResolvedValue(expiredSessionWithUser);
      mockSessionRepository.deleteSession.mockResolvedValue(undefined);

      // Act
      const result = await sessionService.getSessionWithUser(validSessionToken);

      // Assert
      expect(result).toBeNull();
      expect(mockSessionRepository.deleteSession).toHaveBeenCalledWith('session_123');
    });
  });

  describe('refreshSessionIfNeeded', () => {
    const validSessionToken = 'valid_session_token_123';

    it('should refresh session when needed', async () => {
      // Arrange
      const refreshedSession = {
        id: 'session_123',
        sessionToken: validSessionToken,
        userId: 'user_123',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSessionRepository.refreshSessionIfNeeded.mockResolvedValue(refreshedSession);

      // Act
      const result = await sessionService.refreshSessionIfNeeded(validSessionToken);

      // Assert
      expect(result).toEqual(refreshedSession);
    });

    it('should return null for invalid session', async () => {
      // Arrange
      mockSessionRepository.refreshSessionIfNeeded.mockResolvedValue(null);

      // Act
      const result = await sessionService.refreshSessionIfNeeded(validSessionToken);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      mockSessionRepository.refreshSessionIfNeeded.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await sessionService.refreshSessionIfNeeded(validSessionToken);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('extendSession', () => {
    const validSessionId = 'session_01234567890123456789012345';

    it('should extend session expiration', async () => {
      // Arrange
      const extendedSession = {
        id: validSessionId,
        sessionToken: 'token_123',
        userId: 'user_123',
        expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Extended
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSessionRepository.extendSession.mockResolvedValue(extendedSession);

      // Act
      const result = await sessionService.extendSession(validSessionId);

      // Assert
      expect(result).toEqual(extendedSession);
      expect(mockSessionRepository.extendSession).toHaveBeenCalledWith(validSessionId, undefined);
    });

    it('should extend session with custom duration', async () => {
      // Arrange
      const customExtension = 3 * 24 * 60 * 60 * 1000; // 3 days
      const extendedSession = {
        id: validSessionId,
        sessionToken: 'token_123',
        userId: 'user_123',
        expires: new Date(Date.now() + customExtension),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSessionRepository.extendSession.mockResolvedValue(extendedSession);

      // Act
      const result = await sessionService.extendSession(validSessionId, customExtension);

      // Assert
      expect(result).toEqual(extendedSession);
      expect(mockSessionRepository.extendSession).toHaveBeenCalledWith(validSessionId, customExtension);
    });

    it('should throw SessionNotFoundError for non-existent session', async () => {
      // Arrange
      mockSessionRepository.extendSession.mockRejectedValue(new Error('Session not found'));

      // Act & Assert
      await expect(sessionService.extendSession(validSessionId)).rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('deleteSession', () => {
    const validSessionId = 'session_01234567890123456789012345';

    it('should delete session successfully', async () => {
      // Arrange
      mockSessionRepository.deleteSession.mockResolvedValue(undefined);

      // Act
      await sessionService.deleteSession(validSessionId);

      // Assert
      expect(mockSessionRepository.deleteSession).toHaveBeenCalledWith(validSessionId);
    });

    it('should not throw error if session does not exist', async () => {
      // Arrange
      mockSessionRepository.deleteSession.mockRejectedValue(new Error('Session not found'));

      // Act & Assert
      await expect(sessionService.deleteSession(validSessionId)).resolves.toBeUndefined();
    });
  });

  describe('getUserSessions', () => {
    const validUserId = 'user_01234567890123456789012345';
    const adminUserId = 'admin_01234567890123456789012345';

    it('should allow user to view their own sessions', async () => {
      // Arrange
      const mockSessions = [
        {
          id: 'session_1',
          sessionToken: 'token_1',
          userId: validUserId,
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockSessionRepository.getUserSessions.mockResolvedValue(mockSessions);

      // Act
      const result = await sessionService.getUserSessions(validUserId, validUserId, 'user');

      // Assert
      expect(result).toEqual(mockSessions);
    });

    it('should allow admin to view any user sessions', async () => {
      // Arrange
      const mockSessions = [
        {
          id: 'session_1',
          sessionToken: 'token_1',
          userId: validUserId,
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockSessionRepository.getUserSessions.mockResolvedValue(mockSessions);

      // Act
      const result = await sessionService.getUserSessions(validUserId, adminUserId, 'admin');

      // Assert
      expect(result).toEqual(mockSessions);
    });

    it('should throw UnauthorizedError when user tries to view other user sessions', async () => {
      // Arrange
      const otherUserId = 'other_01234567890123456789012345';

      // Act & Assert
      await expect(
        sessionService.getUserSessions(otherUserId, validUserId, 'user')
      ).rejects.toThrow(UnauthorizedError);

      expect(mockSessionRepository.getUserSessions).not.toHaveBeenCalled();
    });
  });

  describe('deleteUserSessions', () => {
    const validUserId = 'user_01234567890123456789012345';
    const adminUserId = 'admin_01234567890123456789012345';

    it('should allow user to delete their own sessions', async () => {
      // Arrange
      mockSessionRepository.deleteUserSessions.mockResolvedValue(undefined);

      // Act
      await sessionService.deleteUserSessions(validUserId, validUserId, 'user');

      // Assert
      expect(mockSessionRepository.deleteUserSessions).toHaveBeenCalledWith(validUserId);
    });

    it('should allow admin to delete any user sessions', async () => {
      // Arrange
      mockSessionRepository.deleteUserSessions.mockResolvedValue(undefined);

      // Act
      await sessionService.deleteUserSessions(validUserId, adminUserId, 'admin');

      // Assert
      expect(mockSessionRepository.deleteUserSessions).toHaveBeenCalledWith(validUserId);
    });

    it('should throw UnauthorizedError when user tries to delete other user sessions', async () => {
      // Arrange
      const otherUserId = 'other_01234567890123456789012345';

      // Act & Assert
      await expect(
        sessionService.deleteUserSessions(otherUserId, validUserId, 'user')
      ).rejects.toThrow(UnauthorizedError);

      expect(mockSessionRepository.deleteUserSessions).not.toHaveBeenCalled();
    });

    it('should not throw error if deletion fails', async () => {
      // Arrange
      mockSessionRepository.deleteUserSessions.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        sessionService.deleteUserSessions(validUserId, validUserId, 'user')
      ).resolves.toBeUndefined();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions and return result', async () => {
      // Arrange
      const mockCleanupResult = {
        deletedCount: 5,
        cleanupTimestamp: new Date(),
      };

      mockSessionRepository.cleanupExpiredSessions.mockResolvedValue(mockCleanupResult);

      // Act
      const result = await sessionService.cleanupExpiredSessions();

      // Assert
      expect(result).toEqual(mockCleanupResult);
    });

    it('should handle cleanup errors', async () => {
      // Arrange
      mockSessionRepository.cleanupExpiredSessions.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(sessionService.cleanupExpiredSessions()).rejects.toThrow(ValidationError);
    });
  });

  describe('getSessionStats', () => {
    it('should allow admin to view session statistics', async () => {
      // Arrange
      const mockStats = {
        totalSessions: 100,
        activeSessions: 75,
        expiredSessions: 25,
      };

      mockSessionRepository.getSessionStats.mockResolvedValue(mockStats);

      // Act
      const result = await sessionService.getSessionStats('admin');

      // Assert
      expect(result).toEqual(mockStats);
    });

    it('should throw UnauthorizedError for non-admin user', async () => {
      // Act & Assert
      await expect(sessionService.getSessionStats('user')).rejects.toThrow(UnauthorizedError);

      expect(mockSessionRepository.getSessionStats).not.toHaveBeenCalled();
    });
  });

  describe('isSessionValid', () => {
    const validSessionToken = 'valid_session_token_123';

    it('should return true for valid session', async () => {
      // Arrange
      mockSessionRepository.isSessionValid.mockResolvedValue(true);

      // Act
      const result = await sessionService.isSessionValid(validSessionToken);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for invalid session', async () => {
      // Arrange
      mockSessionRepository.isSessionValid.mockResolvedValue(false);

      // Act
      const result = await sessionService.isSessionValid(validSessionToken);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      // Arrange
      mockSessionRepository.isSessionValid.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await sessionService.isSessionValid(validSessionToken);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getUserActiveSessionCount', () => {
    const validUserId = 'user_01234567890123456789012345';

    it('should return count of active sessions', async () => {
      // Arrange
      const mockSessions = [
        {
          id: 'session_1',
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Active
        },
        {
          id: 'session_2',
          expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Active
        },
        {
          id: 'session_3',
          expires: new Date(Date.now() - 1000), // Expired
        },
      ];

      mockSessionRepository.getUserSessions.mockResolvedValue(mockSessions);

      // Act
      const result = await sessionService.getUserActiveSessionCount(validUserId);

      // Assert
      expect(result).toBe(2); // Only 2 active sessions
    });

    it('should return 0 on error', async () => {
      // Arrange
      mockSessionRepository.getUserSessions.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await sessionService.getUserActiveSessionCount(validUserId);

      // Assert
      expect(result).toBe(0);
    });
  });
});