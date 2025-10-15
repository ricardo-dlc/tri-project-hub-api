// Mock environment variables FIRST
process.env.EVENTS_TABLE_NAME = 'test-events-table';

import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { EventEntity } from '@/features/events/models/event.model';
import { handler as getEventsByCreatorIdHandler } from '../getEventsByCreatorId';

// Mock the EventEntity
jest.mock('../../models/event.model');
const mockEventEntity = EventEntity as jest.Mocked<typeof EventEntity>;

// Mock the shared middleware and auth
jest.mock('../../../../shared', () => ({
  withMiddleware: (handlerFn: any) => async (event: any, context: any) => {
    try {
      const result = await handlerFn(event, context);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: result,
        }),
      };
    } catch (error: any) {
      let statusCode = 400;
      let errorCode = 'BAD_REQUEST';

      if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
      } else if (error.name === 'ForbiddenError') {
        statusCode = 403;
        errorCode = 'FORBIDDEN';
      }

      return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            message: error.message,
            code: errorCode,
          },
          data: null,
        }),
      };
    }
  },
  withAuth: (handlerFn: any, options: any) => async (event: any, context: any) => {
    // Mock authentication - add user to event
    const authenticatedEvent = {
      ...event,
      user: event.testUser || {
        id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        role: 'organizer',
        email: 'test@example.com',
      },
    };
    return handlerFn(authenticatedEvent, context);
  },
}));

// Mock the pagination utility
jest.mock('@/shared/utils/pagination', () => ({
  executeWithPagination: jest.fn(),
}));

// Mock the logger
jest.mock('@/shared/logger', () => ({
  createFeatureLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import { executeWithPagination } from '@/shared/utils/pagination';
const mockExecuteWithPagination = executeWithPagination as jest.MockedFunction<typeof executeWithPagination>;

// Type for API Gateway v2 response
interface APIGatewayProxyResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

// Helper to call wrapped handler and cast result
const callWrappedHandler = async (
  handler: any,
  event: any,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  const result = await handler(event, context);
  return result;
};

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
  console.log = jest.fn();
  console.debug = jest.fn();
  jest.clearAllMocks();
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

// Helper function to create mock API Gateway event
const createMockEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {},
  testUser?: any
): any => ({
  version: '2.0',
  routeKey: 'GET /events/creator',
  rawPath: '/events/creator',
  rawQueryString: '',
  headers: {
    'content-type': 'application/json',
    'authorization': 'Bearer mock-token',
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    domainName: 'test.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'test',
    http: {
      method: 'GET',
      path: '/events/creator',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'GET /events/creator',
    stage: 'test',
    time: '01/Jan/2024:00:00:00 +0000',
    timeEpoch: 1704067200000,
  },
  queryStringParameters: undefined,
  isBase64Encoded: false,
  testUser,
  ...overrides,
});

// Helper function to create mock context
const createMockContext = (): Context => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-aws-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2024/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
});

// Helper function to create mock event data
const createMockEventData = (overrides: any = {}) => ({
  eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
  organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  title: 'Test Marathon Event',
  slug: 'test-marathon-event',
  type: 'running',
  date: '2024-12-01T10:00:00Z',
  isFeatured: false,
  isTeamEvent: false,
  isRelay: false,
  requiredParticipants: 1,
  maxParticipants: 100,
  currentParticipants: 0,
  location: 'Central Park, New York',
  description: 'Annual marathon event in Central Park',
  distance: '42.2km',
  registrationFee: 50,
  registrationDeadline: '2024-11-25T23:59:59Z',
  image: 'https://example.com/marathon.jpg',
  difficulty: 'intermediate',
  tags: ['running', 'marathon', 'fitness'],
  isEnabled: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

// Helper function to create mock pagination result
const createMockPaginationResult = (events: any[], hasNextPage = false, nextToken: string | null = null) => ({
  data: events,
  pagination: {
    hasNextPage,
    nextToken,
    limit: 20,
    count: events.length,
  },
});

// Helper function to create mock user
const createMockUser = (overrides: any = {}) => ({
  id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
  role: 'organizer',
  email: 'test@example.com',
  ...overrides,
});

describe('getEventsByCreatorId Handler', () => {
  describe('Successful Event Retrieval', () => {
    it('should retrieve events created by the authenticated user', async () => {
      const mockUser = createMockUser();
      const mockEvents = [
        createMockEventData({
          eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          title: 'Marathon Event 1',
          creatorId: mockUser.id
        }),
        createMockEventData({
          eventId: '01BRZ3NDEKTSV4RRFFQ69G5FAV',
          title: 'Marathon Event 2',
          creatorId: mockUser.id
        }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      // Mock the query chain
      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual(mockEvents);
      expect(responseBody.data.pagination).toEqual({
        hasNextPage: false,
        nextToken: null,
        limit: 20,
        count: 2,
      });

      // Verify CreatorIndex was called with correct creatorId
      expect(mockEventEntity.query.CreatorIndex).toHaveBeenCalledWith({ creatorId: mockUser.id });

      // Verify executeWithPagination was called with correct parameters
      expect(mockExecuteWithPagination).toHaveBeenCalledWith(mockQuery, {
        limit: undefined,
        nextToken: undefined,
        defaultLimit: 20,
      });
    });

    it('should handle empty results when user has no events', async () => {
      const mockUser = createMockUser();
      const mockPaginationResult = createMockPaginationResult([]);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual([]);
      expect(responseBody.data.pagination.count).toBe(0);
      expect(responseBody.data.pagination.hasNextPage).toBe(false);

      // Verify CreatorIndex was called with correct creatorId
      expect(mockEventEntity.query.CreatorIndex).toHaveBeenCalledWith({ creatorId: mockUser.id });
    });

    it('should retrieve events for different user roles', async () => {
      const roles = ['organizer', 'admin'];

      for (const role of roles) {
        const mockUser = createMockUser({ role });
        const mockEvents = [
          createMockEventData({
            eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
            title: `${role} Event`,
            creatorId: mockUser.id
          }),
        ];

        const mockPaginationResult = createMockPaginationResult(mockEvents);
        mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

        const mockQuery = {
          CreatorIndex: jest.fn().mockReturnThis(),
        };
        mockEventEntity.query = mockQuery as any;

        const event = createMockEvent({}, mockUser);
        const context = createMockContext();

        const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

        expect(result.statusCode).toBe(200);

        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.events).toEqual(mockEvents);

        // Verify CreatorIndex was called with correct creatorId
        expect(mockEventEntity.query.CreatorIndex).toHaveBeenCalledWith({ creatorId: mockUser.id });

        // Clear mocks for next iteration
        jest.clearAllMocks();
      }
    });

    it('should retrieve events with different types and statuses', async () => {
      const mockUser = createMockUser();
      const mockEvents = [
        createMockEventData({
          eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          title: 'Running Event',
          type: 'running',
          creatorId: mockUser.id,
          isEnabled: true,
        }),
        createMockEventData({
          eventId: '01BRZ3NDEKTSV4RRFFQ69G5FAV',
          title: 'Cycling Event',
          type: 'cycling',
          creatorId: mockUser.id,
          isEnabled: true,
        }),
        createMockEventData({
          eventId: '01CRZ3NDEKTSV4RRFFQ69G5FAV',
          title: 'Disabled Event',
          type: 'swimming',
          creatorId: mockUser.id,
          isEnabled: false,
        }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual(mockEvents);
      expect(responseBody.data.events).toHaveLength(3);

      // Verify all event types are included (including disabled ones)
      const eventTypes = responseBody.data.events.map((e: any) => e.type);
      expect(eventTypes).toContain('running');
      expect(eventTypes).toContain('cycling');
      expect(eventTypes).toContain('swimming');
    });
  });

  describe('Pagination', () => {
    it('should handle custom limit parameter', async () => {
      const mockUser = createMockUser();
      const mockEvents = [
        createMockEventData({
          eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          creatorId: mockUser.id
        }),
        createMockEventData({
          eventId: '01BRZ3NDEKTSV4RRFFQ69G5FAV',
          creatorId: mockUser.id
        }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockPaginationResult.pagination.limit = 10;
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({
        queryStringParameters: { limit: '10' },
        rawQueryString: 'limit=10',
      }, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.pagination.limit).toBe(10);

      // Verify executeWithPagination was called with correct limit
      expect(mockExecuteWithPagination).toHaveBeenCalledWith(mockQuery, {
        limit: 10,
        nextToken: undefined,
        defaultLimit: 20,
      });
    });

    it('should handle nextToken parameter for pagination', async () => {
      const mockUser = createMockUser();
      const mockEvents = [
        createMockEventData({
          eventId: '01CRZ3NDEKTSV4RRFFQ69G5FAV',
          creatorId: mockUser.id
        }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const nextToken = 'eyJldmVudElkIjoiMDFBUloiLCJjcmVhdGVkQXQiOiIyMDI0LTAxLTAxVDAwOjAwOjAwLjAwMFoifQ==';

      const event = createMockEvent({
        queryStringParameters: { nextToken },
        rawQueryString: `nextToken=${nextToken}`,
      }, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);

      // Verify executeWithPagination was called with correct nextToken
      expect(mockExecuteWithPagination).toHaveBeenCalledWith(mockQuery, {
        limit: undefined,
        nextToken,
        defaultLimit: 20,
      });
    });

    it('should handle both limit and nextToken parameters', async () => {
      const mockUser = createMockUser();
      const mockEvents = [
        createMockEventData({
          eventId: '01ERZ3NDEKTSV4RRFFQ69G5FAV',
          creatorId: mockUser.id
        }),
      ];

      const nextToken = 'eyJldmVudElkIjoiMDFBUloiLCJjcmVhdGVkQXQiOiIyMDI0LTAxLTAxVDAwOjAwOjAwLjAwMFoifQ==';
      const mockPaginationResult = createMockPaginationResult(mockEvents, true, 'next-page-token');
      mockPaginationResult.pagination.limit = 5;
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({
        queryStringParameters: { limit: '5', nextToken },
        rawQueryString: `limit=5&nextToken=${nextToken}`,
      }, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.pagination.limit).toBe(5);
      expect(responseBody.data.pagination.hasNextPage).toBe(true);
      expect(responseBody.data.pagination.nextToken).toBe('next-page-token');

      // Verify executeWithPagination was called with both parameters
      expect(mockExecuteWithPagination).toHaveBeenCalledWith(mockQuery, {
        limit: 5,
        nextToken,
        defaultLimit: 20,
      });
    });

    it('should use default limit when no limit is provided', async () => {
      const mockUser = createMockUser();
      const mockEvents = [
        createMockEventData({
          eventId: '01FRZ3NDEKTSV4RRFFQ69G5FAV',
          creatorId: mockUser.id
        }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.pagination.limit).toBe(20);

      // Verify executeWithPagination was called with default limit
      expect(mockExecuteWithPagination).toHaveBeenCalledWith(mockQuery, {
        limit: undefined,
        nextToken: undefined,
        defaultLimit: 20,
      });
    });

    it('should handle invalid limit parameter gracefully', async () => {
      const mockUser = createMockUser();
      const mockEvents = [
        createMockEventData({
          eventId: '01GRZ3NDEKTSV4RRFFQ69G5FAV',
          creatorId: mockUser.id
        }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({
        queryStringParameters: { limit: 'invalid' },
        rawQueryString: 'limit=invalid',
      }, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);

      // Verify executeWithPagination was called with NaN limit (handled by pagination utility)
      expect(mockExecuteWithPagination).toHaveBeenCalledWith(mockQuery, {
        limit: NaN,
        nextToken: undefined,
        defaultLimit: 20,
      });
    });

    it('should indicate when there are more pages available', async () => {
      const mockUser = createMockUser();
      const mockEvents = [
        createMockEventData({
          eventId: '01HRZ3NDEKTSV4RRFFQ69G5FAV',
          creatorId: mockUser.id
        }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents, true, 'next-page-token');
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.pagination.hasNextPage).toBe(true);
      expect(responseBody.data.pagination.nextToken).toBe('next-page-token');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should work with organizer role', async () => {
      const mockUser = createMockUser({ role: 'organizer' });
      const mockEvents = [
        createMockEventData({
          eventId: '01IRZ3NDEKTSV4RRFFQ69G5FAV',
          creatorId: mockUser.id
        }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual(mockEvents);

      // Verify CreatorIndex was called with organizer's ID
      expect(mockEventEntity.query.CreatorIndex).toHaveBeenCalledWith({ creatorId: mockUser.id });
    });

    it('should work with admin role', async () => {
      const mockUser = createMockUser({ role: 'admin' });
      const mockEvents = [
        createMockEventData({
          eventId: '01JRZ3NDEKTSV4RRFFQ69G5FAV',
          creatorId: mockUser.id
        }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual(mockEvents);

      // Verify CreatorIndex was called with admin's ID
      expect(mockEventEntity.query.CreatorIndex).toHaveBeenCalledWith({ creatorId: mockUser.id });
    });

    it('should use the authenticated user ID as creator filter', async () => {
      const userId1 = 'user_1234567890';
      const userId2 = 'user_0987654321';

      const mockUser1 = createMockUser({ id: userId1 });
      const mockUser2 = createMockUser({ id: userId2 });

      // Test with first user
      const mockEvents1 = [
        createMockEventData({
          eventId: '01KRZ3NDEKTSV4RRFFQ69G5FAV',
          creatorId: userId1,
          title: 'User 1 Event'
        }),
      ];

      const mockPaginationResult1 = createMockPaginationResult(mockEvents1);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult1);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event1 = createMockEvent({}, mockUser1);
      const context = createMockContext();

      const result1 = await callWrappedHandler(getEventsByCreatorIdHandler, event1, context);

      expect(result1.statusCode).toBe(200);
      expect(mockEventEntity.query.CreatorIndex).toHaveBeenCalledWith({ creatorId: userId1 });

      // Clear mocks and test with second user
      jest.clearAllMocks();

      const mockEvents2 = [
        createMockEventData({
          eventId: '01LRZ3NDEKTSV4RRFFQ69G5FAV',
          creatorId: userId2,
          title: 'User 2 Event'
        }),
      ];

      const mockPaginationResult2 = createMockPaginationResult(mockEvents2);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult2);

      mockEventEntity.query = mockQuery as any;

      const event2 = createMockEvent({}, mockUser2);

      const result2 = await callWrappedHandler(getEventsByCreatorIdHandler, event2, context);

      expect(result2.statusCode).toBe(200);
      expect(mockEventEntity.query.CreatorIndex).toHaveBeenCalledWith({ creatorId: userId2 });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockUser = createMockUser();
      mockExecuteWithPagination.mockRejectedValue(new Error('Database connection failed'));

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Database connection failed');
      expect(responseBody.error.code).toBe('BAD_REQUEST');

      // Verify CreatorIndex was called before the error
      expect(mockEventEntity.query.CreatorIndex).toHaveBeenCalledWith({ creatorId: mockUser.id });
    });

    it('should handle query execution errors', async () => {
      const mockUser = createMockUser();
      mockExecuteWithPagination.mockRejectedValue(new Error('Query execution failed'));

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Query execution failed');
      expect(responseBody.error.code).toBe('BAD_REQUEST');
    });

    it('should handle pagination utility errors', async () => {
      const mockUser = createMockUser();
      mockExecuteWithPagination.mockRejectedValue(new Error('Pagination processing failed'));

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Pagination processing failed');
      expect(responseBody.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('Response Format', () => {
    it('should return events in correct response structure', async () => {
      const mockUser = createMockUser();
      const mockEvents = [
        createMockEventData({ creatorId: mockUser.id }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toEqual({ 'Content-Type': 'application/json' });

      const responseBody = JSON.parse(result.body);

      // Verify response structure
      expect(responseBody).toHaveProperty('success', true);
      expect(responseBody).toHaveProperty('data');
      expect(responseBody.data).toHaveProperty('events');
      expect(responseBody.data).toHaveProperty('pagination');
      expect(responseBody.data.events).toEqual(mockEvents);

      // Verify pagination structure
      expect(responseBody.data.pagination).toHaveProperty('hasNextPage');
      expect(responseBody.data.pagination).toHaveProperty('nextToken');
      expect(responseBody.data.pagination).toHaveProperty('limit');
      expect(responseBody.data.pagination).toHaveProperty('count');
    });

    it('should maintain data types in response', async () => {
      const mockUser = createMockUser();
      const mockEvents = [
        createMockEventData({
          creatorId: mockUser.id,
          registrationFee: 75.50,
          maxParticipants: 150,
          currentParticipants: 42,
          requiredParticipants: 1,
          isFeatured: true,
          isTeamEvent: false,
          isRelay: true,
          isEnabled: true,
          tags: ['running', 'marathon'],
        }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      const eventData = responseBody.data.events[0];

      // Verify data types are preserved
      expect(typeof eventData.registrationFee).toBe('number');
      expect(typeof eventData.maxParticipants).toBe('number');
      expect(typeof eventData.currentParticipants).toBe('number');
      expect(typeof eventData.requiredParticipants).toBe('number');
      expect(typeof eventData.isFeatured).toBe('boolean');
      expect(typeof eventData.isTeamEvent).toBe('boolean');
      expect(typeof eventData.isRelay).toBe('boolean');
      expect(typeof eventData.isEnabled).toBe('boolean');
      expect(Array.isArray(eventData.tags)).toBe(true);

      // Verify specific values
      expect(eventData.registrationFee).toBe(75.50);
      expect(eventData.maxParticipants).toBe(150);
      expect(eventData.currentParticipants).toBe(42);
      expect(eventData.isFeatured).toBe(true);
      expect(eventData.isTeamEvent).toBe(false);
      expect(eventData.isRelay).toBe(true);
      expect(eventData.tags).toEqual(['running', 'marathon']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with no queryStringParameters', async () => {
      const mockUser = createMockUser();
      const mockEvents = [
        createMockEventData({ creatorId: mockUser.id }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({
        queryStringParameters: {},
      }, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual(mockEvents);

      // Verify executeWithPagination was called with undefined parameters
      expect(mockExecuteWithPagination).toHaveBeenCalledWith(mockQuery, {
        limit: undefined,
        nextToken: undefined,
        defaultLimit: 20,
      });
    });

    it('should handle events with various event types', async () => {
      const mockUser = createMockUser();
      const eventTypes = ['running', 'cycling', 'swimming', 'triathlon', 'walking'];

      const mockEvents = eventTypes.map((type, index) =>
        createMockEventData({
          eventId: `01${String.fromCharCode(65 + index)}RZ3NDEKTSV4RRFFQ69G5FAV`,
          creatorId: mockUser.id,
          type,
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} Event`
        })
      );

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toHaveLength(5);

      // Verify all event types are present
      const returnedTypes = responseBody.data.events.map((e: any) => e.type);
      eventTypes.forEach(type => {
        expect(returnedTypes).toContain(type);
      });
    });

    it('should handle events with zero registration fee', async () => {
      const mockUser = createMockUser();
      const mockEvents = [
        createMockEventData({
          creatorId: mockUser.id,
          title: 'Free Community Run',
          registrationFee: 0,
        }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events[0].registrationFee).toBe(0);
      expect(responseBody.data.events[0].title).toBe('Free Community Run');
    });

    it('should handle large number of events with pagination', async () => {
      const mockUser = createMockUser();
      const mockEvents = Array.from({ length: 50 }, (_, index) =>
        createMockEventData({
          eventId: `01${index.toString().padStart(24, '0')}`,
          creatorId: mockUser.id,
          title: `Event ${index + 1}`
        })
      );

      const mockPaginationResult = createMockPaginationResult(
        mockEvents.slice(0, 20),
        true,
        'next-page-token'
      );
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        CreatorIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({}, mockUser);
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsByCreatorIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toHaveLength(20);
      expect(responseBody.data.pagination.hasNextPage).toBe(true);
      expect(responseBody.data.pagination.nextToken).toBe('next-page-token');
      expect(responseBody.data.pagination.count).toBe(20);
    });
  });
});