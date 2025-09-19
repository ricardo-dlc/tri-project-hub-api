/**
 * User registration handler
 * Implements sign up endpoint with email/password validation and duplicate checking
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { withMiddleware } from '../../../shared/wrapper';
import { authService } from '../services/auth.service';
import { validateSignUpRequest } from '../types/validation.schemas';
import { AuthResult, SignUpRequest } from '../types/auth.types';
import { ValidationError } from '../../../shared/errors';

/**
 * User registration handler
 * Processes sign up requests with comprehensive validation and error handling
 */
export const signUpHandler = withMiddleware<any>(
  async (event: APIGatewayProxyEventV2, context: Context) => {
    // OPTIONS preflight requests are handled automatically by API Gateway CORS

    // Parse request body
    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    let requestData: SignUpRequest;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body');
    }

    console.log('Request data:', requestData);

    // Validate request data using Zod schema
    // This handles Requirements 1.2, 1.3, 1.4 (email format, password validation)
    const validatedData = validateSignUpRequest(requestData);
    console.log('Validated data:', validatedData);

    // Check for duplicate email (Requirement 1.2)
    const isEmailAvailable = await authService.isEmailAvailable(validatedData.email);
    console.log('Is email available:', isEmailAvailable);
    if (!isEmailAvailable) {
      throw new ValidationError('An account with this email already exists');
    }

    // Perform user registration (Requirements 1.1, 1.4, 1.5)
    console.log('Signing up user...');
    const authResult = await authService.signUp(validatedData);
    console.log('User signed up successfully:', authResult);

    // Auth service already returns HandlerResponse<AuthResult> with proper format and headers
    return { data: authResult.response, headers: authResult.headers };
  },
  {
    // CORS configuration matching API Gateway settings
    cors: {
      origin: 'http://localhost:3000', // Must match API Gateway allowOrigins
      methods: ['POST', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true, // Must match API Gateway allowCredentials
    },
    // Enable error logging for debugging
    errorLogging: true,
    formatResponse: false
  }
);

export const handler = signUpHandler;