import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withMiddleware } from '../lambdas/middleware/wrapper';
import {
  NotFoundError,
  BadRequestError,
  ValidationError,
  NotAuthorizedError,
  ForbiddenError,
  ConflictError,
} from '../lambdas/middleware/errors';
import { MiddlewareOptions } from '../lambdas/middleware/types';

// Mock DynamoDB client
const mockSend = jest.fn();
jest.mock('../lambdas/utils/dynamo', () => ({
  ddbDocClient: {
    send: mockSend,
  },
}));

import { ddbDocClient } from '../lambdas/utils/dynamo';

// Type for API Gateway v2 response
interface APIGatewayProxyResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

// Helper to call wrapped handler and cast result
const callWrappedHandler = async (
  wrappedHandler: any,
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  return await wrappedHandler(event, context);
};

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
  console.log = jest.fn();
  jest.clearAllMocks();
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

// Helper function to create mock API Gateway event using ES6+ features
const createMockEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 => ({
  version: '2.0',
  routeKey: 'GET /events',
  rawPath: '/events',
  rawQueryString: '',
  headers: {},
  pathParameters: undefined,
  queryStringParameters: undefined,
  requestContext: {
    accountId: '123456789',
    apiId: 'test-api',
    domainName: 'test.example.com',
    domainPrefix: 'test',
    http: {
      method: 'GET',
      path: '/events',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'GET /events',
    stage: 'test',
    time: '01/Jan/2023:00:00:00 +0000',
    timeEpoch: 1672531200000,
  },
  isBase64Encoded: false,
  ...overrides,
});

// Helper function to create mock Lambda context using ES6+ features
const createMockContext = (overrides: Partial<Context> = {}): Context => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn:
    'arn:aws:lambda:us-east-1:123456789:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-aws-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2023/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
  ...overrides,
});

describe('Middleware Integration Tests', () => {
  // Set up environment variables
  beforeAll(() => {
    process.env.EVENTS_TABLE_NAME = 'test-events-table';
  });

  describe('getEvents handler integration', () => {
    it('should successfully return events using middleware wrapper', async () => {
      // Mock successful DynamoDB response
      const mockEvents = [
        { id: '1', title: 'Event 1', slug: 'event-1' },
        { id: '2', title: 'Event 2', slug: 'event-2' },
      ];

      mockSend.mockResolvedValueOnce({
        Items: mockEvents,
        Count: 2,
        ScannedCount: 2,
      });

      // Create middleware-wrapped version of getEvents handler
      const getEventsHandler = withMiddleware(async () => {
        const command = new QueryCommand({
          TableName: process.env.EVENTS_TABLE_NAME,
          IndexName: 'EnabledIndex',
          KeyConditionExpression: 'enabledStatus = :enabledStatus',
          ExpressionAttributeValues: { ':enabledStatus': 'true' },
        });
        const response = await ddbDocClient.send(command);
        return { events: response.Items };
      });

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      // Verify API Gateway v2 compatibility
      expect(result.statusCode).toBe(200);
      expect(result.headers!['Content-Type']).toBe('application/json');

      // Verify standardized response format
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: true,
        data: { events: mockEvents },
      });

      // Verify DynamoDB was called correctly
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'test-events-table',
            IndexName: 'EnabledIndex',
            KeyConditionExpression: 'enabledStatus = :enabledStatus',
            ExpressionAttributeValues: { ':enabledStatus': 'true' },
          }),
        })
      );
    });

    it('should handle DynamoDB errors in getEvents handler', async () => {
      // Mock DynamoDB error
      mockSend.mockRejectedValueOnce(
        new Error('DynamoDB connection failed')
      );

      const getEventsHandler = withMiddleware(
        async () => {
          const command = new QueryCommand({
            TableName: process.env.EVENTS_TABLE_NAME,
            IndexName: 'EnabledIndex',
            KeyConditionExpression: 'enabledStatus = :enabledStatus',
            ExpressionAttributeValues: { ':enabledStatus': 'true' },
          });
          const response = await ddbDocClient.send(command);
          return { events: response.Items };
        },
        { errorLogging: false }
      );

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      // Verify error handling
      expect(result.statusCode).toBe(500);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error).toBeDefined();
    });

    it('should handle empty results in getEvents handler', async () => {
      // Mock empty DynamoDB response
      mockSend.mockResolvedValueOnce({
        Items: [],
        Count: 0,
        ScannedCount: 0,
      });

      const getEventsHandler = withMiddleware(async () => {
        const command = new QueryCommand({
          TableName: process.env.EVENTS_TABLE_NAME,
          IndexName: 'EnabledIndex',
          KeyConditionExpression: 'enabledStatus = :enabledStatus',
          ExpressionAttributeValues: { ':enabledStatus': 'true' },
        });
        const response = await ddbDocClient.send(command);
        return { events: response.Items };
      });

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: true,
        data: { events: [] },
      });
    });
  });

  describe('getEventBySlug handler integration', () => {
    it('should successfully return event by slug using middleware wrapper', async () => {
      const mockEvent = { id: '1', title: 'Test Event', slug: 'test-event' };

      mockSend.mockResolvedValueOnce({
        Items: [mockEvent],
        Count: 1,
        ScannedCount: 1,
      });

      // Create middleware-wrapped version of getEventBySlug handler
      const getEventBySlugHandler = withMiddleware(
        async (event: APIGatewayProxyEventV2) => {
          if (!event.pathParameters?.slug) {
            throw new BadRequestError('Missing slug parameter');
          }

          const { slug } = event.pathParameters;
          const command = new QueryCommand({
            TableName: process.env.EVENTS_TABLE_NAME,
            IndexName: 'SlugIndex',
            KeyConditionExpression: 'slug = :slug',
            ExpressionAttributeValues: { ':slug': slug },
          });

          const response = await ddbDocClient.send(command);

          if (!response.Items || response.Items.length === 0) {
            throw new NotFoundError('Event not found');
          }

          return { event: response.Items[0] };
        }
      );

      const event = createMockEvent({
        routeKey: 'GET /events/{slug}',
        rawPath: '/events/test-event',
        pathParameters: { slug: 'test-event' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(
        getEventBySlugHandler,
        event,
        context
      );

      // Verify API Gateway v2 compatibility
      expect(result.statusCode).toBe(200);
      expect(result.headers!['Content-Type']).toBe('application/json');

      // Verify standardized response format
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: true,
        data: { event: mockEvent },
      });

      // Verify DynamoDB was called correctly
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'test-events-table',
            IndexName: 'SlugIndex',
            KeyConditionExpression: 'slug = :slug',
            ExpressionAttributeValues: { ':slug': 'test-event' },
          }),
        })
      );
    });

    it('should handle missing slug parameter with BadRequestError', async () => {
      const getEventBySlugHandler = withMiddleware(
        async (event: APIGatewayProxyEventV2) => {
          if (!event.pathParameters?.slug) {
            throw new BadRequestError('Missing slug parameter');
          }

          const { slug } = event.pathParameters;
          const command = new QueryCommand({
            TableName: process.env.EVENTS_TABLE_NAME,
            IndexName: 'SlugIndex',
            KeyConditionExpression: 'slug = :slug',
            ExpressionAttributeValues: { ':slug': slug },
          });

          const response = await ddbDocClient.send(command);

          if (!response.Items || response.Items.length === 0) {
            throw new NotFoundError('Event not found');
          }

          return { event: response.Items[0] };
        },
        { errorLogging: false }
      );

      const event = createMockEvent({
        routeKey: 'GET /events/{slug}',
        rawPath: '/events/',
        pathParameters: undefined, // Missing path parameters
      });
      const context = createMockContext();

      const result = await callWrappedHandler(
        getEventBySlugHandler,
        event,
        context
      );

      // Verify BadRequestError handling
      expect(result.statusCode).toBe(400);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: false,
        error: {
          message: 'Missing slug parameter',
          code: 'BAD_REQUEST',
        },
        data: null,
      });
    });

    it('should handle event not found with NotFoundError', async () => {
      // Mock empty DynamoDB response
      mockSend.mockResolvedValueOnce({
        Items: [],
        Count: 0,
        ScannedCount: 0,
      });

      const getEventBySlugHandler = withMiddleware(
        async (event: APIGatewayProxyEventV2) => {
          if (!event.pathParameters?.slug) {
            throw new BadRequestError('Missing slug parameter');
          }

          const { slug } = event.pathParameters;
          const command = new QueryCommand({
            TableName: process.env.EVENTS_TABLE_NAME,
            IndexName: 'SlugIndex',
            KeyConditionExpression: 'slug = :slug',
            ExpressionAttributeValues: { ':slug': slug },
          });

          const response = await ddbDocClient.send(command);

          if (!response.Items || response.Items.length === 0) {
            throw new NotFoundError('Event not found');
          }

          return { event: response.Items[0] };
        },
        { errorLogging: false }
      );

      const event = createMockEvent({
        routeKey: 'GET /events/{slug}',
        rawPath: '/events/nonexistent',
        pathParameters: { slug: 'nonexistent' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(
        getEventBySlugHandler,
        event,
        context
      );

      // Verify NotFoundError handling
      expect(result.statusCode).toBe(404);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: false,
        error: {
          message: 'Event not found',
          code: 'NOT_FOUND',
        },
        data: null,
      });
    });

    it('should handle DynamoDB errors in getEventBySlug handler', async () => {
      // Mock DynamoDB error
      mockSend.mockRejectedValueOnce(
        new Error('DynamoDB connection failed')
      );

      const getEventBySlugHandler = withMiddleware(
        async (event: APIGatewayProxyEventV2) => {
          if (!event.pathParameters?.slug) {
            throw new BadRequestError('Missing slug parameter');
          }

          const { slug } = event.pathParameters;
          const command = new QueryCommand({
            TableName: process.env.EVENTS_TABLE_NAME,
            IndexName: 'SlugIndex',
            KeyConditionExpression: 'slug = :slug',
            ExpressionAttributeValues: { ':slug': slug },
          });

          const response = await ddbDocClient.send(command);

          if (!response.Items || response.Items.length === 0) {
            throw new NotFoundError('Event not found');
          }

          return { event: response.Items[0] };
        },
        { errorLogging: false }
      );

      const event = createMockEvent({
        routeKey: 'GET /events/{slug}',
        rawPath: '/events/test-event',
        pathParameters: { slug: 'test-event' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(
        getEventBySlugHandler,
        event,
        context
      );

      // Verify error handling
      expect(result.statusCode).toBe(500);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error).toBeDefined();
    });
  });

  describe('predefined error types integration', () => {
    it('should handle NotAuthorizedError (401)', async () => {
      const handler = withMiddleware(
        async () => {
          throw new NotAuthorizedError('Authentication required', {
            authMethod: 'Bearer token',
          });
        },
        { errorLogging: false }
      );

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(handler, event, context);

      expect(result.statusCode).toBe(401);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
          details: { authMethod: 'Bearer token' },
        },
        data: null,
      });
    });

    it('should handle ForbiddenError (403)', async () => {
      const handler = withMiddleware(
        async () => {
          throw new ForbiddenError('Insufficient permissions', {
            requiredRole: 'admin',
            userRole: 'user',
          });
        },
        { errorLogging: false }
      );

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(handler, event, context);

      expect(result.statusCode).toBe(403);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: false,
        error: {
          message: 'Insufficient permissions',
          code: 'FORBIDDEN',
          details: { requiredRole: 'admin', userRole: 'user' },
        },
        data: null,
      });
    });

    it('should handle ValidationError (422)', async () => {
      const handler = withMiddleware(
        async () => {
          throw new ValidationError('Invalid input data', {
            field: 'email',
            value: 'invalid-email',
            expected: 'valid email format',
          });
        },
        { errorLogging: false }
      );

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(handler, event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: false,
        error: {
          message: 'Invalid input data',
          code: 'VALIDATION_ERROR',
          details: {
            field: 'email',
            value: 'invalid-email',
            expected: 'valid email format',
          },
        },
        data: null,
      });
    });

    it('should handle ConflictError (409)', async () => {
      const handler = withMiddleware(
        async () => {
          throw new ConflictError('Resource already exists', {
            resourceType: 'event',
            conflictingField: 'slug',
            value: 'existing-slug',
          });
        },
        { errorLogging: false }
      );

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(handler, event, context);

      expect(result.statusCode).toBe(409);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: false,
        error: {
          message: 'Resource already exists',
          code: 'CONFLICT',
          details: {
            resourceType: 'event',
            conflictingField: 'slug',
            value: 'existing-slug',
          },
        },
        data: null,
      });
    });
  });

  describe('API Gateway v2 compatibility', () => {
    it('should return proper API Gateway v2 response structure', async () => {
      const handler = withMiddleware(async () => ({
        message: 'API Gateway v2 test',
        timestamp: new Date().toISOString(),
      }));

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(handler, event, context);

      // Verify API Gateway v2 response structure
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('body');
      expect(typeof result.statusCode).toBe('number');
      expect(typeof result.headers).toBe('object');
      expect(typeof result.body).toBe('string');

      // Verify headers
      expect(result.headers!['Content-Type']).toBe('application/json');

      // Verify body is valid JSON
      expect(() => JSON.parse(result.body)).not.toThrow();
    });

    it('should handle CORS headers for API Gateway v2', async () => {
      const handler = withMiddleware(
        async () => ({ message: 'CORS test' }),
        {
          cors: {
            origin: 'https://example.com',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
            credentials: true,
          },
        }
      );

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(handler, event, context);

      // Verify CORS headers are properly set
      expect(result.headers!['Access-Control-Allow-Origin']).toBe(
        'https://example.com'
      );
      expect(result.headers!['Access-Control-Allow-Methods']).toBe(
        'GET, POST, PUT, DELETE'
      );
      expect(result.headers!['Access-Control-Allow-Headers']).toBe(
        'Content-Type, Authorization, X-Requested-With'
      );
      expect(result.headers!['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should handle different HTTP methods in request context', async () => {
      const handler = withMiddleware(
        async (event: APIGatewayProxyEventV2) => ({
          method: event.requestContext.http.method,
          path: event.rawPath,
          routeKey: event.routeKey,
        })
      );

      const event = createMockEvent({
        routeKey: 'POST /events',
        rawPath: '/events',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: 'POST',
            path: '/events',
          },
        },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(handler, event, context);

      expect(result.statusCode).toBe(200);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.data).toEqual({
        method: 'POST',
        path: '/events',
        routeKey: 'POST /events',
      });
    });
  });

  describe('response format compliance', () => {
    it('should maintain consistent success response format across handlers', async () => {
      const handlers = [
        withMiddleware(async () => ({ type: 'string', value: 'test' })),
        withMiddleware(async () => ({ type: 'number', value: 42 })),
        withMiddleware(async () => ({ type: 'array', value: [1, 2, 3] })),
        withMiddleware(async () => ({ type: 'object', value: { nested: true } })),
        withMiddleware(async () => null),
        withMiddleware(async () => ({ type: 'undefined', value: undefined })),
      ];

      const event = createMockEvent();
      const context = createMockContext();

      for (const handler of handlers) {
        const result = await callWrappedHandler(handler, event, context);
        const parsedBody = JSON.parse(result.body);

        // Verify consistent success response structure
        expect(parsedBody).toHaveProperty('success', true);
        expect(parsedBody).toHaveProperty('data');
        expect(parsedBody).not.toHaveProperty('error');
      }
    });

    it('should maintain consistent error response format across error types', async () => {
      const errorHandlers = [
        withMiddleware(
          async () => {
            throw new NotFoundError('Not found');
          },
          { errorLogging: false }
        ),
        withMiddleware(
          async () => {
            throw new BadRequestError('Bad request');
          },
          { errorLogging: false }
        ),
        withMiddleware(
          async () => {
            throw new ValidationError('Validation failed');
          },
          { errorLogging: false }
        ),
        withMiddleware(
          async () => {
            throw new Error('Generic error');
          },
          { errorLogging: false }
        ),
      ];

      const event = createMockEvent();
      const context = createMockContext();

      for (const handler of errorHandlers) {
        const result = await callWrappedHandler(handler, event, context);
        const parsedBody = JSON.parse(result.body);

        // Verify consistent error response structure
        expect(parsedBody).toHaveProperty('success', false);
        expect(parsedBody).toHaveProperty('error');
        expect(parsedBody.error).toHaveProperty('message');
        expect(parsedBody).toHaveProperty('data', null);
        expect(typeof parsedBody.error.message).toBe('string');
      }
    });
  });

  describe('real-world integration scenarios', () => {
    it('should handle complex event creation workflow', async () => {
      const createEventHandler = withMiddleware(
        async (event: APIGatewayProxyEventV2) => {
          // Simulate request body parsing
          const body = event.body ? JSON.parse(event.body) : {};

          // Validate required fields
          if (!body.title) {
            throw new ValidationError('Title is required', {
              field: 'title',
              received: body.title,
            });
          }

          if (!body.slug) {
            throw new ValidationError('Slug is required', {
              field: 'slug',
              received: body.slug,
            });
          }

          // Check for existing event with same slug
          const existingCommand = new QueryCommand({
            TableName: process.env.EVENTS_TABLE_NAME,
            IndexName: 'SlugIndex',
            KeyConditionExpression: 'slug = :slug',
            ExpressionAttributeValues: { ':slug': body.slug },
          });

          const existingResponse = await ddbDocClient.send(existingCommand);

          if (existingResponse.Items && existingResponse.Items.length > 0) {
            throw new ConflictError('Event with this slug already exists', {
              slug: body.slug,
              existingEventId: existingResponse.Items[0].id,
            });
          }

          // Simulate event creation
          const newEvent = {
            id: `event-${Date.now()}`,
            title: body.title,
            slug: body.slug,
            createdAt: new Date().toISOString(),
          };

          return {
            data: newEvent,
            statusCode: 201,
          };
        }
      );

      // Test successful creation
      mockSend.mockResolvedValueOnce({
        Items: [],
        Count: 0,
        ScannedCount: 0,
      });

      const event = createMockEvent({
        routeKey: 'POST /events',
        rawPath: '/events',
        body: JSON.stringify({
          title: 'New Event',
          slug: 'new-event',
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: 'POST',
          },
        },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(createEventHandler, event, context);

      expect(result.statusCode).toBe(201);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(true);
      expect(parsedBody.data).toMatchObject({
        title: 'New Event',
        slug: 'new-event',
      });
    });

    it('should handle authentication and authorization workflow', async () => {
      const protectedHandler = withMiddleware(
        async (event: APIGatewayProxyEventV2) => {
          // Simulate authentication check
          const authHeader = event.headers?.authorization;
          if (!authHeader) {
            throw new NotAuthorizedError('Authorization header required');
          }

          if (!authHeader.startsWith('Bearer ')) {
            throw new NotAuthorizedError('Invalid authorization format', {
              expected: 'Bearer token',
              received: authHeader.split(' ')[0],
            });
          }

          const token = authHeader.substring(7);
          if (token !== 'valid-token') {
            throw new NotAuthorizedError('Invalid token');
          }

          // Simulate authorization check
          const userRole: string = 'user'; // Would normally decode from token
          const requiredRole = 'admin';
          if (userRole !== requiredRole) {
            throw new ForbiddenError('Admin access required', {
              userRole,
              requiredRole,
            });
          }

          return { message: 'Access granted', userRole };
        },
        { errorLogging: false }
      );

      // Test missing authorization
      let event = createMockEvent();
      let context = createMockContext();
      let result = await callWrappedHandler(protectedHandler, event, context);

      expect(result.statusCode).toBe(401);
      let parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Authorization header required');

      // Test invalid format
      event = createMockEvent({
        headers: { authorization: 'Basic invalid' },
      });
      result = await callWrappedHandler(protectedHandler, event, context);

      expect(result.statusCode).toBe(401);
      parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Invalid authorization format');

      // Test invalid token
      event = createMockEvent({
        headers: { authorization: 'Bearer invalid-token' },
      });
      result = await callWrappedHandler(protectedHandler, event, context);

      expect(result.statusCode).toBe(401);
      parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Invalid token');
    });
  });
});