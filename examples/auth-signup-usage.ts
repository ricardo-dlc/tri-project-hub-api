/**
 * Example usage of the user registration handler
 * Demonstrates how to integrate the signUp handler in a Lambda function
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 * 
 * IMPORTANT: This handler uses Better-Auth with full auto-login support.
 * Key implementation details:
 * - Better-Auth handles user creation, validation, and password hashing
 * - Auto-login enabled: set-cookie headers returned for immediate session
 * - Middleware enhanced to support custom headers (set-cookie for sessions)
 * - Full Better-Auth JWT tokens work with frontend clients
 * - Session cookies automatically set for seamless frontend integration
 */

import { signUpHandler } from '../lambdas/features/auth/handlers/signUp';

// Example Lambda function export for AWS CDK deployment
export const handler = signUpHandler;

/**
 * Example request body for user registration:
 * 
 * POST /auth/signup
 * Content-Type: application/json
 * 
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePassword123",
 *   "name": "John Doe" // optional
 * }
 * 
 * Expected successful response (200):
 * Headers:
 *   set-cookie: better-auth.session_token=eyJ...; Path=/; HttpOnly; Secure; SameSite=Lax
 * 
 * Body:
 * {
 *   "success": true,
 *   "data": {
 *     "user": {
 *       "id": "user_01234567890123456789012345",
 *       "email": "user@example.com",
 *       "name": "John Doe",
 *       "image": null,
 *       "role": "user",
 *       "createdAt": "2023-01-01T00:00:00.000Z",
 *       "updatedAt": "2023-01-01T00:00:00.000Z"
 *     },
 *     "session": {
 *       "id": "ba_user_01234567890123456789012345_1672531200000",
 *       "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *       "userId": "user_01234567890123456789012345",
 *       "expires": "2023-01-08T00:00:00.000Z",
 *       "createdAt": "2023-01-01T00:00:00.000Z",
 *       "updatedAt": "2023-01-01T00:00:00.000Z"
 *     },
 *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Better-Auth JWT token
 *   }
 * }
 * 
 * Expected error responses:
 * 
 * 422 - Validation Error:
 * {
 *   "success": false,
 *   "error": {
 *     "message": "Invalid email format",
 *     "code": "VALIDATION_ERROR"
 *   },
 *   "data": null
 * }
 * 
 * 422 - Duplicate Email:
 * {
 *   "success": false,
 *   "error": {
 *     "message": "An account with this email already exists",
 *     "code": "VALIDATION_ERROR"
 *   },
 *   "data": null
 * }
 * 
 * Validation Rules:
 * - Email: Must be valid email format, max 255 characters
 * - Password: 8-128 characters, must contain lowercase, uppercase, and number
 * - Name: Optional, 1-100 characters if provided
 * 
 * Security Features:
 * - Duplicate email checking
 * - Better-Auth password hashing and validation
 * - JWT token generation with proper signing
 * - Auto-login with secure session cookies (HttpOnly, Secure, SameSite)
 * - Input sanitization and validation
 * - CORS support for frontend integration
 * - Better-Auth built-in security features (CSRF, rate limiting)
 * - Seamless session management with frontend clients
 */