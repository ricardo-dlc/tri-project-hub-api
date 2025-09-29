import { createClerkClient, verifyToken } from '@clerk/backend';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ForbiddenError, NotAuthorizedError } from '../errors';

// Ensure Clerk is configured with the secret key
if (!process.env.CLERK_SECRET_KEY) {
  throw new Error('CLERK_SECRET_KEY environment variable is required');
}

// Create Clerk client instance
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export interface ClerkUser {
  id: string;
  role?: 'organizer' | 'admin';
  email?: string;
}

export const extractTokenFromEvent = (event: APIGatewayProxyEventV2): string => {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;

  if (!authHeader) {
    throw new NotAuthorizedError('Missing authorization header');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    throw new NotAuthorizedError('Invalid authorization header format');
  }

  return token;
};

export const verifyClerkToken = async (token: string): Promise<ClerkUser> => {
  try {
    // Use the standalone verifyToken function
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    if (!payload.sub) {
      throw new NotAuthorizedError('Invalid token payload');
    }

    // Get user details to access public metadata
    const user = await clerkClient.users.getUser(payload.sub);

    const role = user.publicMetadata?.role as 'organizer' | 'admin' | undefined;

    return {
      id: payload.sub,
      role,
      email: user.emailAddresses?.[0]?.emailAddress,
    };
  } catch (error) {
    if (error instanceof NotAuthorizedError) {
      throw error;
    }
    console.error('Token verification error:', error);
    throw new NotAuthorizedError('Token verification failed');
  }
};

export const requireRole = (user: ClerkUser, allowedRoles: ('organizer' | 'admin')[]): void => {
  if (!user.role || !allowedRoles.includes(user.role)) {
    throw new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
  }
};

export const authenticateUser = async (event: APIGatewayProxyEventV2): Promise<ClerkUser> => {
  const token = extractTokenFromEvent(event);
  return await verifyClerkToken(token);
};
