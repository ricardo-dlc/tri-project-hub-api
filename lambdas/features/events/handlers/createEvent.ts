import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { BadRequestError, withMiddleware } from '../../../shared';
import { withAuth } from '../../../shared/auth/middleware';
import { createFeatureLogger } from '../../../shared/logger';
import { eventService } from '../services';
import { CreateEventData } from '../types/event.types';

const logger = createFeatureLogger('events');

const createEventHandler = async (event: APIGatewayProxyEventV2 & { user?: any }) => {
  logger.debug('Creating new event');

  if (!event.body) {
    throw new BadRequestError('Request body is required');
  }

  let eventData: CreateEventData;
  try {
    eventData = JSON.parse(event.body);
  } catch (error) {
    throw new BadRequestError('Invalid JSON in request body');
  }

  // Validate required fields
  if (!eventData.title) {
    throw new BadRequestError('Event title is required');
  }

  // Get creator ID from authenticated user
  const creatorId = event.user?.id;
  if (!creatorId) {
    throw new BadRequestError('User authentication required');
  }

  const createdEvent = await eventService.createEvent(eventData, creatorId, event.user);

  logger.info({ eventId: createdEvent.eventId, slug: createdEvent.slug }, 'Event created successfully');

  return {
    statusCode: 201,
    body: {
      event: createdEvent,
    },
  };
};

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(createEventHandler)
);
