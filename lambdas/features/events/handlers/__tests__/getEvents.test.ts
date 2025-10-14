// Mock environment variables FIRST
process.env.EVENTS_TABLE_NAME = 'test-events-table';

import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { EventEntity } from '../../models/event.model';
import { OrganizerEntity } from '../../models/organizer.model';
import { handler as getEventsHandler } from '../getEvents';

// Mock the EventEntity
jest.mock('../../models/event.model');
const mockEventEntity = EventEntity as jest.Mocked<typeof EventEntity>;

// Mock the OrganizerEntity
jest.mock('../../models/organizer.model');
const mockOrganizerEntity = OrganizerEntity as jest.Mocked<typeof OrganizerEntity>;

// Mock the shared middleware
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
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            message: error.message,
            code: 'BAD_REQUEST',
          },
          data: null,
        }),
      };
    }
  },
}));

// Mock the wrapper module
jest.mock('../../../../shared/wrapper', () => ({
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
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            message: error.message,
            code: 'BAD_REQUEST',
          },
          data: null,
        }),
      };
    }
  },
}));

// Mock the pagination utility
jest.mock('../../../../shared/utils/pagination', () => ({
  executeWithPagination: jest.fn(),
}));

// Mock the logger
jest.mock('../../../../shared/logger', () => ({
  createFeatureLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  createRequestLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

import { executeWithPagination } from '../../../../shared/utils/pagination';
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
  event: APIGatewayProxyEventV2,
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

  // Mock OrganizerEntity.get() to return no organizer data (null)
  mockOrganizerEntity.get = jest.fn().mockReturnValue({
    go: jest.fn().mockResolvedValue({ data: null }),
  }) as any;
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

// Helper function to create mock API Gateway event
const createMockEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 => ({
  version: '2.0',
  routeKey: 'GET /events',
  rawPath: '/events',
  rawQueryString: '',
  headers: {
    'content-type': 'application/json',
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    domainName: 'test.execute-api.us-east-1.amazonaws.com',
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
    time: '01/Jan/2024:00:00:00 +0000',
    timeEpoch: 1704067200000,
  },
  queryStringParameters: undefined,
  isBase64Encoded: false,
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
  organizer: null, // Added organizer field
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

describe('getEvents Handler', () => {
  describe('Default Query (All Enabled Events)', () => {
    it('should retrieve all enabled events with default pagination', async () => {
      const mockEvents = [
        createMockEventData({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', title: 'Marathon Event 1' }),
        createMockEventData({ eventId: '01BRZ3NDEKTSV4RRFFQ69G5FAV', title: 'Marathon Event 2' }),
        createMockEventData({ eventId: '01CRZ3NDEKTSV4RRFFQ69G5FAV', title: 'Marathon Event 3' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      // Mock the query chain
      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual(mockEvents);
      expect(responseBody.data.pagination).toEqual({
        hasNextPage: false,
        nextToken: null,
        limit: 20,
        count: 3,
      });

      // Verify EnabledIndex was called with correct parameters
      expect(mockEventEntity.query.EnabledIndex).toHaveBeenCalledWith({ enabledStatus: 'enabled' });

      // Verify executeWithPagination was called with correct parameters
      expect(mockExecuteWithPagination).toHaveBeenCalledWith(mockQuery, {
        limit: undefined,
        nextToken: undefined,
        defaultLimit: 20,
      });
    });

    it('should handle empty results for enabled events', async () => {
      const mockPaginationResult = createMockPaginationResult([]);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual([]);
      expect(responseBody.data.pagination.count).toBe(0);
      expect(responseBody.data.pagination.hasNextPage).toBe(false);
    });
  });

  describe('Query by Type', () => {
    it('should retrieve events filtered by type', async () => {
      const mockRunningEvents = [
        createMockEventData({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', type: 'running', title: 'Marathon 1' }),
        createMockEventData({ eventId: '01BRZ3NDEKTSV4RRFFQ69G5FAV', type: 'running', title: 'Marathon 2' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockRunningEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      // Mock the query chain for TypeIndex
      const mockWhereClause = jest.fn().mockReturnThis();
      const mockTypeQuery = {
        TypeIndex: jest.fn().mockReturnValue({
          where: mockWhereClause,
        }),
      };
      mockEventEntity.query = mockTypeQuery as any;

      const event = createMockEvent({
        queryStringParameters: { type: 'running' },
        rawQueryString: 'type=running',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual(mockRunningEvents);
      expect(responseBody.data.events.every((e: any) => e.type === 'running')).toBe(true);

      // Verify TypeIndex was called with correct type
      expect(mockEventEntity.query.TypeIndex).toHaveBeenCalledWith({ type: 'running' });

      // Verify where clause was called for isEnabled filter
      expect(mockWhereClause).toHaveBeenCalled();
    });

    it('should handle different event types correctly', async () => {
      const eventTypes = ['running', 'cycling', 'swimming', 'triathlon'];

      for (const eventType of eventTypes) {
        const mockEvents = [
          createMockEventData({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', type: eventType, title: `${eventType} Event` }),
        ];

        const mockPaginationResult = createMockPaginationResult(mockEvents);
        mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

        const mockWhereClause = jest.fn().mockReturnThis();
        const mockTypeQuery = {
          TypeIndex: jest.fn().mockReturnValue({
            where: mockWhereClause,
          }),
        };
        mockEventEntity.query = mockTypeQuery as any;

        const event = createMockEvent({
          queryStringParameters: { type: eventType },
          rawQueryString: `type=${eventType}`,
        });
        const context = createMockContext();

        const result = await callWrappedHandler(getEventsHandler, event, context);

        expect(result.statusCode).toBe(200);

        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.events[0].type).toBe(eventType);

        // Verify TypeIndex was called with correct type
        expect(mockEventEntity.query.TypeIndex).toHaveBeenCalledWith({ type: eventType });

        // Clear mocks for next iteration
        jest.clearAllMocks();
      }
    });

    it('should handle empty results for specific type', async () => {
      const mockPaginationResult = createMockPaginationResult([]);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockWhereClause = jest.fn().mockReturnThis();
      const mockTypeQuery = {
        TypeIndex: jest.fn().mockReturnValue({
          where: mockWhereClause,
        }),
      };
      mockEventEntity.query = mockTypeQuery as any;

      const event = createMockEvent({
        queryStringParameters: { type: 'nonexistent' },
        rawQueryString: 'type=nonexistent',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual([]);
      expect(responseBody.data.pagination.count).toBe(0);
    });
  });

  describe('Query by Difficulty', () => {
    it('should retrieve events filtered by difficulty when type is not provided', async () => {
      const mockIntermediateEvents = [
        createMockEventData({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', difficulty: 'intermediate', title: 'Intermediate Run 1' }),
        createMockEventData({ eventId: '01BRZ3NDEKTSV4RRFFQ69G5FAV', difficulty: 'intermediate', title: 'Intermediate Run 2' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockIntermediateEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      // Mock the query chain for DifficultyIndex
      const mockWhereClause = jest.fn().mockReturnThis();
      const mockDifficultyQuery = {
        DifficultyIndex: jest.fn().mockReturnValue({
          where: mockWhereClause,
        }),
      };
      mockEventEntity.query = mockDifficultyQuery as any;

      const event = createMockEvent({
        queryStringParameters: { difficulty: 'intermediate' },
        rawQueryString: 'difficulty=intermediate',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual(mockIntermediateEvents);
      expect(responseBody.data.events.every((e: any) => e.difficulty === 'intermediate')).toBe(true);

      // Verify DifficultyIndex was called with correct difficulty
      expect(mockEventEntity.query.DifficultyIndex).toHaveBeenCalledWith({ difficulty: 'intermediate' });

      // Verify where clause was called for isEnabled filter
      expect(mockWhereClause).toHaveBeenCalled();
    });

    it('should handle different difficulty levels correctly', async () => {
      const difficultyLevels = ['beginner', 'intermediate', 'advanced'];

      for (const difficulty of difficultyLevels) {
        const mockEvents = [
          createMockEventData({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', difficulty, title: `${difficulty} Event` }),
        ];

        const mockPaginationResult = createMockPaginationResult(mockEvents);
        mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

        const mockWhereClause = jest.fn().mockReturnThis();
        const mockDifficultyQuery = {
          DifficultyIndex: jest.fn().mockReturnValue({
            where: mockWhereClause,
          }),
        };
        mockEventEntity.query = mockDifficultyQuery as any;

        const event = createMockEvent({
          queryStringParameters: { difficulty },
          rawQueryString: `difficulty=${difficulty}`,
        });
        const context = createMockContext();

        const result = await callWrappedHandler(getEventsHandler, event, context);

        expect(result.statusCode).toBe(200);

        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.events[0].difficulty).toBe(difficulty);

        // Verify DifficultyIndex was called with correct difficulty
        expect(mockEventEntity.query.DifficultyIndex).toHaveBeenCalledWith({ difficulty });

        // Clear mocks for next iteration
        jest.clearAllMocks();
      }
    });
  });

  describe('Query Priority Logic', () => {
    it('should prioritize type over difficulty when both are provided', async () => {
      const mockRunningEvents = [
        createMockEventData({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', type: 'running', difficulty: 'beginner' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockRunningEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      // Mock the query chain for TypeIndex (should be used, not DifficultyIndex)
      const mockWhereClause = jest.fn().mockReturnThis();
      const mockTypeQuery = {
        TypeIndex: jest.fn().mockReturnValue({
          where: mockWhereClause,
        }),
        DifficultyIndex: jest.fn().mockReturnValue({
          where: mockWhereClause,
        }),
      };
      mockEventEntity.query = mockTypeQuery as any;

      const event = createMockEvent({
        queryStringParameters: { type: 'running', difficulty: 'advanced' },
        rawQueryString: 'type=running&difficulty=advanced',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);

      // Verify TypeIndex was called (priority over DifficultyIndex)
      expect(mockEventEntity.query.TypeIndex).toHaveBeenCalledWith({ type: 'running' });
      expect(mockEventEntity.query.DifficultyIndex).not.toHaveBeenCalled();
    });

    it('should use difficulty when type is not provided', async () => {
      const mockAdvancedEvents = [
        createMockEventData({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', difficulty: 'advanced' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockAdvancedEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockWhereClause = jest.fn().mockReturnThis();
      const mockDifficultyQuery = {
        DifficultyIndex: jest.fn().mockReturnValue({
          where: mockWhereClause,
        }),
      };
      mockEventEntity.query = mockDifficultyQuery as any;

      const event = createMockEvent({
        queryStringParameters: { difficulty: 'advanced' },
        rawQueryString: 'difficulty=advanced',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);

      // Verify DifficultyIndex was called
      expect(mockEventEntity.query.DifficultyIndex).toHaveBeenCalledWith({ difficulty: 'advanced' });
    });

    it('should use default enabled query when neither type nor difficulty is provided', async () => {
      const mockEvents = [
        createMockEventData({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({
        queryStringParameters: {},
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);

      // Verify EnabledIndex was called
      expect(mockEventEntity.query.EnabledIndex).toHaveBeenCalledWith({ enabledStatus: 'enabled' });
    });
  });

  describe('Pagination', () => {
    it('should handle custom limit parameter', async () => {
      const mockEvents = [
        createMockEventData({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }),
        createMockEventData({ eventId: '01BRZ3NDEKTSV4RRFFQ69G5FAV' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockPaginationResult.pagination.limit = 10;
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({
        queryStringParameters: { limit: '10' },
        rawQueryString: 'limit=10',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

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
      const mockEvents = [
        createMockEventData({ eventId: '01CRZ3NDEKTSV4RRFFQ69G5FAV' }),
        createMockEventData({ eventId: '01DRZ3NDEKTSV4RRFFQ69G5FAV' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const nextToken = 'eyJldmVudElkIjoiMDFBUloiLCJjcmVhdGVkQXQiOiIyMDI0LTAxLTAxVDAwOjAwOjAwLjAwMFoifQ==';

      const event = createMockEvent({
        queryStringParameters: { nextToken },
        rawQueryString: `nextToken=${nextToken}`,
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

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
      const mockEvents = [
        createMockEventData({ eventId: '01ERZ3NDEKTSV4RRFFQ69G5FAV' }),
      ];

      const nextToken = 'eyJldmVudElkIjoiMDFBUloiLCJjcmVhdGVkQXQiOiIyMDI0LTAxLTAxVDAwOjAwOjAwLjAwMFoifQ==';
      const mockPaginationResult = createMockPaginationResult(mockEvents, true, 'next-page-token');
      mockPaginationResult.pagination.limit = 5;
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({
        queryStringParameters: { limit: '5', nextToken },
        rawQueryString: `limit=5&nextToken=${nextToken}`,
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

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

    it('should indicate when there are more pages available', async () => {
      const mockEvents = [
        createMockEventData({ eventId: '01FRZ3NDEKTSV4RRFFQ69G5FAV' }),
        createMockEventData({ eventId: '01GRZ3NDEKTSV4RRFFQ69G5FAV' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents, true, 'next-page-token');
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.pagination.hasNextPage).toBe(true);
      expect(responseBody.data.pagination.nextToken).toBe('next-page-token');
    });

    it('should handle invalid limit parameter gracefully', async () => {
      const mockEvents = [
        createMockEventData({ eventId: '01HRZ3NDEKTSV4RRFFQ69G5FAV' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({
        queryStringParameters: { limit: 'invalid' },
        rawQueryString: 'limit=invalid',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);

      // Verify executeWithPagination was called with NaN limit (which should be handled by pagination utility)
      expect(mockExecuteWithPagination).toHaveBeenCalledWith(mockQuery, {
        limit: NaN,
        nextToken: undefined,
        defaultLimit: 20,
      });
    });
  });

  describe('Combined Query Parameters', () => {
    it('should handle type filter with pagination parameters', async () => {
      const mockCyclingEvents = [
        createMockEventData({ eventId: '01IRZ3NDEKTSV4RRFFQ69G5FAV', type: 'cycling' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockCyclingEvents);
      mockPaginationResult.pagination.limit = 15;
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockWhereClause = jest.fn().mockReturnThis();
      const mockTypeQuery = {
        TypeIndex: jest.fn().mockReturnValue({
          where: mockWhereClause,
        }),
      };
      mockEventEntity.query = mockTypeQuery as any;

      const event = createMockEvent({
        queryStringParameters: { type: 'cycling', limit: '15' },
        rawQueryString: 'type=cycling&limit=15',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events[0].type).toBe('cycling');
      expect(responseBody.data.pagination.limit).toBe(15);

      // Verify both type filter and pagination were applied
      expect(mockEventEntity.query.TypeIndex).toHaveBeenCalledWith({ type: 'cycling' });
      expect(mockExecuteWithPagination).toHaveBeenCalledWith(expect.anything(), {
        limit: 15,
        nextToken: undefined,
        defaultLimit: 20,
      });
    });

    it('should handle difficulty filter with pagination parameters', async () => {
      const mockBeginnerEvents = [
        createMockEventData({ eventId: '01JRZ3NDEKTSV4RRFFQ69G5FAV', difficulty: 'beginner' }),
      ];

      const nextToken = 'eyJldmVudElkIjoiMDFBUloiLCJjcmVhdGVkQXQiOiIyMDI0LTAxLTAxVDAwOjAwOjAwLjAwMFoifQ==';
      const mockPaginationResult = createMockPaginationResult(mockBeginnerEvents);
      mockPaginationResult.pagination.limit = 25;
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockWhereClause = jest.fn().mockReturnThis();
      const mockDifficultyQuery = {
        DifficultyIndex: jest.fn().mockReturnValue({
          where: mockWhereClause,
        }),
      };
      mockEventEntity.query = mockDifficultyQuery as any;

      const event = createMockEvent({
        queryStringParameters: { difficulty: 'beginner', limit: '25', nextToken },
        rawQueryString: `difficulty=beginner&limit=25&nextToken=${nextToken}`,
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events[0].difficulty).toBe('beginner');
      expect(responseBody.data.pagination.limit).toBe(25);

      // Verify both difficulty filter and pagination were applied
      expect(mockEventEntity.query.DifficultyIndex).toHaveBeenCalledWith({ difficulty: 'beginner' });
      expect(mockExecuteWithPagination).toHaveBeenCalledWith(expect.anything(), {
        limit: 25,
        nextToken,
        defaultLimit: 20,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockExecuteWithPagination.mockRejectedValue(new Error('Database connection failed'));

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Database connection failed');
      expect(responseBody.error.code).toBe('BAD_REQUEST');
    });

    it('should handle query building errors', async () => {
      // Mock query to throw an error
      const mockQuery = {
        TypeIndex: jest.fn().mockImplementation(() => {
          throw new Error('Query building failed');
        }),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({
        queryStringParameters: { type: 'running' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Query building failed');
      expect(responseBody.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('Response Format', () => {
    it('should return events and pagination in correct response structure', async () => {
      const mockEvents = [
        createMockEventData({ eventId: '01KRZ3NDEKTSV4RRFFQ69G5FAV' }),
        createMockEventData({ eventId: '01LRZ3NDEKTSV4RRFFQ69G5FAV' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents, true, 'next-token');
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toEqual({ 'Content-Type': 'application/json' });

      const responseBody = JSON.parse(result.body);

      // Verify response structure
      expect(responseBody).toHaveProperty('success', true);
      expect(responseBody).toHaveProperty('data');
      expect(responseBody.data).toHaveProperty('events');
      expect(responseBody.data).toHaveProperty('pagination');

      // Verify events array
      expect(Array.isArray(responseBody.data.events)).toBe(true);
      expect(responseBody.data.events).toEqual(mockEvents);

      // Verify pagination object structure
      expect(responseBody.data.pagination).toHaveProperty('hasNextPage', true);
      expect(responseBody.data.pagination).toHaveProperty('nextToken', 'next-token');
      expect(responseBody.data.pagination).toHaveProperty('limit', 20);
      expect(responseBody.data.pagination).toHaveProperty('count', 2);
    });

    it('should maintain event data types in response', async () => {
      const mockEvent = createMockEventData({
        registrationFee: 99.99,
        maxParticipants: 200,
        currentParticipants: 75,
        requiredParticipants: 1,
        isFeatured: true,
        isTeamEvent: false,
        isRelay: true,
        isEnabled: true,
        tags: ['running', 'marathon', 'charity'],
      });

      const mockPaginationResult = createMockPaginationResult([mockEvent]);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

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
      expect(eventData.registrationFee).toBe(99.99);
      expect(eventData.maxParticipants).toBe(200);
      expect(eventData.currentParticipants).toBe(75);
      expect(eventData.isFeatured).toBe(true);
      expect(eventData.isTeamEvent).toBe(false);
      expect(eventData.isRelay).toBe(true);
      expect(eventData.tags).toEqual(['running', 'marathon', 'charity']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null queryStringParameters', async () => {
      const mockEvents = [
        createMockEventData({ eventId: '01MRZ3NDEKTSV4RRFFQ69G5FAV' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({
        queryStringParameters: undefined,
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual(mockEvents);

      // Should default to EnabledIndex query
      expect(mockEventEntity.query.EnabledIndex).toHaveBeenCalledWith({ enabledStatus: 'enabled' });
    });

    it('should handle empty string query parameters', async () => {
      const mockEvents = [
        createMockEventData({ eventId: '01NRZ3NDEKTSV4RRFFQ69G5FAV' }),
      ];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({
        queryStringParameters: { type: '', difficulty: '', limit: '', nextToken: '' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);

      // Should default to EnabledIndex query since type and difficulty are empty
      expect(mockEventEntity.query.EnabledIndex).toHaveBeenCalledWith({ enabledStatus: 'enabled' });
    });

    it('should handle zero limit parameter', async () => {
      const mockEvents: any[] = [];

      const mockPaginationResult = createMockPaginationResult(mockEvents);
      mockPaginationResult.pagination.limit = 0;
      mockExecuteWithPagination.mockResolvedValue(mockPaginationResult);

      const mockQuery = {
        EnabledIndex: jest.fn().mockReturnThis(),
      };
      mockEventEntity.query = mockQuery as any;

      const event = createMockEvent({
        queryStringParameters: { limit: '0' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventsHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.events).toEqual([]);
      expect(responseBody.data.pagination.limit).toBe(0);

      // Verify executeWithPagination was called with limit 0
      expect(mockExecuteWithPagination).toHaveBeenCalledWith(mockQuery, {
        limit: 0,
        nextToken: undefined,
        defaultLimit: 20,
      });
    });
  });
});
