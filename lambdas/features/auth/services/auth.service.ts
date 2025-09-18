/**
 * Authentication service layer
 * Implements sign up, sign in, sign out, session validation and refresh functionality
 * Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 3.4
 */

// Removed unused imports - Better-Auth handles everything now
import { type SafeUser } from '../../../shared/auth/schema';
import {
  type AuthResult,
  type Session,
  type SessionValidationResult,
  type SignInRequest,
  type SignUpRequest,
  type User,
  type UserRole,
} from '../types/auth.types';
import {
  validateSessionToken,
  validateSignInRequest,
  validateSignUpRequest,
} from '../types/validation.schemas';
import { auth } from '../../../shared/auth';

/**
 * Authentication error classes
 */
export class AuthenticationError extends Error {
  constructor(message: string, public code: string = 'AUTH_FAILED') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UserExistsError extends Error {
  constructor(message: string, public code: string = 'USER_EXISTS') {
    super(message);
    this.name = 'UserExistsError';
  }
}

export class SessionExpiredError extends Error {
  constructor(message: string, public code: string = 'SESSION_EXPIRED') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/**
 * Password strength validation result
 */
export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-4 (weak to strong)
  feedback: string[];
}

/**
 * Authentication service class
 * Provides high-level authentication operations using Better-Auth and custom repositories
 */
export class AuthService {
  /**
   * User registration with email and password
   * Requirements: 1.1, 1.3, 1.4
   */
  async signUp(signUpData: SignUpRequest): Promise<AuthResult> {
    try {
      // Validate input data
      const validatedData = validateSignUpRequest(signUpData);
      console.log('validatedData:', validatedData);

      // Create user with Better-Auth - it handles all validation, password hashing, and duplicate checking
      const result = await auth.api.signUpEmail({
        body: {
          email: validatedData.email,
          password: validatedData.password,
          name: validatedData.name || '',
        },
        returnHeaders: true,
      });
      console.log('Better-Auth result:', result);
      result.headers.forEach((value, key) => {
        console.log(`${key}: ${value}`);
      });
      if (!result.response.user || !result.response.token) {
        throw new AuthenticationError('Failed to create user account');
      }

      // Better-Auth signUpEmail returns user and token, but not session object
      // We'll create a session representation from the available data
      const sessionInfo = this.createSessionFromToken(result.response.token, result.response.user);

      return {
        user: this.formatUser(result.response.user),
        session: sessionInfo,
        token: result.response.token
      };
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof ValidationError ||
        error instanceof UserExistsError ||
        error instanceof AuthenticationError) {
        throw error;
      }

      // Handle Better-Auth specific errors
      if (error && typeof error === 'object' && 'message' in error) {
        throw new AuthenticationError(error.message as string);
      }

      throw new AuthenticationError('Registration failed');
    }
  }

  /**
   * User authentication with email and password
   * Requirements: 2.1, 2.2
   */
  async signIn(signInData: SignInRequest): Promise<AuthResult> {
    try {
      // Validate input data
      const validatedData = validateSignInRequest(signInData);

      // Authenticate with Better-Auth
      const result = await auth.api.signInEmail({
        body: {
          email: validatedData.email,
          password: validatedData.password,
        },
      });

      if (!result.user || !result.token) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Better-Auth signInEmail returns user and token, create session representation
      const sessionInfo = this.createSessionFromToken(result.token, result.user);

      return {
        user: this.formatUser(result.user),
        session: sessionInfo,
        token: result.token
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new AuthenticationError('Authentication failed');
    }
  }

  /**
   * User sign out and session invalidation
   * Requirements: 2.1, 3.4
   */
  async signOut(sessionToken: string): Promise<void> {
    try {
      // Sign out with Better-Auth
      await auth.api.signOut({
        headers: new Headers({
          'authorization': `Bearer ${sessionToken}`,
        }),
      });
    } catch (error) {
      // Log error but don't throw - sign out should be idempotent
      console.warn('Sign out warning:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Validate session token and return user/session data
   * Requirements: 3.4
   */
  async validateSession(sessionToken: string): Promise<SessionValidationResult> {
    try {
      // Validate with Better-Auth
      const result = await auth.api.getSession({
        headers: new Headers({
          'authorization': `Bearer ${sessionToken}`,
        }),
      });

      if (!result || !result.user || !result.session) {
        return {
          valid: false,
          error: 'Invalid session'
        };
      }

      return {
        valid: true,
        user: this.formatUser(result.user),
        session: this.formatSession(result.session)
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Session validation failed'
      };
    }
  }

  /**
   * Refresh session if needed and return updated session
   * Requirements: 3.4
   */
  async refreshSession(sessionToken: string): Promise<AuthResult | null> {
    try {
      // Validate session token format
      validateSessionToken(sessionToken);

      // Check current session validity
      const validation = await this.validateSession(sessionToken);
      if (!validation.valid || !validation.session || !validation.user) {
        return null;
      }

      // Check if session needs refresh (within 24 hours of expiry)
      const session = validation.session;
      const timeUntilExpiry = session.expires.getTime() - Date.now();
      const refreshThreshold = 24 * 60 * 60 * 1000; // 24 hours

      if (timeUntilExpiry > refreshThreshold) {
        // Session doesn't need refresh yet
        return {
          user: validation.user,
          session: session,
          token: sessionToken
        };
      }

      // Better-Auth handles session refresh automatically
      // Just return the current valid session since Better-Auth manages expiration
      return {
        user: validation.user!,
        session: validation.session!,
        token: sessionToken
      };
    } catch (error) {
      console.warn('Session refresh warning:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Validate password strength with detailed feedback
   * Requirements: 1.4, 2.2
   */
  validatePasswordStrength(password: string): PasswordStrengthResult {
    const feedback: string[] = [];
    let score = 0;

    if (!password || typeof password !== 'string') {
      return {
        isValid: false,
        score: 0,
        feedback: ['Password is required']
      };
    }

    // Length check
    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters long');
    } else if (password.length >= 8) {
      score += 1;
    }

    if (password.length > 128) {
      feedback.push('Password must not exceed 128 characters');
    }

    // Character variety checks
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasLowercase) {
      feedback.push('Password must contain at least one lowercase letter');
    } else {
      score += 1;
    }

    if (!hasUppercase) {
      feedback.push('Password must contain at least one uppercase letter');
    } else {
      score += 1;
    }

    if (!hasNumbers) {
      feedback.push('Password must contain at least one number');
    } else {
      score += 1;
    }

    if (!hasSpecialChars) {
      feedback.push('Password must contain at least one special character');
    } else {
      score += 1;
    }

    // Additional strength checks
    if (password.length >= 12) {
      score += 1;
    }

    // Check for common patterns
    const commonPatterns = [
      /(.)\1{2,}/, // Repeated characters
      /123456|654321|abcdef|qwerty/i, // Common sequences
      /password|admin|user|login/i, // Common words
    ];

    const hasCommonPatterns = commonPatterns.some(pattern => pattern.test(password));
    if (hasCommonPatterns) {
      feedback.push('Password contains common patterns and may be easily guessed');
      score = Math.max(0, score - 1);
    }

    const isValid = feedback.length === 0 && score >= 4;

    return {
      isValid,
      score: Math.min(score, 4),
      feedback
    };
  }

  /**
   * Get current user profile from session
   * Requirements: 3.4
   */
  async getCurrentUser(sessionToken: string): Promise<User | null> {
    const validation = await this.validateSession(sessionToken);
    return validation.valid ? validation.user || null : null;
  }

  /**
   * Check if email is available for registration
   * Requirements: 1.1
   * Note: Better-Auth handles duplicate checking during registration.
   * This method is kept for API compatibility but defers to Better-Auth.
   */
  async isEmailAvailable(email: string): Promise<boolean> {
    // Better-Auth will handle duplicate email checking during actual registration
    // Return true to allow the registration attempt, Better-Auth will throw appropriate errors
    return true;
  }







  // Removed safeUserToUser method - no longer needed with Better-Auth

  /**
   * Format Better-Auth user to our User interface
   */
  private formatUser(user: any): User {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified || false,
      name: user.name || null,
      image: user.image || null,
      role: user.role || 'user',
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt)
    };
  }

  /**
   * Format Better-Auth session to our Session interface
   */
  private formatSession(session: any): Session {
    return {
      id: session.id,
      sessionToken: session.token,
      userId: session.userId,
      expires: new Date(session.expiresAt),
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt)
    };
  }

  /**
   * Create a session representation from Better-Auth token and user data
   * Used when Better-Auth returns a token but not a full session object
   */
  private createSessionFromToken(token: string, user: any): Session {
    return {
      id: `ba_${user.id}_${Date.now()}`, // Better-Auth session identifier
      sessionToken: token,
      userId: user.id,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days (Better-Auth default)
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt)
    };
  }


}

/**
 * Export singleton instance
 */
export const authService = new AuthService();