/**
 * Authentication middleware for Lambda functions
 * Extends existing withMiddleware to support authentication and authorization
 * Requirements: 4.1, 4.2, 5.1
 */

import { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, Context } from 'aws-lambda';
import { withMiddleware } from './wrapper';
import { authService } from '../features/auth/services/auth.service';
import {
  type AuthContext,
  type RBACConfig,
  type RateLimitConfig,
  type User,
  type UserRole,
  type Session,
  type Permission,
  ROLE_PERMISSIONS,
} from '../features/auth/types/auth.types';
import {
  type MiddlewareOptions,
} from './types';
import { HttpError } from './errors';

/**
 * Auth-specific error classes
 */
export class AuthenticationError extends HttpError {
  readonly statusCode = 401;
  readonly code = 'AUTHENTICATION_FAILED';
}

export class AuthorizationError extends HttpError {
  readonly statusCode = 403;
  readonly code = 'INSUFFICIENT_PERMISSIONS';
}

export class InvalidTokenError extends HttpError {
  readonly statusCode = 401;
  readonly code = 'INVALID_TOKEN';
}

export class TooManyRequestsError extends HttpError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_EXCEEDED';
}

/**
 * Enhanced middleware options that include authentication and RBAC
 */
export interface AuthMiddlewareOptions extends MiddlewareOptions {
  auth?: {
    required?: boolean;
    roles?: string[];
    permissions?: string[];
    requireAllPermissions?: boolean; // If true, user must have ALL specified permissions
    rateLimiting?: RateLimitConfig;
    rbac?: RBACConfig; // Advanced RBAC configuration
  };
}

/**
 * Extended event interface with auth context
 */
export interface AuthenticatedEvent extends APIGatewayProxyEventV2 {
  user?: User;
  session?: Session;
  authContext?: AuthContext;
}

/**
 * Handler type for authenticated requests
 */
export type AuthenticatedHandler<T = any> = (
  event: AuthenticatedEvent,
  context: Context
) => Promise<T> | T;

/**
 * Rate limiting store (in-memory for simplicity, should use Redis in production)
 */
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired entry
      this.store.set(key, { count: 1, resetTime: now + windowMs });
      return 1;
    }

    // Increment existing entry
    entry.count++;
    this.store.set(key, entry);
    return entry.count;
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const entries = Array.from(this.store.entries());
    for (const [key, entry] of entries) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

const rateLimitStore = new RateLimitStore();

/**
 * Extract authentication token from event headers
 */
function extractAuthToken(event: APIGatewayProxyEventV2): string | null {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  
  if (!authHeader) {
    return null;
  }

  // Support Bearer token format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Support direct token
  return authHeader;
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(event: APIGatewayProxyEventV2): string {
  // Use source IP as primary identifier
  const sourceIp = event.requestContext?.http?.sourceIp || 'unknown';
  
  // Include user agent for additional uniqueness
  const userAgent = event.headers?.['user-agent'] || event.headers?.['User-Agent'] || '';
  
  return `${sourceIp}:${userAgent}`;
}

/**
 * Apply rate limiting
 */
async function applyRateLimit(
  event: APIGatewayProxyEventV2,
  config: RateLimitConfig
): Promise<void> {
  const clientId = getClientIdentifier(event);
  const attempts = await rateLimitStore.increment(clientId, config.windowMs);

  if (attempts > config.maxAttempts) {
    throw new TooManyRequestsError(
      `Rate limit exceeded. Maximum ${config.maxAttempts} requests per ${config.windowMs}ms`
    );
  }

  // Cleanup expired entries periodically
  if (Math.random() < 0.01) { // 1% chance
    await rateLimitStore.cleanup();
  }
}

/**
 * Validate authentication token and return user/session data
 */
async function validateAuthToken(event: APIGatewayProxyEventV2): Promise<{
  user?: User;
  session?: Session;
  error?: string;
}> {
  const token = extractAuthToken(event);
  
  if (!token) {
    return { error: 'No authentication token provided' };
  }

  try {
    const validation = await authService.validateSession(token);
    
    if (!validation.valid) {
      return { error: validation.error || 'Invalid token' };
    }

    return {
      user: validation.user,
      session: validation.session
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Token validation failed'
    };
  }
}

/**
 * Validate user roles against required roles
 */
function validateUserRoles(user: User, requiredRoles: string[]): void {
  if (!requiredRoles.length) {
    return;
  }

  if (!requiredRoles.includes(user.role)) {
    throw new AuthorizationError(
      `Access denied. Required roles: ${requiredRoles.join(', ')}`
    );
  }
}

/**
 * Validate user permissions against required permissions
 */
function validateUserPermissions(
  user: User, 
  requiredPermissions: string[], 
  requireAll: boolean = true
): void {
  if (!requiredPermissions.length) {
    return;
  }

  const userPermissions = ROLE_PERMISSIONS[user.role] || [];
  
  if (requireAll) {
    // User must have ALL specified permissions
    const hasAllPermissions = requiredPermissions.every(permission =>
      userPermissions.includes(permission as any)
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(permission =>
        !userPermissions.includes(permission as any)
      );
      
      throw new AuthorizationError(
        `Access denied. Missing permissions: ${missingPermissions.join(', ')}`
      );
    }
  } else {
    // User must have AT LEAST ONE of the specified permissions
    const hasAnyPermission = requiredPermissions.some(permission =>
      userPermissions.includes(permission as any)
    );

    if (!hasAnyPermission) {
      throw new AuthorizationError(
        `Access denied. Requires at least one of: ${requiredPermissions.join(', ')}`
      );
    }
  }
}

/**
 * Advanced RBAC validation using RBACConfig
 */
function validateRBACConfig(user: User, rbacConfig: RBACConfig): void {
  // Validate roles if specified
  if (rbacConfig.roles && rbacConfig.roles.length > 0) {
    validateUserRoles(user, rbacConfig.roles);
  }

  // Validate permissions if specified
  if (rbacConfig.permissions && rbacConfig.permissions.length > 0) {
    validateUserPermissions(
      user, 
      rbacConfig.permissions, 
      rbacConfig.requireAll !== false // Default to true
    );
  }
}

/**
 * Enhanced middleware wrapper with authentication support
 * Extends the existing withMiddleware function to add auth capabilities
 */
export const withAuth = <T = any>(
  handler: AuthenticatedHandler<T>,
  options: AuthMiddlewareOptions = {}
): APIGatewayProxyHandlerV2 => {
  return withMiddleware(async (event: APIGatewayProxyEventV2, context: Context) => {
    // Apply rate limiting if configured
    if (options.auth?.rateLimiting) {
      await applyRateLimit(event, options.auth.rateLimiting);
    }

    // Extract and validate auth token
    const authResult = await validateAuthToken(event);

    // Check if authentication is required
    if (options.auth?.required && !authResult.user) {
      throw new AuthenticationError(
        authResult.error || 'Authentication required'
      );
    }

    // Validate RBAC if user is authenticated
    if (authResult.user) {
      // Use advanced RBAC config if provided
      if (options.auth?.rbac) {
        validateRBACConfig(authResult.user, options.auth.rbac);
      } else {
        // Fallback to individual role/permission validation
        if (options.auth?.roles) {
          validateUserRoles(authResult.user, options.auth.roles);
        }

        if (options.auth?.permissions) {
          validateUserPermissions(
            authResult.user, 
            options.auth.permissions,
            options.auth.requireAllPermissions !== false // Default to true
          );
        }
      }
    }

    // Attach user context to event
    const authenticatedEvent = event as AuthenticatedEvent;
    authenticatedEvent.user = authResult.user;
    authenticatedEvent.session = authResult.session;
    
    if (authResult.user && authResult.session) {
      authenticatedEvent.authContext = {
        user: authResult.user,
        session: authResult.session
      };
    }

    // Call the handler with the authenticated event
    return handler(authenticatedEvent, context);
  }, options);
};

/**
 * Convenience function for creating protected endpoints that require authentication
 */
export const withAuthRequired = <T = any>(
  handler: AuthenticatedHandler<T>,
  options: Omit<AuthMiddlewareOptions, 'auth'> & {
    roles?: string[];
    permissions?: string[];
    rateLimiting?: RateLimitConfig;
  } = {}
): APIGatewayProxyHandlerV2 => {
  return withAuth(handler, {
    ...options,
    auth: {
      required: true,
      roles: options.roles,
      permissions: options.permissions,
      rateLimiting: options.rateLimiting,
    },
  });
};

/**
 * Convenience function for creating role-based protected endpoints
 */
export const withRole = <T = any>(
  roles: string | string[],
  handler: AuthenticatedHandler<T>,
  options: Omit<AuthMiddlewareOptions, 'auth'> = {}
): APIGatewayProxyHandlerV2 => {
  const roleArray = Array.isArray(roles) ? roles : [roles];
  
  return withAuthRequired(handler, {
    ...options,
    roles: roleArray,
  });
};

/**
 * Convenience function for creating permission-based protected endpoints
 */
export const withPermissions = <T = any>(
  permissions: string | string[],
  handler: AuthenticatedHandler<T>,
  options: Omit<AuthMiddlewareOptions, 'auth'> = {}
): APIGatewayProxyHandlerV2 => {
  const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
  
  return withAuthRequired(handler, {
    ...options,
    permissions: permissionArray,
  });
};

/**
 * Utility function to get authenticated user from event
 */
export function getAuthenticatedUser(event: AuthenticatedEvent): User {
  if (!event.user) {
    throw new AuthenticationError('User not authenticated');
  }
  return event.user;
}

/**
 * Utility function to get auth context from event
 */
export function getAuthContext(event: AuthenticatedEvent): AuthContext {
  if (!event.authContext) {
    throw new AuthenticationError('Authentication context not available');
  }
  return event.authContext;
}

/**
 * RBAC Utility Functions
 */

/**
 * Check if user has a specific role
 */
export function hasRole(user: User, role: UserRole): boolean {
  return user.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: User, roles: UserRole[]): boolean {
  return roles.includes(user.role);
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: User, permission: Permission): boolean {
  const userPermissions = ROLE_PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission);
}

/**
 * Check if user has all specified permissions
 */
export function hasAllPermissions(user: User, permissions: Permission[]): boolean {
  const userPermissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.every(permission => userPermissions.includes(permission));
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(user: User, permissions: Permission[]): boolean {
  const userPermissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.some(permission => userPermissions.includes(permission));
}

/**
 * Get all permissions for a user's role
 */
export function getUserPermissions(user: User): Permission[] {
  return ROLE_PERMISSIONS[user.role] || [];
}

/**
 * Check if user can access a resource based on RBAC config
 */
export function canAccess(user: User, rbacConfig: RBACConfig): boolean {
  try {
    validateRBACConfig(user, rbacConfig);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Advanced RBAC middleware factory for complex authorization scenarios
 */
export const withRBAC = <T = any>(
  rbacConfig: RBACConfig,
  handler: AuthenticatedHandler<T>,
  options: Omit<AuthMiddlewareOptions, 'auth'> = {}
): APIGatewayProxyHandlerV2 => {
  return withAuth(handler, {
    ...options,
    auth: {
      required: true,
      rbac: rbacConfig,
    },
  });
};

