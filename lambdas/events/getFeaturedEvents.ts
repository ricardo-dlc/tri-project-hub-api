import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { withMiddleware } from '../middleware';
import { EventEntity } from './model';

const getFeaturedEventsHandler = async () => {
  const events = await EventEntity.query
    .FeaturedIndex({
      featuredStatus: 'featured',
    })
    .where(({ isEnabled }, { eq }) => eq(isEnabled, true))
    .go();

  return { events: events.data };
};

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  getFeaturedEventsHandler
);
