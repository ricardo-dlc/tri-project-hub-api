import type {
  APIGatewayProxyHandlerV2
} from 'aws-lambda';
import { BadRequestError, withMiddleware } from '../../../shared';
import { AuthenticatedEvent, withAuth } from '../../../shared/auth/middleware';
import { createFeatureLogger } from '../../../shared/logger';
import { eventService } from '../services';
import { CreateEventData } from '../types/event.types';

const logger = createFeatureLogger('events');

const createEventHandler = async (event: AuthenticatedEvent) => {
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

  if (!eventData.type) {
    throw new BadRequestError('Event type is required');
  }

  if (!eventData.date) {
    throw new BadRequestError('Event date is required');
  }

  if (typeof eventData.isTeamEvent !== 'boolean') {
    throw new BadRequestError('isTeamEvent must be a boolean');
  }

  if (typeof eventData.requiredParticipants !== 'number' || eventData.requiredParticipants <= 0) {
    throw new BadRequestError('requiredParticipants must be a positive number');
  }

  if (typeof eventData.maxParticipants !== 'number' || eventData.maxParticipants <= 0) {
    throw new BadRequestError('maxParticipants must be a positive number');
  }

  if (!eventData.location) {
    throw new BadRequestError('Event location is required');
  }

  if (!eventData.description) {
    throw new BadRequestError('Event description is required');
  }

  if (!eventData.distance) {
    throw new BadRequestError('Event distance is required');
  }

  if (typeof eventData.registrationFee !== 'number' || eventData.registrationFee < 0) {
    throw new BadRequestError('registrationFee must be a non-negative number');
  }

  if (!eventData.registrationDeadline) {
    throw new BadRequestError('registrationDeadline is required');
  }

  if (!eventData.image) {
    throw new BadRequestError('Event image is required');
  }

  if (!eventData.difficulty) {
    throw new BadRequestError('Event difficulty is required');
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
    data: { event: createdEvent },
  };
};

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(createEventHandler)
);
