/**
 * Validation schemas for authentication operations
 * Supports requirements: 1.1, 2.1, 4.1
 */

import { z } from 'zod';
import { UserRole } from './auth.types';

// Password validation schema
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one lowercase letter, one uppercase letter, and one number'
  );

// Email validation schema
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email must not exceed 255 characters');

// User role validation schema
export const userRoleSchema = z.enum(['user', 'organizer', 'admin'] as const);

// Sign up request validation
export const signUpRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z
    .string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),
});

// Sign in request validation
export const signInRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// Profile update request validation
export const profileUpdateRequestSchema = z.object({
  name: z
    .string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),
  image: z
    .string()
    .url('Image must be a valid URL')
    .max(500, 'Image URL must not exceed 500 characters')
    .optional(),
});

// User creation schema (for internal use)
export const userCreateSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  email: emailSchema,
  emailVerified: z.boolean().default(false),
  name: z.string().max(100).optional(),
  image: z.string().url().max(500).optional(),
  role: userRoleSchema.default('user'),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Session creation schema (for internal use)
export const sessionCreateSchema = z.object({
  id: z.string().min(1, 'Session ID is required'),
  sessionToken: z.string().min(1, 'Session token is required'),
  userId: z.string().min(1, 'User ID is required'),
  expires: z.date(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// ULID validation schema
export const ulidSchema = z
  .string()
  .length(26, 'ULID must be exactly 26 characters')
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'Invalid ULID format');

// Validation helper functions
export const validateSignUpRequest = (data: unknown) => {
  return signUpRequestSchema.parse(data);
};

export const validateSignInRequest = (data: unknown) => {
  return signInRequestSchema.parse(data);
};

export const validateProfileUpdateRequest = (data: unknown) => {
  return profileUpdateRequestSchema.parse(data);
};

export const validateUserRole = (role: unknown): UserRole => {
  return userRoleSchema.parse(role);
};

export const validateULID = (id: unknown) => {
  return ulidSchema.parse(id);
};

// Session token validation schema
export const sessionTokenSchema = z
  .string()
  .min(1, 'Session token is required')
  .max(500, 'Session token is too long');

// Rate limit configuration validation
export const rateLimitConfigSchema = z.object({
  maxAttempts: z.number().min(1).max(1000),
  windowMs: z.number().min(1000).max(86400000), // 1 second to 24 hours
});

// RBAC configuration validation
export const rbacConfigSchema = z.object({
  roles: z.array(userRoleSchema).optional(),
  permissions: z.array(z.string()).optional(),
  requireAll: z.boolean().default(false),
});

// Validation helper for session tokens
export const validateSessionToken = (token: unknown) => {
  return sessionTokenSchema.parse(token);
};

// Validation helper for rate limit config
export const validateRateLimitConfig = (config: unknown) => {
  return rateLimitConfigSchema.parse(config);
};

// Validation helper for RBAC config
export const validateRBACConfig = (config: unknown) => {
  return rbacConfigSchema.parse(config);
};

// Type exports for validation results
export type SignUpRequestData = z.infer<typeof signUpRequestSchema>;
export type SignInRequestData = z.infer<typeof signInRequestSchema>;
export type ProfileUpdateRequestData = z.infer<typeof profileUpdateRequestSchema>;
export type UserCreateData = z.infer<typeof userCreateSchema>;
export type SessionCreateData = z.infer<typeof sessionCreateSchema>;
export type RateLimitConfigData = z.infer<typeof rateLimitConfigSchema>;
export type RBACConfigData = z.infer<typeof rbacConfigSchema>;