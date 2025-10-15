// Mock environment variables FIRST
process.env.EVENTS_TABLE_NAME = 'test-events-table';

import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { EventEntity } from '@/features/events/models/event.model';
import { handler as getEventByIdHandler } from '../getEventById';

// Mock the EventEntity
jest.mock('../../models/event.model');
const mockEventEntity = EventEntity as jest.Mocked<typeof EventEntity>;

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
      let statusCode = 400;
      let errorCode = 'BAD_REQUEST';

      if (error.name === 'NotFoundError') {
        statusCode = 404;
        errorCode = 'NOT_FOUND';
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
  BadRequestError: class BadRequestError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'BadRequestError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
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
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

// Helper function to create mock API Gateway event
const createMockEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 => ({
  version: '2.0',
  routeKey: 'GET /events/{id}',
  rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV',
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
      path: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'GET /events/{id}',
    stage: 'test',
    time: '01/Jan/2024:00:00:00 +0000',
    timeEpoch: 1704067200000,
  },
  pathParameters: {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  },
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
  ...overrides,
});

describe('getEventById Handler', () => {
  describe('Successful Event Retrieval', () => {
    it('should successfully retrieve event by valid ULID', async () => {
      const mockEventData = createMockEventData();

      // Mock EventEntity.get().go() to return the event data
      const mockGet = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockEventData,
        }),
      });
      mockEventEntity.get = mockGet;

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockEventData);

      // Verify EventEntity.get was called with correct eventId
      expect(mockEventEntity.get).toHaveBeenCalledWith({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' });
    });

    it('should retrieve team event with correct team properties', async () => {
      const mockTeamEventData = createMockEventData({
        title: 'Team Triathlon Relay',
        isTeamEvent: true,
        isRelay: true,
        requiredParticipants: 3,
        maxParticipants: 30,
        type: 'triathlon',
      });

      const mockGet = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockTeamEventData,
        }),
      });
      mockEventEntity.get = mockGet;

      const event = createMockEvent({
        pathParameters: { id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.isTeamEvent).toBe(true);
      expect(responseBody.data.event.isRelay).toBe(true);
      expect(responseBody.data.event.requiredParticipants).toBe(3);
      expect(responseBody.data.event.maxParticipants).toBe(30);
      expect(responseBody.data.event.type).toBe('triathlon');
    });

    it('should retrieve featured event with correct featured status', async () => {
      const mockFeaturedEventData = createMockEventData({
        title: 'Featured Marathon Championship',
        isFeatured: true,
        registrationFee: 100,
        difficulty: 'advanced',
      });

      const mockGet = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockFeaturedEventData,
        }),
      });
      mockEventEntity.get = mockGet;

      const event = createMockEvent({
        pathParameters: { id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.isFeatured).toBe(true);
      expect(responseBody.data.event.title).toBe('Featured Marathon Championship');
      expect(responseBody.data.event.registrationFee).toBe(100);
      expect(responseBody.data.event.difficulty).toBe('advanced');
    });

    it('should retrieve event with all optional fields populated', async () => {
      const mockCompleteEventData = createMockEventData({
        isRelay: true,
        tags: ['running', 'marathon', 'charity', 'outdoor'],
        description: 'Complete marathon event with all features enabled',
        image: 'https://example.com/complete-marathon.jpg',
      });

      const mockGet = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockCompleteEventData,
        }),
      });
      mockEventEntity.get = mockGet;

      const event = createMockEvent({
        pathParameters: { id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.isRelay).toBe(true);
      expect(responseBody.data.event.tags).toEqual(['running', 'marathon', 'charity', 'outdoor']);
      expect(responseBody.data.event.description).toBe('Complete marathon event with all features enabled');
      expect(responseBody.data.event.image).toBe('https://example.com/complete-marathon.jpg');
    });
  });

  describe('Error Handling', () => {
    it('should return 400 when id parameter is missing', async () => {
      const event = createMockEvent({
        pathParameters: undefined,
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Missing id parameter');
      expect(responseBody.error.code).toBe('BAD_REQUEST');

      // Verify EventEntity.get was not called
      expect(mockEventEntity.get).not.toHaveBeenCalled();
    });

    it('should return 400 when id parameter is empty string', async () => {
      const event = createMockEvent({
        pathParameters: { id: '' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Missing id parameter');
      expect(responseBody.error.code).toBe('BAD_REQUEST');

      // Verify EventEntity.get was not called
      expect(mockEventEntity.get).not.toHaveBeenCalled();
    });

    it('should return 400 when pathParameters is empty object', async () => {
      const event = createMockEvent({
        pathParameters: {},
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Missing id parameter');
      expect(responseBody.error.code).toBe('BAD_REQUEST');

      // Verify EventEntity.get was not called
      expect(mockEventEntity.get).not.toHaveBeenCalled();
    });

    it('should return 404 when event is not found', async () => {
      // Mock EventEntity.get().go() to return null data
      const mockGet = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: null,
        }),
      });
      mockEventEntity.get = mockGet;

      const event = createMockEvent({
        pathParameters: { id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(404);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Event not found');
      expect(responseBody.error.code).toBe('NOT_FOUND');

      // Verify EventEntity.get was called with correct eventId
      expect(mockEventEntity.get).toHaveBeenCalledWith({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' });
    });

    it('should return 404 when event data is undefined', async () => {
      // Mock EventEntity.get().go() to return undefined data
      const mockGet = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: undefined,
        }),
      });
      mockEventEntity.get = mockGet;

      const event = createMockEvent({
        pathParameters: { id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(404);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Event not found');
      expect(responseBody.error.code).toBe('NOT_FOUND');

      // Verify EventEntity.get was called with correct eventId
      expect(mockEventEntity.get).toHaveBeenCalledWith({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' });
    });

    it('should handle database errors gracefully', async () => {
      // Mock EventEntity.get().go() to throw a database error
      const mockGet = jest.fn().mockReturnValue({
        go: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      });
      mockEventEntity.get = mockGet;

      const event = createMockEvent({
        pathParameters: { id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Database connection failed');
      expect(responseBody.error.code).toBe('BAD_REQUEST');

      // Verify EventEntity.get was called with correct eventId
      expect(mockEventEntity.get).toHaveBeenCalledWith({ eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' });
    });
  });

  describe('Parameter Validation', () => {
    it('should handle different ULID formats correctly', async () => {
      const validULIDs = [
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        '01BX5ZZKBKACTAV9WEVGEMMVRY',
        '01CQRJF1QJBCTA8J60GBG6WQJZ',
      ];

      for (const ulid of validULIDs) {
        const mockEventData = createMockEventData({ eventId: ulid });

        const mockGet = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: mockEventData,
          }),
        });
        mockEventEntity.get = mockGet;

        const event = createMockEvent({
          pathParameters: { id: ulid },
          rawPath: `/events/${ulid}`,
        });
        const context = createMockContext();

        const result = await callWrappedHandler(getEventByIdHandler, event, context);

        expect(result.statusCode).toBe(200);

        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.event.eventId).toBe(ulid);

        // Verify EventEntity.get was called with correct eventId
        expect(mockEventEntity.get).toHaveBeenCalledWith({ eventId: ulid });

        // Clear mocks for next iteration
        jest.clearAllMocks();
      }
    });

    it('should handle malformed path parameters gracefully', async () => {
      const event = createMockEvent({
        pathParameters: { wrongParam: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Missing id parameter');
      expect(responseBody.error.code).toBe('BAD_REQUEST');

      // Verify EventEntity.get was not called
      expect(mockEventEntity.get).not.toHaveBeenCalled();
    });
  });

  describe('Response Format', () => {
    it('should return event data in correct response structure', async () => {
      const mockEventData = createMockEventData();

      const mockGet = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockEventData,
        }),
      });
      mockEventEntity.get = mockGet;

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toEqual({ 'Content-Type': 'application/json' });

      const responseBody = JSON.parse(result.body);

      // Verify response structure
      expect(responseBody).toHaveProperty('success', true);
      expect(responseBody).toHaveProperty('data');
      expect(responseBody.data).toHaveProperty('event');
      expect(responseBody.data.event).toEqual(mockEventData);

      // Verify all required event fields are present
      expect(responseBody.data.event).toHaveProperty('eventId');
      expect(responseBody.data.event).toHaveProperty('title');
      expect(responseBody.data.event).toHaveProperty('type');
      expect(responseBody.data.event).toHaveProperty('date');
      expect(responseBody.data.event).toHaveProperty('location');
      expect(responseBody.data.event).toHaveProperty('description');
      expect(responseBody.data.event).toHaveProperty('organizerId');
      expect(responseBody.data.event).toHaveProperty('creatorId');
    });

    it('should maintain data types in response', async () => {
      const mockEventData = createMockEventData({
        registrationFee: 75.50,
        maxParticipants: 150,
        currentParticipants: 42,
        requiredParticipants: 1,
        isFeatured: true,
        isTeamEvent: false,
        isRelay: true,
        isEnabled: true,
        tags: ['running', 'marathon'],
      });

      const mockGet = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockEventData,
        }),
      });
      mockEventEntity.get = mockGet;

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      const eventData = responseBody.data.event;

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
    it('should handle event with minimal required fields', async () => {
      const mockMinimalEventData = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        title: 'Minimal Event',
        slug: 'minimal-event',
        type: 'running',
        date: '2024-12-01T10:00:00Z',
        isFeatured: false,
        isTeamEvent: false,
        requiredParticipants: 1,
        maxParticipants: 10,
        currentParticipants: 0,
        location: 'Test Location',
        description: 'Test Description',
        distance: '5km',
        registrationFee: 0,
        registrationDeadline: '2024-11-30T23:59:59Z',
        image: 'https://example.com/image.jpg',
        difficulty: 'beginner',
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockGet = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockMinimalEventData,
        }),
      });
      mockEventEntity.get = mockGet;

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockMinimalEventData);
    });

    it('should handle event with zero registration fee', async () => {
      const mockFreeEventData = createMockEventData({
        title: 'Free Community Run',
        registrationFee: 0,
        description: 'Free community running event',
      });

      const mockGet = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockFreeEventData,
        }),
      });
      mockEventEntity.get = mockGet;

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.registrationFee).toBe(0);
      expect(responseBody.data.event.title).toBe('Free Community Run');
    });

    it('should handle event with empty tags array', async () => {
      const mockEventWithoutTags = createMockEventData({
        tags: [],
      });

      const mockGet = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockEventWithoutTags,
        }),
      });
      mockEventEntity.get = mockGet;

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(getEventByIdHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.tags).toEqual([]);
      expect(Array.isArray(responseBody.data.event.tags)).toBe(true);
    });
  });
});
