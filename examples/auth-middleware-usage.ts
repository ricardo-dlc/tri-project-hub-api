/**
 * Example usage of the authentication middleware
 * Demonstrates various authentication and authorization patterns
 */

import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  withAuth,
  withAuthRequired,
  withRole,
  withPermissions,
  withRBAC,
  getAuthenticatedUser,
  getAuthContext,
  hasRole,
  hasPermission,
  hasAllPermissions,
  canAccess,
  type AuthenticatedEvent,
} from '../lambdas/shared/auth-middleware';
import type { UserRole, Permission } from '../lambdas/features/auth/types/auth.types';

// Example 1: Public endpoint (no authentication required)
export const publicEndpoint: APIGatewayProxyHandlerV2 = withAuth(
  async (event: AuthenticatedEvent) => {
    // This endpoint is accessible to everyone
    // User information is available if they're authenticated, but not required
    const user = event.user;

    return {
      message: 'This is a public endpoint',
      authenticated: !!user,
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
    };
  }
);

// Example 2: Protected endpoint (authentication required)
export const protectedEndpoint: APIGatewayProxyHandlerV2 = withAuthRequired(
  async (event: AuthenticatedEvent) => {
    // This endpoint requires authentication
    const user = getAuthenticatedUser(event);

    return {
      message: 'This is a protected endpoint',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
);

// Example 3: Role-based endpoint (organizer or admin only)
export const organizerEndpoint: APIGatewayProxyHandlerV2 = withRole(
  ['organizer', 'admin'],
  async (event: AuthenticatedEvent) => {
    const user = getAuthenticatedUser(event);

    return {
      message: 'This endpoint is for organizers and admins only',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
);

// Example 4: Admin-only endpoint
export const adminEndpoint: APIGatewayProxyHandlerV2 = withRole(
  'admin',
  async (event: AuthenticatedEvent) => {
    const user = getAuthenticatedUser(event);

    return {
      message: 'This endpoint is for admins only',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
);

// Example 5: Permission-based endpoint
export const eventManagementEndpoint: APIGatewayProxyHandlerV2 = withPermissions(
  ['write:events', 'manage:events'],
  async (event: AuthenticatedEvent) => {
    const user = getAuthenticatedUser(event);

    return {
      message: 'This endpoint requires event management permissions',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
);

// Example 6: Rate-limited endpoint
export const rateLimitedEndpoint: APIGatewayProxyHandlerV2 = withAuth(
  async (event: AuthenticatedEvent) => {
    return {
      message: 'This endpoint has rate limiting',
      timestamp: new Date().toISOString(),
    };
  },
  {
    auth: {
      rateLimiting: {
        maxAttempts: 10,
        windowMs: 60000, // 1 minute
      },
    },
  }
);

// Example 7: Complex endpoint with multiple requirements
export const complexEndpoint: APIGatewayProxyHandlerV2 = withAuth(
  async (event: AuthenticatedEvent) => {
    const authContext = getAuthContext(event);

    return {
      message: 'Complex endpoint with multiple auth requirements',
      user: {
        id: authContext.user.id,
        email: authContext.user.email,
        role: authContext.user.role,
      },
      session: {
        id: authContext.session.id,
        expires: authContext.session.expires,
      },
    };
  },
  {
    auth: {
      required: true,
      roles: ['organizer', 'admin'] as UserRole[],
      permissions: ['write:events'] as Permission[],
      rateLimiting: {
        maxAttempts: 5,
        windowMs: 60000,
      },
    },
    cors: {
      origin: 'https://example.com',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  }
);

// Example 8: User profile endpoint
export const getUserProfile: APIGatewayProxyHandlerV2 = withAuthRequired(
  async (event: AuthenticatedEvent) => {
    const user = getAuthenticatedUser(event);

    // Return user profile without sensitive information
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
);

// Example 9: Event creation endpoint (organizer+ only)
export const createEvent: APIGatewayProxyHandlerV2 = withPermissions(
  'write:events',
  async (event: AuthenticatedEvent) => {
    const user = getAuthenticatedUser(event);
    const body = JSON.parse(event.body || '{}');

    // Validate event data
    if (!body.title || !body.description) {
      return {
        statusCode: 400,
        data: {
          error: 'Title and description are required',
        },
      };
    }

    // Create event logic would go here
    return {
      message: 'Event created successfully',
      event: {
        id: 'event_123',
        title: body.title,
        description: body.description,
        organizerId: user.id,
        createdAt: new Date().toISOString(),
      },
    };
  }
);

// Example 10: User management endpoint (admin only)
export const manageUsers: APIGatewayProxyHandlerV2 = withPermissions(
  ['read:users', 'write:users'],
  async (event: AuthenticatedEvent) => {
    const user = getAuthenticatedUser(event);
    const method = event.requestContext.http.method;

    switch (method) {
      case 'GET':
        return {
          message: 'List all users',
          users: [
            // Mock user list
            { id: 'user_1', email: 'user1@example.com', role: 'user' },
            { id: 'user_2', email: 'user2@example.com', role: 'organizer' },
          ],
        };

      case 'POST':
        return {
          message: 'Create new user',
          // User creation logic would go here
        };

      case 'PUT':
        return {
          message: 'Update user',
          // User update logic would go here
        };

      case 'DELETE':
        return {
          message: 'Delete user',
          // User deletion logic would go here
        };

      default:
        return {
          statusCode: 405,
          data: {
            error: 'Method not allowed',
          },
        };
    }
  }
);

// Example 11: Error handling demonstration
export const errorHandlingExample: APIGatewayProxyHandlerV2 = withAuthRequired(
  async (event: AuthenticatedEvent) => {
    const user = getAuthenticatedUser(event);
    const { action } = JSON.parse(event.body || '{}');

    switch (action) {
      case 'success':
        return {
          message: 'Operation successful',
          user: { id: user.id, email: user.email },
        };

      case 'not_found':
        throw new Error('Resource not found');

      case 'validation_error':
        throw new Error('Invalid input data');

      case 'server_error':
        throw new Error('Internal server error');

      default:
        return {
          message: 'Specify an action: success, not_found, validation_error, or server_error',
        };
    }
  }
);

// Example 12: Advanced RBAC with withRBAC
export const advancedRBACEndpoint: APIGatewayProxyHandlerV2 = withRBAC(
  {
    roles: ['organizer', 'admin'] as UserRole[],
    permissions: ['write:events', 'manage:events'] as Permission[],
    requireAll: false, // User needs either permission, not both
  },
  async (event: AuthenticatedEvent) => {
    const user = getAuthenticatedUser(event);

    return {
      message: 'Advanced RBAC endpoint accessed',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessLevel: hasRole(user, 'admin') ? 'full' : 'limited',
    };
  }
);

// Example 13: Flexible permissions (any permission required)
export const flexiblePermissionsEndpoint: APIGatewayProxyHandlerV2 = withAuth(
  async (event: AuthenticatedEvent) => {
    const user = getAuthenticatedUser(event);

    return {
      message: 'Flexible permissions endpoint',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  },
  {
    auth: {
      required: true,
      permissions: ['read:events', 'write:events', 'manage:events'] as Permission[],
      requireAllPermissions: false, // User needs at least one permission
    },
  }
);

// Example 14: Dynamic permission checking
export const dynamicPermissionEndpoint: APIGatewayProxyHandlerV2 = withAuthRequired(
  async (event: AuthenticatedEvent) => {
    const user = getAuthenticatedUser(event);
    const { action } = JSON.parse(event.body || '{}');

    // Dynamic permission checking based on action
    switch (action) {
      case 'read':
        if (!hasPermission(user, 'read:events')) {
          return {
            statusCode: 403,
            data: { error: 'Read permission required' },
          };
        }
        break;

      case 'write':
        if (!hasPermission(user, 'write:events')) {
          return {
            statusCode: 403,
            data: { error: 'Write permission required' },
          };
        }
        break;

      case 'admin':
        if (!hasAllPermissions(user, ['admin:system', 'write:users'] as Permission[])) {
          return {
            statusCode: 403,
            data: { error: 'Admin permissions required' },
          };
        }
        break;

      default:
        return {
          statusCode: 400,
          data: { error: 'Invalid action' },
        };
    }

    return {
      message: `${action} action authorized`,
      user: { id: user.id, role: user.role },
    };
  }
);

// Example 15: Resource-based access control
export const resourceAccessEndpoint: APIGatewayProxyHandlerV2 = withAuthRequired(
  async (event: AuthenticatedEvent) => {
    const user = getAuthenticatedUser(event);
    const { resourceId, operation } = event.pathParameters || {};

    // Check if user can access this specific resource
    const rbacConfig = {
      roles: ['organizer', 'admin'] as UserRole[],
      permissions: (operation === 'read' ? ['read:events'] : ['write:events']) as Permission[],
      requireAll: true,
    };

    if (!canAccess(user, rbacConfig)) {
      return {
        statusCode: 403,
        data: {
          error: `Access denied for ${operation} operation on resource ${resourceId}`,
        },
      };
    }

    return {
      message: `Access granted for ${operation} on resource ${resourceId}`,
      user: { id: user.id, role: user.role },
      resource: { id: resourceId, operation },
    };
  }
);

// Example 16: Conditional authentication
export const conditionalAuthEndpoint: APIGatewayProxyHandlerV2 = withAuth(
  async (event: AuthenticatedEvent) => {
    const user = event.user;
    const { requireAuth } = event.queryStringParameters || {};

    if (requireAuth === 'true' && !user) {
      return {
        statusCode: 401,
        data: {
          error: 'Authentication required for this operation',
        },
      };
    }

    return {
      message: 'Conditional authentication endpoint',
      authenticated: !!user,
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
    };
  }
);