import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { createFeatureLogger } from '@/shared/logger';
import { executeWithPagination } from '@/shared/utils/pagination';
import { withMiddleware } from '@/shared/wrapper';
import { EventEntity } from '../models/event.model';
import { OrganizerEntity } from '../models/organizer.model';
import { EventItem, PaginationQueryParams } from '@/features/events/types/event.types';

const logger = createFeatureLogger('events');

interface EventQueryParams extends PaginationQueryParams {
  type?: string;
  difficulty?: string;
}

const getEventsHandler = async (event: APIGatewayProxyEventV2) => {
  const queryParams: EventQueryParams = event.queryStringParameters ?? {};
  const { type, difficulty, limit, nextToken } = queryParams;

  let query;
  // Determine query priority: type > difficulty > default
  if (type) {
    logger.debug({ type }, 'Querying events by type');
    query = EventEntity.query
      .TypeIndex({
        type,
      })
      .where(({ isEnabled }, { eq }) => eq(isEnabled, true));
  } else if (difficulty) {
    logger.debug({ difficulty }, 'Querying events by difficulty');
    query = EventEntity.query
      .DifficultyIndex({
        difficulty,
      })
      .where(({ isEnabled }, { eq }) => eq(isEnabled, true));
  } else {
    logger.debug('Querying all enabled events');
    query = EventEntity.query.EnabledIndex({ enabledStatus: 'enabled' });
  }

  const result = await executeWithPagination<EventItem>(query, {
    limit: limit ? parseInt(limit, 10) : undefined,
    nextToken,
    defaultLimit: 20,
  });

  // Get unique organizer IDs
  const organizerIds = [...new Set(result.data.map(e => e.organizerId))];

  // Batch fetch organizers
  const organizerMap = new Map();
  await Promise.all(
    organizerIds.map(async (organizerId) => {
      try {
        const organizer = await OrganizerEntity.get({ organizerId }).go();
        if (organizer.data) {
          organizerMap.set(organizerId, organizer.data);
        }
      } catch (error) {
        logger.warn({ organizerId, error }, 'Failed to fetch organizer');
      }
    })
  );

  // Enrich events with organizer data
  const eventsWithOrganizers = result.data.map(event => ({
    ...event,
    organizer: organizerMap.get(event.organizerId) || null,
  }));

  return {
    events: eventsWithOrganizers,
    pagination: result.pagination,
  };
};

export const handler: APIGatewayProxyHandlerV2 =
  withMiddleware(getEventsHandler);
