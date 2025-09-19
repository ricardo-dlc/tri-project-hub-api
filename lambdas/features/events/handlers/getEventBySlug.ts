import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { BadRequestError, NotFoundError } from '../../../shared/errors';
import { withMiddleware } from '../../../shared/wrapper';
import { EventEntity } from '../models/event.model';

// Refactored handler using arrow function, async/await, and destructuring
const getEventBySlugHandler = async (event: APIGatewayProxyEventV2) => {
  // Use optional chaining for parameter validation and destructuring
  const { slug } = event.pathParameters ?? {};

  if (!slug) {
    throw new BadRequestError('Missing slug parameter');
  }

  console.log('Slug: ', slug);

  const eventInfo = await EventEntity.query
    .SlugIndex({ slug })
    .begins({ slugDate: slug })
    .where(({ isEnabled }, { eq }) => eq(isEnabled, true))
    .go();

  console.log('Event info: ', eventInfo);

  if (!eventInfo.data.length) {
    throw new NotFoundError('Event not found');
  }

  // Return plain object using object shorthand syntax
  return {
    event: eventInfo.data[0],
  };
};

// Export wrapped handler
export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  getEventBySlugHandler
);
