import type {
  APIGatewayProxyHandlerV2
} from 'aws-lambda';
import { AuthenticatedEvent, withAuth } from '../../../shared/auth/middleware';
import { BadRequestError } from '../../../shared/errors';
import { createFeatureLogger } from '../../../shared/logger';
import { withMiddleware } from '../../../shared/wrapper';
import { organizerService } from '../services';

const logger = createFeatureLogger('organizers');

const getOrganizerHandler = async (event: AuthenticatedEvent) => {
  logger.debug('Getting organizer by ID');

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

  // Get organizer with access validation
  const organizer = await organizerService.validateOrganizerExists(organizerId, user);

  logger.info({ organizerId, clerkId: user.id }, 'Organizer retrieved successfully');

  return {
    organizer,
  };
};

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(getOrganizerHandler, {
    requiredRoles: ['organizer', 'admin'],
  })
);
