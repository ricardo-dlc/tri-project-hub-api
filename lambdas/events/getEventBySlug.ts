import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ddbDocClient } from '../utils/dynamo';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!event.pathParameters || !event.pathParameters.slug) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing slug parameter' }),
    };
  }
  try {
    const { slug } = event.pathParameters;
    const command = new QueryCommand({
      TableName: process.env.EVENTS_TABLE_NAME,
      IndexName: 'SlugIndex',
      KeyConditionExpression: 'slug = :slug',
      ExpressionAttributeValues: { ':slug': slug },
    });
    const response = await ddbDocClient.send(command);
    console.log(response);
    if (!response.Items || response.Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'Event not found',
        }),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        event: response.Items[0],
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
