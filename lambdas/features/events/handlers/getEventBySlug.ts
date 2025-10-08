import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { BadRequestError } from '../../../shared/errors';
import { createFeatureLogger } from '../../../shared/logger';
import { withMiddleware } from '../../../shared/wrapper';
import { eventService } from '../services';

const logger = createFeatureLogger('events');

// Refactored handler using arrow function, async/await, and destructuring
const getEventBySlugHandler = async (event: APIGatewayProxyEventV2) => {
  // Use optional chaining for parameter validation and destructuring
  const { slug } = event.pathParameters ?? {};

  if (!slug) {
    throw new BadRequestError('Missing slug parameter');
  }

  logger.debug({ slug }, 'Fetching event by slug');

  const eventData = await eventService.getEventBySlug(slug);

  // Return plain object using object shorthand syntax
  return {
    event: eventData,
  };
};

// Export wrapped handler
export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  getEventBySlugHandler
);
