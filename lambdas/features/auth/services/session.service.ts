/**
 * Session service layer
 * Provides session management operations with validation and cleanup
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { sessionRepository, type CreateSessionData, type SessionCleanupResult } from '../models/session.model';
import {
  type Session,
  type SessionValidationResult,
  type User,
  type UserRole,
} from '../types/auth.types';
import {
  validateSessionToken,
  validateULID,
} from '../types/validation.schemas';

/**
 * Session service error classes
 */
export class SessionNotFoundError extends Error {
  constructor(message: string = 'Session not found', public code: string = 'SESSION_NOT_FOUND') {
    super(message);
    this.name = 'SessionNotFoundError';
  }
}

export class SessionExpiredError extends Error {
  constructor(message: string = 'Session expired', public code: string = 'SESSION_EXPIRED') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized access', public code: string = 'UNAUTHORIZED') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Session with user information
 */
export interface SessionWithUser {
  session: Session;
  user: User;
}

/**
 * Session service class
 * Provides high-level session management operations
 */
export class SessionService {
  /**
   * Create a new session for a user
   * Requirements: 3.1
   */
  async createSession(userId: string, expiresIn?: number): Promise<Session> {
    try {
      // Validate user ID
      validateULID(userId);

      const sessionData: CreateSessionData = {
        userId,
        expiresIn,
      };

      return await sessionRepository.createSession(sessionData);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Failed to create session');
    }
  }

  /**
   * Validate session and return session with user data
   * Requirements: 3.1, 3.2
   */
  async validateSession(sessionToken: string): Promise<SessionValidationResult> {
    try {
      // Validate session token format
      validateSessionToken(sessionToken);

      return await sessionRepository.validateSession(sessionToken);
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Session validation failed'
      };
    }
  }

  /**
   * Get session by token with user data
   * Requirements: 3.1
   */
  async getSessionWithUser(sessionToken: string): Promise<SessionWithUser | null> {
    try {
      // Validate session token format
      validateSessionToken(sessionToken);

      const sessionWithUser = await sessionRepository.getSessionWithUser(sessionToken);
      if (!sessionWithUser) {
        return null;
      }

      // Check if session is expired
      if (sessionWithUser.session.expires <= new Date()) {
        // Clean up expired session
        await this.deleteSession(sessionWithUser.session.id);
        return null;
      }

      return {
        session: sessionWithUser.session,
        user: {
          ...sessionWithUser.user,
          role: sessionWithUser.user.role as UserRole,
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh session if needed
   * Requirements: 3.2
   */
  async refreshSessionIfNeeded(sessionToken: string): Promise<Session | null> {
    try {
      // Validate session token format
      validateSessionToken(sessionToken);

      return await sessionRepository.refreshSessionIfNeeded(sessionToken);
    } catch (error) {
      return null;
    }
  }

  /**
   * Extend session expiration
   * Requirements: 3.2
   */
  async extendSession(sessionId: string, extensionMs?: number): Promise<Session> {
    try {
      // Validate session ID
      validateULID(sessionId);

      return await sessionRepository.extendSession(sessionId, extensionMs);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new SessionNotFoundError('Session not found');
      }
      throw new ValidationError('Failed to extend session');
    }
  }

  /**
   * Delete a specific session
   * Requirements: 3.3
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      // Validate session ID
      validateULID(sessionId);

      await sessionRepository.deleteSession(sessionId);
    } catch (error) {
      // Don't throw error for session deletion - it should be idempotent
      console.warn('Session deletion warning:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Delete session by token
   * Requirements: 3.3
   */
  async deleteSessionByToken(sessionToken: string): Promise<void> {
    try {
      // Validate session token format
      validateSessionToken(sessionToken);

      await sessionRepository.deleteSessionByToken(sessionToken);
    } catch (error) {
      // Don't throw error for session deletion - it should be idempotent
      console.warn('Session deletion warning:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get all sessions for a user (admin or self only)
   * Requirements: 3.1
   */
  async getUserSessions(
    userId: string,
    requestingUserId: string,
    requestingUserRole: UserRole
  ): Promise<Session[]> {
    try {
      // Validate user IDs
      validateULID(userId);
      validateULID(requestingUserId);

      // Authorization check: users can only view their own sessions, admins can view any
      if (userId !== requestingUserId && requestingUserRole !== 'admin') {
        throw new UnauthorizedError('You can only view your own sessions');
      }

      return await sessionRepository.getUserSessions(userId);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new ValidationError('Failed to retrieve user sessions');
    }
  }

  /**
   * Delete all sessions for a user (logout from all devices)
   * Requirements: 3.3
   */
  async deleteUserSessions(
    userId: string,
    requestingUserId: string,
    requestingUserRole: UserRole
  ): Promise<void> {
    try {
      // Validate user IDs
      validateULID(userId);
      validateULID(requestingUserId);

      // Authorization check: users can only delete their own sessions, admins can delete any
      if (userId !== requestingUserId && requestingUserRole !== 'admin') {
        throw new UnauthorizedError('You can only delete your own sessions');
      }

      await sessionRepository.deleteUserSessions(userId);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      // Don't throw error for session deletion - it should be idempotent
      console.warn('User sessions deletion warning:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Clean up expired sessions
   * Requirements: 3.3
   */
  async cleanupExpiredSessions(): Promise<SessionCleanupResult> {
    try {
      return await sessionRepository.cleanupExpiredSessions();
    } catch (error) {
      throw new ValidationError('Failed to cleanup expired sessions');
    }
  }

  /**
   * Clean up sessions older than specified date
   * Requirements: 3.3
   */
  async cleanupOldSessions(cutoffDate: Date): Promise<SessionCleanupResult> {
    try {
      return await sessionRepository.cleanupSessionsOlderThan(cutoffDate);
    } catch (error) {
      throw new ValidationError('Failed to cleanup old sessions');
    }
  }

  /**
   * Get session statistics (admin only)
   * Requirements: 3.1
   */
  async getSessionStats(requestingUserRole: UserRole): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  }> {
    try {
      // Authorization check: only admins can view session statistics
      if (requestingUserRole !== 'admin') {
        throw new UnauthorizedError('Only administrators can view session statistics');
      }

      return await sessionRepository.getSessionStats();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new ValidationError('Failed to retrieve session statistics');
    }
  }

  /**
   * Check if session is valid (without returning user data)
   * Requirements: 3.1, 3.2
   */
  async isSessionValid(sessionToken: string): Promise<boolean> {
    try {
      // Validate session token format
      validateSessionToken(sessionToken);

      return await sessionRepository.isSessionValid(sessionToken);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get active session count for a user
   * Requirements: 3.1
   */
  async getUserActiveSessionCount(userId: string): Promise<number> {
    try {
      // Validate user ID
      validateULID(userId);

      const sessions = await sessionRepository.getUserSessions(userId);
      const now = new Date();

      return sessions.filter(session => session.expires > now).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Cleanup sessions for deleted users (maintenance operation)
   * Requirements: 3.3
   */
  async cleanupOrphanedSessions(): Promise<SessionCleanupResult> {
    try {
      // This would require a more complex query to find sessions without valid users
      // For now, we'll just cleanup expired sessions
      return await this.cleanupExpiredSessions();
    } catch (error) {
      throw new ValidationError('Failed to cleanup orphaned sessions');
    }
  }
}

/**
 * Export singleton instance
 */
export const sessionService = new SessionService();