import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { BadRequestError, withMiddleware } from '../../../shared';
import { withAuth } from '../../../shared/auth/middleware';
import { createFeatureLogger } from '../../../shared/logger';
import { eventService } from '../services';
import { UpdateEventData } from '../types/event.types';

const logger = createFeatureLogger('events');

const updateEventHandler = async (event: APIGatewayProxyEventV2 & { user?: any }) => {
  const { eventId } = event.pathParameters ?? {};

  if (!eventId) {
    throw new BadRequestError('Event ID is required');
  }

  if (!event.body) {
    throw new BadRequestError('Request body is required');
  }

  let updateData: UpdateEventData;
  try {
    updateData = JSON.parse(event.body);
  } catch (error) {
    throw new BadRequestError('Invalid JSON in request body');
  }

  // Explicitly check for slug in update data and reject it
  if ('slug' in updateData) {
    throw new BadRequestError('Event slug cannot be modified after creation');
  }

  // Get user from authenticated request
  if (!event.user?.id) {
    throw new BadRequestError('User authentication required');
  }

  logger.debug({ eventId, updateData, userId: event.user.id }, 'Updating event');

  const updatedEvent = await eventService.updateEvent(eventId, updateData, event.user);

  logger.info({ eventId, updatedFields: Object.keys(updateData) }, 'Event updated successfully');

  return {
    statusCode: 200,
    body: {
      event: updatedEvent,
    },
  };
};

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(updateEventHandler)
);
