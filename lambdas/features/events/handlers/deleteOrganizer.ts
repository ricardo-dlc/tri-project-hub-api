import type {
  APIGatewayProxyHandlerV2
} from 'aws-lambda';
import { AuthenticatedEvent, withAuth } from '@/shared/auth/middleware';
import { BadRequestError } from '@/shared/errors';
import { createFeatureLogger } from '@/shared/logger';
import { withMiddleware } from '@/shared/wrapper';
import { organizerService } from '@/features/events/services';

const logger = createFeatureLogger('organizers');

const deleteOrganizerHandler = async (event: AuthenticatedEvent) => {
  logger.debug('Deleting organizer');

  // Extract organizerId from path parameters
  const { organizerId } = event.pathParameters || {};
  if (!organizerId) {
    throw new BadRequestError('Organizer ID is required in path parameters');
  }

  // Get user from authenticated event
  const user = event.user;
  if (!user) {
    throw new BadRequestError('User authentication required');
  }

  await organizerService.deleteOrganizer(organizerId, user);

  logger.info({ organizerId, clerkId: user.id }, 'Organizer deleted successfully');

  return {
    statusCode: 204,
    body: null,
  };
};

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(deleteOrganizerHandler, {
    requiredRoles: ['organizer', 'admin'],
  })
);