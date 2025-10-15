import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { BadRequestError, NotFoundError, withMiddleware } from '@/shared';
import { createFeatureLogger } from '@/shared/logger';
import { EventEntity } from '../models/event.model';

const logger = createFeatureLogger('events');

// Refactored handler using arrow function, async/await, and destructuring
const getEventByIdHandler = async (event: APIGatewayProxyEventV2) => {
  // Use optional chaining for parameter validation and destructuring
  const { id } = event.pathParameters ?? {};

  if (!id) {
    throw new BadRequestError('Missing id parameter');
  }

  logger.debug({ id }, 'Fetching event by id');

  const eventInfo = await EventEntity.get({ eventId: id }).go();

  if (!eventInfo.data) {
    throw new NotFoundError('Event not found');
  }

  // Return plain object using object shorthand syntax
  return {
    event: eventInfo.data,
  };
};

// Export wrapped handler
export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  getEventByIdHandler
);
