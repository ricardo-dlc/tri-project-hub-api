import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { BadRequestError, NotFoundError } from '../../../shared/errors';
import { executeWithPagination } from '../../../shared/utils/pagination';
import { withMiddleware } from '../../../shared/wrapper';
import { EventEntity } from '../models/event.model';
import { PaginationQueryParams } from '../types/event.types';



const getEventsByCreatorIdHandler = async (event: APIGatewayProxyEventV2) => {
  const { creatorId } = event.pathParameters ?? {};

  if (!creatorId) {
    throw new BadRequestError('Missing creatorId parameter');
  }

  console.log('creatorId', creatorId);

  const queryParams: PaginationQueryParams = event.queryStringParameters ?? {};
  const { limit, nextToken } = queryParams;

  const query = EventEntity.query
    .CreatorIndex({ creatorId })
  // .where(({ isEnabled }, { eq }) => eq(isEnabled, true))

  console.log('query', query.params());

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
  withMiddleware(getEventsByCreatorIdHandler);
