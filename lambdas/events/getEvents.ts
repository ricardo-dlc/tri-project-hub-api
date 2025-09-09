import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { withMiddleware } from '../middleware';
import { ddbDocClient } from '../utils/dynamo';

// Refactored handler using arrow function and async/await syntax
const getEventsHandler = async () => {
  const command = new QueryCommand({
    TableName: process.env.EVENTS_TABLE_NAME,
    IndexName: 'EnabledIndex',
    KeyConditionExpression: 'enabledStatus = :enabledStatus',
    ExpressionAttributeValues: { ':enabledStatus': 'true' },
  });

  const response = await ddbDocClient.send(command);
  console.log(response);

  // Return plain object using object shorthand syntax
  return {
    events: response.Items,
  };
};

// Export wrapped handler
export const handler: APIGatewayProxyHandlerV2 =
  withMiddleware(getEventsHandler);
