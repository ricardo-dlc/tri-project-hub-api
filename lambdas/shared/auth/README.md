# Role-Based Access Control (RBAC) Middleware

This document describes the comprehensive RBAC middleware implementation for the authentication system.

## Overview

The RBAC middleware provides fine-grained access control for Lambda functions based on user roles and permissions. It integrates seamlessly with the existing middleware architecture and provides multiple levels of authorization control.

## Features

### 1. Role-Based Access Control
- **User Roles**: `user`, `organizer`, `admin`
- **Role Hierarchy**: Each role has specific permissions
- **Role Validation**: Middleware validates user roles against required roles

### 2. Permission-Based Access Control
- **Granular Permissions**: Fine-grained permissions for specific actions
- **Permission Validation**: Middleware validates user permissions
- **Flexible Requirements**: Support for "all required" or "any required" permission matching

### 3. Advanced RBAC Configuration
- **RBACConfig**: Advanced configuration object for complex scenarios
- **Flexible Validation**: Combine roles and permissions in a single configuration
- **Customizable Logic**: Support for different validation strategies

### 4. Rate Limiting Integration
- **Built-in Rate Limiting**: Prevent brute force attacks
- **Configurable Limits**: Set custom rate limits per endpoint
- **Client-based Tracking**: Rate limiting per client IP and user agent

## Permission System

### Available Permissions

```typescript
type Permission =
  | 'read:profile'      // Read own profile
  | 'write:profile'     // Update own profile
  | 'read:events'       // View events
  | 'write:events'      // Create/edit events
  | 'delete:events'     // Delete events
  | 'manage:events'     // Full event management
  | 'read:users'        // View user list
  | 'write:users'       // Create/edit users
  | 'delete:users'      // Delete users
  | 'admin:system';     // System administration
```

### Role Permissions Mapping

```typescript
const ROLE_PERMISSIONS = {
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
  ]
};
```

## Middleware Functions

### 1. Basic Authentication Middleware

```typescript
// Optional authentication
export const publicEndpoint = withAuth(async (event: AuthenticatedEvent) => {
  // User info available if authenticated, but not required
  const user = event.user;
  return { authenticated: !!user };
});

// Required authentication
export const protectedEndpoint = withAuthRequired(async (event: AuthenticatedEvent) => {
  // User is guaranteed to be authenticated
  const user = getAuthenticatedUser(event);
  return { user: { id: user.id, role: user.role } };
});
```

### 2. Role-Based Middleware

```typescript
// Single role requirement
export const organizerEndpoint = withRole('organizer', async (event: AuthenticatedEvent) => {
  // Only organizers can access
  return { message: 'Organizer access granted' };
});

// Multiple role requirement (any of the roles)
export const adminOrOrganizerEndpoint = withRole(['organizer', 'admin'], async (event: AuthenticatedEvent) => {
  // Organizers or admins can access
  return { message: 'Admin or organizer access granted' };
});
```

### 3. Permission-Based Middleware

```typescript
// Single permission requirement
export const eventWriteEndpoint = withPermissions('write:events', async (event: AuthenticatedEvent) => {
  // Users with write:events permission can access
  return { message: 'Event write access granted' };
});

// Multiple permissions (all required by default)
export const eventManagementEndpoint = withPermissions(
  ['write:events', 'manage:events'],
  async (event: AuthenticatedEvent) => {
    // Users must have BOTH permissions
    return { message: 'Full event management access' };
  }
);

// Multiple permissions (any required)
export const flexibleEndpoint = withAuth(
  async (event: AuthenticatedEvent) => {
    return { message: 'Flexible access granted' };
  },
  {
    auth: {
      required: true,
      permissions: ['read:events', 'write:events'],
      requireAllPermissions: false, // User needs at least one permission
    },
  }
);
```

### 4. Advanced RBAC Middleware

```typescript
// Using RBACConfig for complex scenarios
export const complexEndpoint = withRBAC(
  {
    roles: ['organizer', 'admin'],
    permissions: ['write:events'],
    requireAll: true, // Must have role AND permission
  },
  async (event: AuthenticatedEvent) => {
    return { message: 'Complex RBAC access granted' };
  }
);

// Using withAuth with RBAC config
export const advancedEndpoint = withAuth(
  async (event: AuthenticatedEvent) => {
    return { message: 'Advanced access granted' };
  },
  {
    auth: {
      required: true,
      rbac: {
        roles: ['admin'],
        permissions: ['admin:system', 'write:users'],
        requireAll: false, // Admin role OR any of the permissions
      },
    },
  }
);
```

### 5. Rate Limited Endpoints

```typescript
export const rateLimitedEndpoint = withAuth(
  async (event: AuthenticatedEvent) => {
    return { message: 'Rate limited endpoint' };
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
```

## Utility Functions

### Role Checking

```typescript
import { hasRole, hasAnyRole } from '../shared/auth-middleware';

// Check specific role
if (hasRole(user, 'admin')) {
  // User is admin
}

// Check multiple roles
if (hasAnyRole(user, ['organizer', 'admin'])) {
  // User is organizer or admin
}
```

### Permission Checking

```typescript
import { 
  hasPermission, 
  hasAllPermissions, 
  hasAnyPermission,
  getUserPermissions 
} from '../shared/auth-middleware';

// Check specific permission
if (hasPermission(user, 'write:events')) {
  // User can write events
}

// Check all permissions required
if (hasAllPermissions(user, ['write:events', 'manage:events'])) {
  // User has both permissions
}

// Check any permission required
if (hasAnyPermission(user, ['read:events', 'write:events'])) {
  // User has at least one permission
}

// Get all user permissions
const permissions = getUserPermissions(user);
```

### Access Control Checking

```typescript
import { canAccess } from '../shared/auth-middleware';

const rbacConfig = {
  roles: ['organizer', 'admin'],
  permissions: ['write:events'],
  requireAll: true,
};

if (canAccess(user, rbacConfig)) {
  // User meets RBAC requirements
}
```

## Error Handling

### Authentication Errors

- **AuthenticationError (401)**: User not authenticated
- **InvalidTokenError (401)**: Invalid or expired token
- **SessionExpiredError (401)**: Session has expired

### Authorization Errors

- **AuthorizationError (403)**: Insufficient permissions or wrong role
- **ForbiddenError (403)**: Access denied

### Rate Limiting Errors

- **TooManyRequestsError (429)**: Rate limit exceeded

### Error Integration

All auth errors are automatically handled by the existing error handling system and return appropriate HTTP status codes and error messages.

## Configuration Options

### AuthMiddlewareOptions

```typescript
interface AuthMiddlewareOptions extends MiddlewareOptions {
  auth?: {
    required?: boolean;                    // Require authentication
    roles?: string[];                      // Required roles (any of)
    permissions?: string[];                // Required permissions
    requireAllPermissions?: boolean;       // Require all permissions (default: true)
    rateLimiting?: RateLimitConfig;       // Rate limiting config
    rbac?: RBACConfig;                    // Advanced RBAC config
  };
}
```

### RBACConfig

```typescript
interface RBACConfig {
  roles?: UserRole[];                      // Required roles
  permissions?: Permission[];              // Required permissions
  requireAll?: boolean;                    // Require all conditions (default: true)
}
```

### RateLimitConfig

```typescript
interface RateLimitConfig {
  maxAttempts: number;                     // Maximum attempts
  windowMs: number;                        // Time window in milliseconds
}
```

## Best Practices

### 1. Use Appropriate Middleware Level

- Use `withAuth` for optional authentication
- Use `withAuthRequired` for mandatory authentication
- Use `withRole` for role-based access
- Use `withPermissions` for permission-based access
- Use `withRBAC` for complex scenarios

### 2. Permission Design

- Keep permissions granular and specific
- Use consistent naming conventions
- Group related permissions logically
- Consider permission inheritance through roles

### 3. Error Handling

- Let the middleware handle authentication/authorization errors
- Use utility functions for conditional logic
- Provide meaningful error messages for debugging

### 4. Performance Considerations

- Rate limiting is stored in memory (consider Redis for production)
- Permission checks are fast (array lookups)
- Avoid complex RBAC logic in hot paths

### 5. Security Considerations

- Always validate permissions server-side
- Use the principle of least privilege
- Regularly audit role and permission assignments
- Monitor for suspicious authentication patterns

## Testing

The RBAC middleware includes comprehensive unit tests covering:

- Token extraction and validation
- Role-based access control
- Permission-based access control
- Advanced RBAC configurations
- Rate limiting functionality
- Error handling scenarios
- Utility function behavior
- Integration with existing middleware

Run tests with:
```bash
npm test lambdas/shared/__tests__/auth-middleware.test.ts
```

## Integration with Requirements

This implementation satisfies the following requirements:

- **Requirement 4.3**: Role and permission validation middleware
- **Requirement 4.4**: Authorization error handling
- **Requirement 4.5**: Integration with existing error handling system
- **Requirement 5.1**: Seamless integration with Lambda architecture
- **Requirement 2.5**: Rate limiting for security

The RBAC middleware provides a comprehensive, flexible, and secure authorization system that integrates seamlessly with the existing authentication infrastructure.