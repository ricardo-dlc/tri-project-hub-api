/**
 * Core authentication types and interfaces
 * Supports requirements: 1.1, 2.1, 4.1
 */

// User role enumeration for RBAC
export type UserRole = 'user' | 'organizer' | 'admin';

// Core User interface
export interface User {
  id: string; // ULID
  email: string;
  emailVerified: boolean;
  name?: string | null;
  image?: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

// Session interface
export interface Session {
  id: string; // ULID
  sessionToken: string;
  userId: string;
  expires: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Authentication result returned after successful auth operations
export interface AuthResult {
  user: User;
  session: Session;
  token: string;
}

// Session validation result
export interface SessionValidationResult {
  valid: boolean;
  user?: User;
  session?: Session;
  error?: string;
}

// Public user data (excludes sensitive information)
export type PublicUser = Omit<User, 'emailVerified'>;

// Request/Response Types

// Sign up request payload
export interface SignUpRequest {
  email: string;
  password: string;
  name?: string;
}

// Sign in request payload
export interface SignInRequest {
  email: string;
  password: string;
}

// Profile update request payload
export interface ProfileUpdateRequest {
  name?: string;
  image?: string;
}

// Authentication response with Better-Auth integration
export interface AuthResponse {
  data: {
    user: PublicUser;
    session: Session;
    token: string;
  };
  headers?: Record<string, string>;
}

// Profile response
export interface ProfileResponse {
  user: PublicUser;
}

// Role-based Access Control Types

// Permission enumeration for event management system
export type Permission =
  | 'read:profile'
  | 'write:profile'
  | 'read:events'
  | 'write:events'
  | 'delete:events'
  | 'manage:events'
  | 'read:users'
  | 'write:users'
  | 'delete:users'
  | 'admin:system';

// Role permissions mapping for event management system
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: [
    'read:profile',
    'write:profile',
    'read:events'
  ],
  organizer: [
    'read:profile',
    'write:profile',
    'read:events',
    'write:events',
    'manage:events'
  ],
  admin: [
    'read:profile',
    'write:profile',
    'read:events',
    'write:events',
    'delete:events',
    'manage:events',
    'read:users',
    'write:users',
    'delete:users',
    'admin:system'
  ],
};

// RBAC configuration for middleware
export interface RBACConfig {
  roles?: UserRole[];
  permissions?: Permission[];
  requireAll?: boolean; // If true, user must have ALL specified permissions
}

// Rate limiting configuration
export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}



// Context attached to authenticated requests
export interface AuthContext {
  user: User;
  session: Session;
}

// Error response types
export interface AuthErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  timestamp: string;
}

// Token validation result
export interface TokenValidationResult {
  valid: boolean;
  user?: User;
  session?: Session;
  error?: string;
  expired?: boolean;
}