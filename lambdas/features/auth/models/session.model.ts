/**
 * Session model with Drizzle ORM operations
 * Implements CRUD operations, session expiration logic, and cleanup utilities
 * Requirements: 3.1, 3.2, 3.3
 */

import { eq, lt, and, desc } from 'drizzle-orm';
import { ulid } from 'ulid';
import { randomBytes } from 'crypto';
import { db } from '../../../shared/auth/database';
import { sessions, users, type Session, type NewSession, type SafeUser, type User } from '../../../shared/auth/schema';
import { UserRole, type SessionValidationResult } from '../types/auth.types';

/**
 * Session creation data interface
 */
export interface CreateSessionData {
  userId: string;
  expiresIn?: number; // Duration in milliseconds, defaults to 7 days
}

/**
 * Session update data interface
 */
export interface UpdateSessionData {
  expires?: Date;
}

/**
 * Session with user data interface
 */
export interface SessionWithUser {
  session: Session;
  user: SafeUser;
}

/**
 * Session cleanup result interface
 */
export interface SessionCleanupResult {
  deletedCount: number;
  cleanupTimestamp: Date;
}

/**
 * Session repository class with CRUD operations and expiration management
 */
export class SessionRepository {
  // Default session duration: 7 days in milliseconds
  private static readonly DEFAULT_SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

  // Session refresh threshold: 1 day in milliseconds
  private static readonly SESSION_REFRESH_THRESHOLD = 24 * 60 * 60 * 1000;

  // Token length for session tokens
  private static readonly TOKEN_LENGTH = 32;

  /**
   * Create a new session for a user
   * Requirements: 3.1
   */
  async createSession(sessionData: CreateSessionData): Promise<Session> {
    const sessionToken = this.generateSecureToken();
    const expiresIn = sessionData.expiresIn || SessionRepository.DEFAULT_SESSION_DURATION;
    const expires = new Date(Date.now() + expiresIn);

    const newSession: NewSession = {
      id: ulid(),
      sessionToken,
      userId: sessionData.userId,
      expires,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [createdSession] = await db
      .insert(sessions)
      .values(newSession)
      .returning();

    if (!createdSession) {
      throw new Error('Failed to create session');
    }

    return createdSession;
  }

  /**
   * Get session by session token
   * Requirements: 3.1
   */
  async getSessionByToken(sessionToken: string): Promise<Session | null> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionToken, sessionToken))
      .limit(1);

    return session || null;
  }

  /**
   * Get session by ID
   * Requirements: 3.1
   */
  async getSessionById(id: string): Promise<Session | null> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    return session || null;
  }

  /**
   * Get session with user data by session token
   * Requirements: 3.1
   */
  async getSessionWithUser(sessionToken: string): Promise<SessionWithUser | null> {
    const result = await db
      .select({
        session: sessions,
        user: {
          id: users.id,
          email: users.email,
          emailVerified: users.emailVerified,
          name: users.name,
          image: users.image,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        }
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.sessionToken, sessionToken))
      .limit(1);

    if (!result.length) {
      return null;
    }

    const { session, user } = result[0];
    return { session, user };
  }

  /**
   * Get all sessions for a user
   * Requirements: 3.1
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    return await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt));
  }

  /**
   * Validate session and check expiration
   * Requirements: 3.1, 3.2
   */
  async validateSession(sessionToken: string): Promise<SessionValidationResult> {
    try {
      const sessionWithUser = await this.getSessionWithUser(sessionToken);

      if (!sessionWithUser) {
        return {
          valid: false,
          error: 'Session not found'
        };
      }

      const { session, user } = sessionWithUser;

      // Check if session is expired
      if (session.expires < new Date()) {
        // Clean up expired session
        await this.deleteSession(session.id);
        return {
          valid: false,
          error: 'Session expired'
        };
      }

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          name: user.name || undefined, // Convert null to undefined for User interface compatibility
          image: user.image || undefined, // Convert null to undefined for User interface compatibility
          role: user.role as UserRole,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        session
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Session validation failed'
      };
    }
  }

  /**
   * Check if session needs refresh and refresh if necessary
   * Requirements: 3.2
   */
  async refreshSessionIfNeeded(sessionToken: string): Promise<Session | null> {
    const session = await this.getSessionByToken(sessionToken);

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expires < new Date()) {
      await this.deleteSession(session.id);
      return null;
    }

    // Check if session needs refresh (within refresh threshold)
    const timeUntilExpiry = session.expires.getTime() - Date.now();
    const needsRefresh = timeUntilExpiry < SessionRepository.SESSION_REFRESH_THRESHOLD;

    if (needsRefresh) {
      return await this.extendSession(session.id);
    }

    return session;
  }

  /**
   * Extend session expiration time
   * Requirements: 3.2
   */
  async extendSession(sessionId: string, extensionMs?: number): Promise<Session> {
    const extension = extensionMs || SessionRepository.DEFAULT_SESSION_DURATION;
    const newExpires = new Date(Date.now() + extension);

    const [updatedSession] = await db
      .update(sessions)
      .set({
        expires: newExpires,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning();

    if (!updatedSession) {
      throw new Error('Session not found or update failed');
    }

    return updatedSession;
  }

  /**
   * Update session data
   * Requirements: 3.1
   */
  async updateSession(sessionId: string, updateData: UpdateSessionData): Promise<Session> {
    const updatePayload = {
      ...updateData,
      updatedAt: new Date(),
    };

    const [updatedSession] = await db
      .update(sessions)
      .set(updatePayload)
      .where(eq(sessions.id, sessionId))
      .returning();

    if (!updatedSession) {
      throw new Error('Session not found or update failed');
    }

    return updatedSession;
  }

  /**
   * Delete a specific session
   * Requirements: 3.3
   */
  async deleteSession(sessionId: string): Promise<void> {
    const result = await db
      .delete(sessions)
      .where(eq(sessions.id, sessionId));

    // Note: Drizzle doesn't return affected rows count in the same way
    // We'll assume the operation succeeded if no error was thrown
  }

  /**
   * Delete session by token
   * Requirements: 3.3
   */
  async deleteSessionByToken(sessionToken: string): Promise<void> {
    await db
      .delete(sessions)
      .where(eq(sessions.sessionToken, sessionToken));
  }

  /**
   * Delete all sessions for a user (logout from all devices)
   * Requirements: 3.3
   */
  async deleteUserSessions(userId: string): Promise<void> {
    await db
      .delete(sessions)
      .where(eq(sessions.userId, userId));
  }

  /**
   * Clean up expired sessions
   * Requirements: 3.3
   */
  async cleanupExpiredSessions(): Promise<SessionCleanupResult> {
    const now = new Date();

    // Get count of expired sessions before deletion
    const expiredSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(lt(sessions.expires, now));

    const deletedCount = expiredSessions.length;

    // Delete expired sessions
    await db
      .delete(sessions)
      .where(lt(sessions.expires, now));

    return {
      deletedCount,
      cleanupTimestamp: now,
    };
  }

  /**
   * Clean up sessions older than specified date
   * Requirements: 3.3
   */
  async cleanupSessionsOlderThan(cutoffDate: Date): Promise<SessionCleanupResult> {
    // Get count of old sessions before deletion
    const oldSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(lt(sessions.createdAt, cutoffDate));

    const deletedCount = oldSessions.length;

    // Delete old sessions
    await db
      .delete(sessions)
      .where(lt(sessions.createdAt, cutoffDate));

    return {
      deletedCount,
      cleanupTimestamp: new Date(),
    };
  }

  /**
   * Get session statistics
   * Requirements: 3.1
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  }> {
    const now = new Date();

    // Get all sessions
    const allSessions = await db
      .select({
        id: sessions.id,
        expires: sessions.expires
      })
      .from(sessions);

    const totalSessions = allSessions.length;
    const activeSessions = allSessions.filter(s => s.expires > now).length;
    const expiredSessions = totalSessions - activeSessions;

    return {
      totalSessions,
      activeSessions,
      expiredSessions,
    };
  }

  /**
   * Check if session exists and is valid
   * Requirements: 3.1, 3.2
   */
  async isSessionValid(sessionToken: string): Promise<boolean> {
    const session = await this.getSessionByToken(sessionToken);

    if (!session) {
      return false;
    }

    return session.expires > new Date();
  }

  /**
   * Generate cryptographically secure session token
   * Requirements: 3.1
   */
  private generateSecureToken(): string {
    return randomBytes(SessionRepository.TOKEN_LENGTH).toString('hex');
  }
}

/**
 * Export singleton instance
 */
export const sessionRepository = new SessionRepository();