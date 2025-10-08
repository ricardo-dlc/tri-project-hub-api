import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { BadRequestError, withMiddleware } from '../../../shared';
import { withAuth } from '../../../shared/auth/middleware';
import { createFeatureLogger } from '../../../shared/logger';
import { organizerService } from '../services';
import { CreateOrganizerData } from '../types/organizer.types';

const logger = createFeatureLogger('organizers');

const createOrganizerHandler = async (event: APIGatewayProxyEventV2 & { user?: any }) => {
  logger.debug('Creating new organizer');

  if (!event.body) {
    throw new BadRequestError('Request body is required');
  }

  let organizerData: CreateOrganizerData;
  try {
    organizerData = JSON.parse(event.body);
  } catch (error) {
    throw new BadRequestError('Invalid JSON in request body');
  }

  // Validate required fields
  if (!organizerData.name) {
    throw new BadRequestError('Organizer name is required');
  }

  if (!organizerData.contact) {
    throw new BadRequestError('Organizer contact is required');
  }

  // Get user from authenticated event
  const user = event.user;
  if (!user) {
    throw new BadRequestError('User authentication required');
  }

  const createdOrganizer = await organizerService.createOrganizer(organizerData, user);

  logger.info({ organizerId: createdOrganizer.organizerId, clerkId: user.id }, 'Organizer created successfully');

  return {
    statusCode: 201,
    body: {
      organizer: createdOrganizer,
    },
  };
};

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(createOrganizerHandler, {
    requiredRoles: ['organizer', 'admin'],
  })
);
