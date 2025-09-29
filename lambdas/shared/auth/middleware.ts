import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { MiddlewareHandler } from '../types';
import { authenticateUser, ClerkUser, requireRole } from './clerk';

export interface AuthenticatedEvent extends APIGatewayProxyEventV2 {
  user: ClerkUser;
}

export type AuthenticatedHandler<T = any> = (
  event: AuthenticatedEvent,
  context: Context
) => Promise<T> | T;

export const withAuth = <T = any>(
  handler: AuthenticatedHandler<T>,
  options: {
    requiredRoles?: ('organizer' | 'admin')[];
  } = {}
): MiddlewareHandler<T> => {
  return async (event: APIGatewayProxyEventV2, context: Context) => {
    // Authenticate user
    const user = await authenticateUser(event);

    // Check role requirements if specified
    if (options.requiredRoles && options.requiredRoles.length > 0) {
      requireRole(user, options.requiredRoles);
    }

    // Add user to event object
    const authenticatedEvent: AuthenticatedEvent = {
      ...event,
      user,
    };

    // Call the original handler with authenticated event
    return await handler(authenticatedEvent, context);
  };
};
