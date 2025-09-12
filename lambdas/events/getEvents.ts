import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { withMiddleware } from '../middleware';
import { EventEntity } from './model';

interface EventQueryParams {
  type?: string;
  difficulty?: string;
  isFeatured?: string;
}

const parseBooleanParam = (value: string | undefined): boolean => {
  if (!value) return false;

  const lowerValue = value.toLowerCase().trim();

  // Handle explicit boolean strings
  if (lowerValue === 'true') return true;
  if (lowerValue === 'false') return false;

  // Handle numeric strings
  if (lowerValue === '1') return true;
  if (lowerValue === '0') return false;

  // If parameter exists but has no value, treat as true
  return true;
};

const getEventsHandler = async (event: APIGatewayProxyEventV2) => {
  const queryParams: EventQueryParams = event.queryStringParameters ?? {};
  const { type, difficulty, isFeatured } = queryParams;

  console.log(`Query parameters:`, queryParams);
  let query;
  // Determine query priority: isFeatured > type > difficulty > default
  if (isFeatured !== undefined) {
    const isFeaturedBoolean = parseBooleanParam(isFeatured);
    console.log(`Querying featured events`);
    query = EventEntity.query
      .FeaturedIndex({
        featuredStatus: 'featured',
      })
      .where(({ isEnabled }, { eq }) => eq(isEnabled, true));
  } else if (type) {
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
