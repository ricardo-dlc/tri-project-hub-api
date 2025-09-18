/**
 * Example usage of the user registration handler
 * Demonstrates how to integrate the signUp handler in a Lambda function
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 * 
 * IMPORTANT: This implementation has been completely refactored to remove Better-Auth
 * dependency. We now use our own robust authentication system with:
 * - User repository for secure password hashing with bcrypt (12 rounds)
 * - Session repository for secure token generation using crypto.randomBytes
 * - Full control over authentication flow and error handling
 * - No external authentication library dependencies
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
 *     "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
 *     "expiresAt": "2023-01-08T00:00:00.000Z"
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
 * - Password strength validation (bcrypt with 12 rounds)
 * - Secure session token generation (crypto.randomBytes)
 * - Input sanitization and validation
 * - CORS support for frontend integration
 * - Comprehensive error handling
 * - Session expiration and cleanup
 */