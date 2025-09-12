import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { withMiddleware } from '../middleware';
import { EventEntity } from './model';

interface EventQueryParams {
  type?: string;
  difficulty?: string;
  limit?: string;
  nextToken?: string;
}

const getEventsHandler = async (event: APIGatewayProxyEventV2) => {
  const queryParams: EventQueryParams = event.queryStringParameters ?? {};
  const { type, difficulty, limit, nextToken } = queryParams;

  const pageLimit = limit ? parseInt(limit, 10) : 20; // default 20 items

  console.log(`Query parameters:`, queryParams);
  let query;
  // Determine query priority: type > difficulty > default
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

  // Fetch one extra item to check if there's a next page
  const events = await query.go({
    limit: pageLimit + 1,
    ...(nextToken ? { cursor: nextToken } : {}),
  });

  // Check if we got more items than requested
  const hasNextPage = events.data.length > pageLimit;
  const itemsToReturn = hasNextPage
    ? events.data.slice(0, pageLimit)
    : events.data;

  return {
    events: itemsToReturn,
    pagination: {
      hasNextPage,
      nextToken: hasNextPage ? events.cursor : null,
      limit: pageLimit,
      count: itemsToReturn.length,
    },
  };
};

export const handler: APIGatewayProxyHandlerV2 =
  withMiddleware(getEventsHandler);
