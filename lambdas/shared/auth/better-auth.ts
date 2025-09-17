/**
 * Better-Auth configuration with Drizzle adapter
 * Implements requirements: 1.1, 2.1, 3.1, 6.5
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './database';
import { users, accounts, sessions, verificationTokens, generateId } from './schema';
import { config } from './config';

/**
 * Better-Auth instance configured with Drizzle adapter
 * Supports email/password authentication with session management
 */
export const auth = betterAuth({
  // Database adapter configuration
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      account: accounts,
      session: sessions,
      verification: verificationTokens,
    },
  }),

  // Email and password authentication configuration
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Simplified for initial implementation
    minPasswordLength: config.auth.passwordMinLength,
    maxPasswordLength: config.auth.passwordMaxLength,
  },

  // Session management configuration
  session: {
    expiresIn: config.auth.sessionExpiresIn, // 7 days by default
    updateAge: config.auth.sessionUpdateAge, // 1 day by default
    cookieCache: {
      enabled: false, // Disable for serverless environment
    },
  },

  // Advanced configuration
  advanced: {
    // Use ULID for all entity IDs (Requirement 6.5)
    generateId: () => generateId(),
    // Disable default cookie handling for API-only usage
    useSecureCookies: config.isProduction,
    // Cross-origin configuration
    crossSubDomainCookies: {
      enabled: false, // Disabled for API-only usage
    },
  },

  // Security configuration
  secret: config.auth.secret,
  baseURL: config.auth.baseUrl,

  // Trusted origins for CORS
  trustedOrigins: [
    config.auth.frontendUrl,
    config.auth.baseUrl,
  ],

  // Rate limiting configuration (basic)
  rateLimit: {
    enabled: true,
    window: 60, // 1 minute window
    max: 10, // 10 requests per window
  },

  // Logger configuration
  logger: {
    level: config.isDevelopment ? 'debug' : 'error',
    disabled: false,
  },

  // Plugins configuration (can be extended later)
  plugins: [],
});

/**
 * Type export for Better-Auth instance
 */
export type Auth = typeof auth;

/**
 * Helper function to validate session token
 * Used by middleware for authentication
 */
export const validateSessionToken = async (token: string) => {
  try {
    // Better-Auth session validation using the auth instance
    const result = await auth.api.getSession({
      headers: new Headers({
        'authorization': `Bearer ${token}`,
      }),
    });

    if (result && result.session) {
      return {
        valid: true,
        user: result.user,
        session: result.session,
      };
    } else {
      return {
        valid: false,
        error: 'No valid session found',
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid session',
    };
  }
};

/**
 * Helper function to extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Helper function to create auth context for middleware
 */
export const createAuthContext = (user: any, session: any) => ({
  user: {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    image: user.image,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  },
  session: {
    id: session.id,
    sessionToken: session.sessionToken,
    userId: session.userId,
    expires: session.expires,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  },
});

/**
 * Export configuration for testing and debugging
 */
export const authConfig = {
  baseURL: config.auth.baseUrl,
  trustedOrigins: [config.auth.frontendUrl, config.auth.baseUrl],
  sessionExpiresIn: config.auth.sessionExpiresIn,
  sessionUpdateAge: config.auth.sessionUpdateAge,
  passwordMinLength: config.auth.passwordMinLength,
  passwordMaxLength: config.auth.passwordMaxLength,
};