import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { withMiddleware } from '../middleware';
import { ddbDocClient } from '../utils/dynamo';
import { EventItem } from './types';

interface EventQueryParams {
  type?: string;
  difficulty?: string;
  isFeatured?: string;
}

interface QueryConfig {
  indexName: string;
  keyConditionExpression: string;
  expressionAttributeValues: Record<string, string>;
}

interface EventsResponse {
  events: any[] | undefined;
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

const createQueryConfig = (
  paramType: 'type' | 'difficulty' | 'isFeatured',
  value: string | boolean
): QueryConfig => {
  const configs = {
    isFeatured: {
      indexName: 'FeaturedIndex',
      keyConditionExpression: 'isFeaturedEnabled = :isFeaturedEnabled',
      expressionAttributeValues: { ':isFeaturedEnabled': `${value}#true` },
    },
    type: {
      indexName: 'TypeIndex',
      keyConditionExpression: 'typeEnabled = :typeEnabled',
      expressionAttributeValues: { ':typeEnabled': `${value}#true` },
    },
    difficulty: {
      indexName: 'DifficultyIndex',
      keyConditionExpression: 'difficultyEnabled = :difficultyEnabled',
      expressionAttributeValues: { ':difficultyEnabled': `${value}#true` },
    },
  };

  return configs[paramType];
};

const getDefaultQueryConfig = (): QueryConfig => ({
  indexName: 'EnabledIndex',
  keyConditionExpression: 'enabledStatus = :enabledStatus',
  expressionAttributeValues: { ':enabledStatus': 'true' },
});

const executeQuery = async (config: QueryConfig): Promise<EventItem[]> => {
  const command = new QueryCommand({
    TableName: process.env.EVENTS_TABLE_NAME,
    IndexName: config.indexName,
    KeyConditionExpression: config.keyConditionExpression,
    ExpressionAttributeValues: config.expressionAttributeValues,
  });

  try {
    const response = await ddbDocClient.send(command);
    console.log(`Query executed for ${config.indexName}:`, {
      itemCount: response.Items?.length || 0,
      consumedCapacity: response.ConsumedCapacity,
    });

    return (response.Items as EventItem[]) || [];
  } catch (error) {
    console.error(`Error querying ${config.indexName}:`, error);
    throw error;
  }
};

const getEventsHandler = async (
  event: APIGatewayProxyEventV2
): Promise<EventsResponse> => {
  const queryParams: EventQueryParams = event.queryStringParameters ?? {};
  const { type, difficulty, isFeatured } = queryParams;

  let queryConfig: QueryConfig;

  // Determine query priority: isFeatured > type > difficulty > default
  if (isFeatured) {
    const isFeaturedBoolean = parseBooleanParam(isFeatured);
    console.log(`Querying featured events: ${isFeaturedBoolean}`);
    queryConfig = createQueryConfig('isFeatured', isFeaturedBoolean);
  } else if (type) {
    console.log(`Querying events by type: ${type}`);
    queryConfig = createQueryConfig('type', type);
  } else if (difficulty) {
    console.log(`Querying events by difficulty: ${difficulty}`);
    queryConfig = createQueryConfig('difficulty', difficulty);
  } else {
    console.log('Querying all enabled events');
    queryConfig = getDefaultQueryConfig();
  }

  const events = await executeQuery(queryConfig);

  return { events };
};

export const handler: APIGatewayProxyHandlerV2 =
  withMiddleware(getEventsHandler);
