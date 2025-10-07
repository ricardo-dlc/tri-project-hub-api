import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { createFeatureLogger } from '../logger';
import { MiddlewareHandler } from '../types';
import { authenticateUser, ClerkUser, requireRole } from './clerk';

const logger = createFeatureLogger('auth');

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

    logger.debug({ userId: user.id, role: user.role, email: user.email }, 'User authenticated');

    // Check role requirements if specified
    if (options.requiredRoles && options.requiredRoles.length > 0) {
      requireRole(user, options.requiredRoles);
      logger.debug({ userId: user.id, role: user.role, requiredRoles: options.requiredRoles }, 'Role check passed');
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
