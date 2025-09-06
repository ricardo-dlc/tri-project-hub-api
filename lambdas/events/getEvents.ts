import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ddbDocClient } from '../utils/dynamo';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const command = new QueryCommand({
      TableName: process.env.EVENTS_TABLE_NAME,
      IndexName: 'EnabledIndex',
      KeyConditionExpression: 'enabledStatus = :enabledStatus',
      ExpressionAttributeValues: { ':enabledStatus': 'true' },
    });
    const response = await ddbDocClient.send(command);
    console.log(response);
    return {
      statusCode: 200,
      body: JSON.stringify({
        events: response.Items,
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
      }),
    };
  }
};
