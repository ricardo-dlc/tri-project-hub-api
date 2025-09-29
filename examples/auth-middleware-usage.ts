/**
 * Example usage of the Clerk authentication middleware
 * Demonstrates various authentication and authorization patterns
 */

import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { withMiddleware, withAuth, AuthenticatedEvent } from '../lambdas/shared';

// Public endpoint - no authentication required
export const publicEndpoint: APIGatewayProxyHandlerV2 = withMiddleware(
  async (event) => {
    return { message: 'This is a public endpoint' };
  }
);

// Protected endpoint - requires authentication but any role
export const protectedEndpoint: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(async (event: AuthenticatedEvent) => {
    return {
      message: 'This is a protected endpoint',
      userId: event.user.id,
      userRole: event.user.role,
    };
  })
);

// Organizer-only endpoint
export const organizerEndpoint: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(async (event: AuthenticatedEvent) => {
    return {
      message: 'Organizer access granted',
      userId: event.user.id,
    };
  }, {
    requiredRoles: ['organizer'],
  })
);

// Admin-only endpoint
export const adminEndpoint: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(async (event: AuthenticatedEvent) => {
    return {
      message: 'Admin access granted',
      userId: event.user.id,
    };
  }, {
    requiredRoles: ['admin'],
  })
);

// Endpoint accessible by both organizers and admins
export const eventManagementEndpoint: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(async (event: AuthenticatedEvent) => {
    return {
      message: 'Event management access',
      userId: event.user.id,
      role: event.user.role,
    };
  }, {
    requiredRoles: ['organizer', 'admin'],
  })
);

// Get user's own profile - uses authenticated user ID
export const getUserProfile: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(async (event: AuthenticatedEvent) => {
    // No need to get userId from path - it comes from the token
    const userId = event.user.id;
    
    return {
      userId,
      email: event.user.email,
      role: event.user.role,
    };
  }, {
    requiredRoles: ['organizer', 'admin'],
  })
);

// Create event - automatically sets creator to authenticated user
export const createEvent: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(async (event: AuthenticatedEvent) => {
    const eventData = JSON.parse(event.body || '{}');
    
    // Automatically set the creator to the authenticated user
    const newEvent = {
      ...eventData,
      creatorId: event.user.id, // Always use authenticated user's ID
      createdAt: new Date().toISOString(),
    };
    
    return {
      message: 'Event created successfully',
      event: newEvent,
    };
  }, {
    requiredRoles: ['organizer', 'admin'],
  })
);

// Get events by creator - uses authenticated user's ID (like your updated handler)
export const getEventsByCreator: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(async (event: AuthenticatedEvent) => {
    // Get the creator ID from the authenticated user (not from path)
    const creatorId = event.user.id;
    
    // Your pagination logic would go here
    const queryParams = event.queryStringParameters ?? {};
    
    return {
      message: 'Events retrieved successfully',
      creatorId,
      // events: ... your query results
    };
  }, {
    requiredRoles: ['organizer', 'admin'],
  })
);