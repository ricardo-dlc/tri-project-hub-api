import type {
  APIGatewayProxyHandlerV2
} from 'aws-lambda';
import { AuthenticatedEvent, withAuth } from '@/shared/auth/middleware';
import { BadRequestError } from '@/shared/errors';
import { createFeatureLogger } from '@/shared/logger';
import { withMiddleware } from '@/shared/wrapper';
import { organizerService } from '@/features/events/services';

const logger = createFeatureLogger('organizers');

const getOrganizerMeHandler = async (event: AuthenticatedEvent) => {
  logger.debug('Getting current user organizer');

  // Get user from authenticated event
  const user = event.user;
  if (!user) {
    throw new BadRequestError('User authentication required');
  }

  // Get organizer by Clerk ID
  const organizer = await organizerService.getOrganizerByClerkId(user.id);

  logger.info({ organizerId: organizer.organizerId, clerkId: user.id }, 'Current user organizer retrieved successfully');

  return {
    organizer,
  };
};

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(getOrganizerMeHandler, {
    requiredRoles: ['organizer', 'admin'],
  })
);
