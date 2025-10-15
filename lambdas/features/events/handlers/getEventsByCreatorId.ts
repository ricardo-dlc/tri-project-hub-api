import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import type { AuthenticatedEvent } from '@/shared';
import { withAuth, withMiddleware } from '@/shared';
import { createFeatureLogger } from '@/shared/logger';
import { executeWithPagination } from '@/shared/utils/pagination';
import { EventEntity } from '../models/event.model';
import { PaginationQueryParams } from '@/features/events/types/event.types';

const logger = createFeatureLogger('events');

const getEventsByCreatorIdHandler = async (event: AuthenticatedEvent) => {
  // Get the creator ID from the authenticated user
  const creatorId = event.user.id;

  logger.debug({ creatorId, role: event.user.role }, 'Fetching events by creator');

  const queryParams: PaginationQueryParams = event.queryStringParameters ?? {};
  const { limit, nextToken } = queryParams;

  const query = EventEntity.query
    .CreatorIndex({ creatorId })
  // .where(({ isEnabled }, { eq }) => eq(isEnabled, true))

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

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(getEventsByCreatorIdHandler, {
    requiredRoles: ['organizer', 'admin'],
  })
);
