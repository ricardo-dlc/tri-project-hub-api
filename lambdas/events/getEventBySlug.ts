import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { BadRequestError, NotFoundError, withMiddleware } from '../middleware';
import { ddbDocClient } from '../utils/dynamo';

// Refactored handler using arrow function, async/await, and destructuring
const getEventBySlugHandler = async (event: APIGatewayProxyEventV2) => {
  // Use optional chaining for parameter validation and destructuring
  const { slug } = event.pathParameters ?? {};

  if (!slug) {
    throw new BadRequestError('Missing slug parameter');
  }

  const command = new QueryCommand({
    TableName: process.env.EVENTS_TABLE_NAME,
    IndexName: 'SlugIndex',
    KeyConditionExpression: 'slug = :slug',
    ExpressionAttributeValues: { ':slug': slug },
  });

  const response = await ddbDocClient.send(command);
  console.log(response);

  // Use optional chaining and throw semantic error
  if (!response.Items?.length) {
    throw new NotFoundError('Event not found');
  }

  // Return plain object using object shorthand syntax
  return {
    event: response.Items[0],
  };
};

// Export wrapped handler
export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  getEventBySlugHandler
);
