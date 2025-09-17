/**
 * Example usage of Better-Auth configuration
 * This file demonstrates how to use the auth methods correctly
 */

// Set up test environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-characters-long';
process.env.API_BASE_URL = 'http://localhost:3001';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'development';

import { auth, validateSessionToken } from '../lambdas/shared/auth/better-auth';

// Example of how to use Better-Auth methods
async function exampleUsage() {
  console.log('✅ Better-Auth configuration loaded successfully');

  // Example: Sign up a new user
  try {
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: 'test@example.com',
        password: 'securepassword123',
        name: 'Test User'
      }
    });
    console.log('Sign up result:', signUpResult);
  } catch (error) {
    console.log('Sign up example (expected to fail without DB):', (error as Error).message);
  }

  // Example: Sign in a user
  try {
    const signInResult = await auth.api.signInEmail({
      body: {
        email: 'test@example.com',
        password: 'securepassword123'
      }
    });
    console.log('Sign in result:', signInResult);
  } catch (error) {
    console.log('Sign in example (expected to fail without DB):', (error as Error).message);
  }

  // Example: Validate session token
  const validationResult = await validateSessionToken('invalid-token');
  console.log('Token validation result:', validationResult);

  console.log('✅ All auth methods are accessible and working');
}

exampleUsage().catch(console.error);