import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { BadRequestError, withMiddleware } from '../../../shared';
import { AuthenticatedEvent, withAuth } from '../../../shared/auth/middleware';
import { createFeatureLogger } from '../../../shared/logger';
import { eventService } from '../services';

const logger = createFeatureLogger('events');

/**
 * Handler for deleting an event
 * DELETE /events/{eventId}
 */
const deleteEventHandler = async (event: AuthenticatedEvent) => {
  const { eventId } = event.pathParameters ?? {};

  if (!eventId) {
    throw new BadRequestError('Event ID is required');
  }

  // Get user from authenticated request
  if (!event.user?.id) {
    throw new BadRequestError('User authentication required');
  }

  logger.debug({ eventId, userId: event.user.id }, 'Processing delete event request');

  await eventService.deleteEvent(eventId, event.user);

  logger.info({ eventId, deletedBy: event.user.id }, 'Event deleted successfully');

  return {
    statusCode: 204,
    data: null,
  };
};

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(deleteEventHandler)
);
