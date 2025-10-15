import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { createFeatureLogger } from '@/shared/logger';
import { executeWithPagination } from '@/shared/utils/pagination';
import { withMiddleware } from '@/shared/wrapper';
import { EventEntity } from '../models/event.model';
import { PaginationQueryParams } from '@/features/events/types/event.types';

const logger = createFeatureLogger('events');

const getFeaturedEventsHandler = async (event: APIGatewayProxyEventV2) => {
  const queryParams: PaginationQueryParams = event.queryStringParameters ?? {};
  const { limit, nextToken } = queryParams;

  logger.debug({ limit, nextToken }, 'Fetching featured events');

  const query = EventEntity.query
    .FeaturedIndex({
      featuredStatus: 'featured',
    })
    .where(({ isEnabled }, { eq }) => eq(isEnabled, true));

  const result = await executeWithPagination(query, {
    limit: limit ? parseInt(limit, 10) : undefined,
    nextToken,
    defaultLimit: 10, // Smaller default for featured events
  });

  return {
    events: result.data,
    pagination: result.pagination,
  };
};

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  getFeaturedEventsHandler
);
