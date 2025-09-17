/**
 * Auth types module exports
 * Centralized export for all authentication-related types and schemas
 */

// Core types
export type {
  User,
  Session,
  AuthResult,
  SessionValidationResult,
  PublicUser,
  SignUpRequest,
  SignInRequest,
  ProfileUpdateRequest,
  AuthResponse,
  ProfileResponse,
  UserRole,
  Permission,
  RBACConfig,
  RateLimitConfig,
  AuthMiddlewareOptions,
  AuthContext,
  AuthErrorResponse,
  TokenValidationResult,
} from './auth.types';

// Constants
export { ROLE_PERMISSIONS } from './auth.types';

// Validation schemas
export {
  passwordSchema,
  emailSchema,
  userRoleSchema,
  signUpRequestSchema,
  signInRequestSchema,
  profileUpdateRequestSchema,
  userCreateSchema,
  sessionCreateSchema,
  sessionTokenSchema,
  rateLimitConfigSchema,
  rbacConfigSchema,
  ulidSchema,
  validateSignUpRequest,
  validateSignInRequest,
  validateProfileUpdateRequest,
  validateUserRole,
  validateULID,
  validateSessionToken,
  validateRateLimitConfig,
  validateRBACConfig,
} from './validation.schemas';

// Validation result types
export type {
  SignUpRequestData,
  SignInRequestData,
  ProfileUpdateRequestData,
  UserCreateData,
  SessionCreateData,
  RateLimitConfigData,
  RBACConfigData,
} from './validation.schemas';