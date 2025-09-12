import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { withMiddleware } from '../middleware';
import { EventEntity } from './model';
import { executeWithPagination } from '../utils/pagination';
import { PaginationQueryParams } from './types';

interface EventQueryParams extends PaginationQueryParams {
  type?: string;
  difficulty?: string;
}

const getEventsHandler = async (event: APIGatewayProxyEventV2) => {
  const queryParams: EventQueryParams = event.queryStringParameters ?? {};
  const { type, difficulty, limit, nextToken } = queryParams;

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

  const result = await executeWithPagination(query, {
    limit: limit ? parseInt(limit, 10) : undefined,
    nextToken,
    defaultLimit: 20,
  });

  return {
    events: result.data,
    pagination: result.pagination,
  };
};

export const handler: APIGatewayProxyHandlerV2 =
  withMiddleware(getEventsHandler);
