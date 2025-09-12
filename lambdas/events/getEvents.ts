import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { withMiddleware } from '../middleware';
import { EventEntity } from './model';

interface EventQueryParams {
  type?: string;
  difficulty?: string;
}

const getEventsHandler = async (event: APIGatewayProxyEventV2) => {
  const queryParams: EventQueryParams = event.queryStringParameters ?? {};
  const { type, difficulty } = queryParams;

  console.log(`Query parameters:`, queryParams);
  let query;
  // Determine query priority: isFeatured > type > difficulty > default
  if (type) {
    console.log(`Querying events by type: ${type}`);
    query = EventEntity.query
      .TypeIndex({
        type,
      })
      .where(({ isEnabled }, { eq }) => eq(isEnabled, true));
  } else if (difficulty) {
    console.log(`Querying events by difficulty: ${difficulty}`);
    query = EventEntity.query
      .DifficultyIndex({
        difficulty,
      })
      .where(({ isEnabled }, { eq }) => eq(isEnabled, true));
  } else {
    console.log(`Querying all enabled events`);
    query = EventEntity.query.EnabledIndex({ enabledStatus: 'enabled' });
  }

  const events = await query.go();

  return { events: events.data };
};

export const handler: APIGatewayProxyHandlerV2 =
  withMiddleware(getEventsHandler);
