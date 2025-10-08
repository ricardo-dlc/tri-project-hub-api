import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { withAuth } from '../../../shared/auth/middleware';
import { BadRequestError } from '../../../shared/errors';
import { createFeatureLogger } from '../../../shared/logger';
import { withMiddleware } from '../../../shared/wrapper';
import { organizerService } from '../services';
import { UpdateOrganizerData } from '../types/organizer.types';

const logger = createFeatureLogger('organizers');

const updateOrganizerHandler = async (event: APIGatewayProxyEventV2 & { user?: any }) => {
  logger.debug('Updating organizer');

  // Extract organizerId from path parameters
  const { organizerId } = event.pathParameters || {};
  if (!organizerId) {
    throw new BadRequestError('Organizer ID is required in path parameters');
  }

  if (!event.body) {
    throw new BadRequestError('Request body is required');
  }

  let updateData: UpdateOrganizerData;
  try {
    updateData = JSON.parse(event.body);
  } catch (error) {
    throw new BadRequestError('Invalid JSON in request body');
  }

  // Get user from authenticated event
  const user = event.user;
  if (!user) {
    throw new BadRequestError('User authentication required');
  }

  const updatedOrganizer = await organizerService.updateOrganizer(organizerId, updateData, user);

  logger.info({ organizerId, clerkId: user.id }, 'Organizer updated successfully');

  return {
    statusCode: 200,
    body: {
      organizer: updatedOrganizer,
    },
  };
};

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(updateOrganizerHandler, {
    requiredRoles: ['organizer', 'admin'],
  })
);
