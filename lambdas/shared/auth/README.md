# Authentication with Clerk

This module provides Clerk-based authentication and authorization for Lambda functions.

## Setup

1. Ensure `@clerk/backend` is installed (already in package.json)
2. Set the `CLERK_SECRET_KEY` environment variable in your Lambda configuration
3. Configure your Clerk application to include role information in `publicMetadata`

## Usage

### Basic Authentication

```typescript
import { withMiddleware, withAuth, AuthenticatedEvent } from '../../shared';

export const handler = withMiddleware(
  withAuth(async (event: AuthenticatedEvent) => {
    // Access authenticated user via event.user
    const userId = event.user.id;
    const userRole = event.user.role;
    
    return { userId, userRole };
  })
);
```

### Role-Based Authorization

```typescript
// Require specific roles
export const handler = withMiddleware(
  withAuth(async (event: AuthenticatedEvent) => {
    // Only organizers and admins can access this
    return { message: 'Authorized access' };
  }, {
    requiredRoles: ['organizer', 'admin']
  })
);
```

### User-Scoped Resources

Instead of passing user IDs in the URL path, use the authenticated user's ID:

```typescript
// Before: GET /events/user/{userId}
// After: GET /events/user (uses authenticated user's ID)

export const handler = withMiddleware(
  withAuth(async (event: AuthenticatedEvent) => {
    const userId = event.user.id; // Always the authenticated user
    
    // Query user's resources
    const userEvents = await EventEntity.query
      .CreatorIndex({ clerkId: userId })
      .go();
    
    return { events: userEvents.data };
  }, {
    requiredRoles: ['organizer', 'admin']
  })
);
```

## User Object

The `event.user` object contains:

```typescript
interface ClerkUser {
  id: string;              // Clerk user ID
  role?: 'organizer' | 'admin'; // From publicMetadata
  email?: string;          // Primary email address
}
```

## Error Handling

The middleware automatically handles:
- Missing authorization headers → 401 Unauthorized
- Invalid tokens → 401 Unauthorized  
- Insufficient permissions → 403 Forbidden

## Environment Variables

- `CLERK_SECRET_KEY`: Your Clerk secret key (required)

## Clerk Configuration

In your Clerk dashboard, ensure users have their role set in `publicMetadata`:

```json
{
  "role": "organizer"
}
```

Supported roles: `organizer`, `admin`