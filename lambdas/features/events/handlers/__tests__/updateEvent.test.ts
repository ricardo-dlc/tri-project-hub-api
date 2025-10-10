// Mock environment variables FIRST
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';

import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { eventService } from '../../services/event.service';
import { EventItem, UpdateEventData } from '../../types/event.types';
import { AuthenticatedEvent } from '../../../../shared/auth/middleware';

// Mock the event service
jest.mock('../../services/event.service');
const mockEventService = eventService as jest.Mocked<typeof eventService>;

// Mock the auth middleware
jest.mock('../../../../shared/auth/middleware', () => ({
  withAuth: (handlerFn: any) => handlerFn,
}));

// Mock the shared middleware
jest.mock('../../../../shared', () => ({
  withMiddleware: (handlerFn: any) => async (event: any, context: any) => {
    try {
      const result = await handlerFn(event, context);
      // Check if result has statusCode and data properties (HandlerResponse)
      const isHandlerResponse = result && typeof result === 'object' && 'data' in result;
      const statusCode = isHandlerResponse ? result.statusCode || 200 : 200;
      const data = isHandlerResponse ? result.data : result;

      // Format the success response like the real middleware
      const response = {
        success: true,
        data,
      };

      return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error.message }),
      };
    }
  },
  BadRequestError: class BadRequestError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'BadRequestError';
    }
  },
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ForbiddenError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
}));

import { handler } from '../updateEvent';

// Get the mocked error classes
const { BadRequestError, ForbiddenError, NotFoundError } = jest.requireMock('../../../../shared');

// Type for API Gateway v2 response
interface APIGatewayProxyResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

// Helper to call wrapped handler and cast result
const callWrappedHandler = async (
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  const result = await (handler as any)(event, context);
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
  eventId: string = 'test-event-id',
  overrides: Partial<AuthenticatedEvent> = {}
): AuthenticatedEvent => ({
  version: '2.0',
  routeKey: 'PUT /events/{eventId}',
  rawPath: `/events/${eventId}`,
  rawQueryString: '',
  headers: {
    'content-type': 'application/json',
    authorization: 'Bearer valid-token',
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    domainName: 'test.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'test',
    http: {
      method: 'PUT',
      path: `/events/${eventId}`,
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'PUT /events/{eventId}',
    stage: 'test',
    time: '01/Jan/2024:00:00:00 +0000',
    timeEpoch: 1704067200000,
  },
  pathParameters: { eventId },
  isBase64Encoded: false,
  user: {
    id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
    email: 'test@example.com',
    role: 'organizer',
  },
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
const createMockEventItem = (): EventItem => ({
  eventId: 'test-event-id',
  creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
  organizerId: 'org_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  title: 'Updated Test Marathon',
  slug: 'test-marathon',
  type: 'running',
  date: '2024-12-01T10:00:00Z',
  isFeatured: false,
  isTeamEvent: false,
  isRelay: false,
  requiredParticipants: 1,
  maxParticipants: 100,
  currentParticipants: 0,
  location: 'Central Park, New York',
  description: 'Updated annual marathon event in Central Park',
  distance: '42.2km',
  registrationFee: 60,
  registrationDeadline: '2024-11-25T23:59:59Z',
  image: 'https://example.com/updated-marathon.jpg',
  difficulty: 'advanced',
  tags: ['running', 'marathon', 'fitness', 'updated'],
  isEnabled: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
});

// Helper function to create valid update data
const createValidUpdateData = (): UpdateEventData => ({
  title: 'Updated Test Marathon',
  description: 'Updated annual marathon event in Central Park',
  registrationFee: 60,
  difficulty: 'advanced',
  tags: ['running', 'marathon', 'fitness', 'updated'],
});

describe('updateEvent handler', () => {
  describe('successful event updates', () => {
    it('should update event with valid data', async () => {
      const mockUpdatedEvent = createMockEventItem();
      const updateData = createValidUpdateData();

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockUpdatedEvent);

      // Verify service was called with correct parameters
      expect(mockEventService.updateEvent).toHaveBeenCalledWith(
        'test-event-id',
        updateData,
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should update event with partial data', async () => {
      const mockUpdatedEvent = createMockEventItem();
      const updateData = { title: 'Just Updated Title' };

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockUpdatedEvent);

      expect(mockEventService.updateEvent).toHaveBeenCalledWith(
        'test-event-id',
        updateData,
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should allow admin to update any event', async () => {
      const mockUpdatedEvent = createMockEventItem();
      const updateData = createValidUpdateData();

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          role: 'admin',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockUpdatedEvent);

      expect(mockEventService.updateEvent).toHaveBeenCalledWith(
        'test-event-id',
        updateData,
        {
          id: 'admin-user-id',
          email: 'admin@example.com',
          role: 'admin',
        }
      );
    });

    it('should update team event with valid capacity', async () => {
      const mockUpdatedEvent = {
        ...createMockEventItem(),
        isTeamEvent: true,
        requiredParticipants: 4,
        maxParticipants: 20,
      };
      const updateData = { maxParticipants: 24 }; // Valid multiple of 4

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockUpdatedEvent);
    });

    it('should silently ignore immutable fields like slug and organizerId', async () => {
      const mockUpdatedEvent = createMockEventItem();
      const updateData = {
        title: 'Updated Title',
        slug: 'new-slug', // Should be ignored
        organizerId: 'different-organizer-id', // Should be ignored
        eventId: 'different-event-id', // Should be ignored
        creatorId: 'different-creator-id', // Should be ignored
        createdAt: '2023-01-01T00:00:00Z', // Should be ignored
        currentParticipants: 999, // Should be ignored
      };

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockUpdatedEvent);

      // Service should be called with the update data (service handles filtering)
      expect(mockEventService.updateEvent).toHaveBeenCalledWith(
        'test-event-id',
        updateData,
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should allow admin to update isFeatured field', async () => {
      const mockUpdatedEvent = {
        ...createMockEventItem(),
        isFeatured: true,
      };
      const updateData = {
        title: 'Updated Title',
        isFeatured: true,
      };

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          role: 'admin',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockUpdatedEvent);
    });
  });

  describe('validation errors', () => {
    it('should return 400 when eventId is missing', async () => {
      const event = createMockEvent('', {
        body: JSON.stringify(createValidUpdateData()),
      });
      event.pathParameters = {};

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Event ID is required');
    });

    it('should return 400 when request body is missing', async () => {
      const event = createMockEvent('test-event-id', {
        body: undefined,
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Request body is required');
    });

    it('should return 400 when request body is invalid JSON', async () => {
      const event = createMockEvent('test-event-id', {
        body: 'invalid json',
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Invalid JSON in request body');
    });

    it('should return 400 when user is not authenticated', async () => {
      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(createValidUpdateData()),
        user: undefined,
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('User authentication required');
    });

    it('should return 400 when user id is missing', async () => {
      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(createValidUpdateData()),
        user: {
          id: '',
          email: 'test@example.com',
          role: 'organizer',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('User authentication required');
    });
  });

  describe('service errors', () => {
    it('should handle NotFoundError when event does not exist', async () => {
      mockEventService.updateEvent.mockRejectedValue(
        new NotFoundError('Event not found')
      );

      const event = createMockEvent('nonexistent-event-id', {
        body: JSON.stringify(createValidUpdateData()),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Event not found');
    });

    it('should handle ForbiddenError when user does not own event', async () => {
      mockEventService.updateEvent.mockRejectedValue(
        new ForbiddenError('You can only update events you created')
      );

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(createValidUpdateData()),
        user: {
          id: 'different-user-id',
          email: 'different@example.com',
          role: 'organizer',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('You can only update events you created');
    });

    it('should handle BadRequestError for team event validation', async () => {
      mockEventService.updateEvent.mockRejectedValue(
        new BadRequestError('For team events, maxParticipants (15) must be a multiple of requiredParticipants (4)')
      );

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify({ maxParticipants: 15 }),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('maxParticipants (15) must be a multiple of requiredParticipants (4)');
    });

    it('should handle BadRequestError for maxParticipants reduction below current registrations', async () => {
      mockEventService.updateEvent.mockRejectedValue(
        new BadRequestError('Cannot reduce maxParticipants (50) below current registrations (75)')
      );

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify({ maxParticipants: 50 }),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Cannot reduce maxParticipants (50) below current registrations (75)');
    });

    it('should handle generic service errors', async () => {
      mockEventService.updateEvent.mockRejectedValue(
        new Error('Database connection error')
      );

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(createValidUpdateData()),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Database connection error');
    });
  });

  describe('edge cases', () => {
    it('should handle empty update data object', async () => {
      const mockUpdatedEvent = createMockEventItem();
      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify({}),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockUpdatedEvent);

      expect(mockEventService.updateEvent).toHaveBeenCalledWith(
        'test-event-id',
        {},
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should handle null values in update data', async () => {
      const updateData = {
        title: 'Valid Title',
        description: null as any,
      };

      mockEventService.updateEvent.mockRejectedValue(
        new BadRequestError('Description must be a string')
      );

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Description must be a string');
    });

    it('should handle zero registrationFee', async () => {
      const mockUpdatedEvent = {
        ...createMockEventItem(),
        registrationFee: 0,
      };
      const updateData = { registrationFee: 0 };

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.event.registrationFee).toBe(0);
    });

    it('should handle empty tags array', async () => {
      const mockUpdatedEvent = {
        ...createMockEventItem(),
        tags: [],
      };
      const updateData = { tags: [] };

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.event.tags).toEqual([]);
    });

    it('should handle boolean fields correctly', async () => {
      const mockUpdatedEvent = {
        ...createMockEventItem(),
        isEnabled: false,
        isRelay: true,
      };
      const updateData = {
        isEnabled: false,
        isRelay: true,
      };

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.event.isEnabled).toBe(false);
      expect(responseBody.data.event.isRelay).toBe(true);
    });
  });

  describe('organizer relationship validation', () => {
    it('should maintain organizer relationship by ignoring organizerId in updates', async () => {
      const mockUpdatedEvent = createMockEventItem();
      const updateData = {
        title: 'Updated Title',
        organizerId: 'different-organizer-id', // Should be silently ignored
      };

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockUpdatedEvent);
      // The organizerId should remain unchanged (handled by service layer)
      expect(responseBody.data.event.organizerId).toBe('org_01ARZ3NDEKTSV4RRFFQ69G5FAV');
    });
  });

  describe('team event validation', () => {
    it('should validate team event capacity during updates', async () => {
      mockEventService.updateEvent.mockRejectedValue(
        new BadRequestError('For team events, maxParticipants (15) must be a multiple of requiredParticipants (4). Suggested values: 12 or 16')
      );

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify({ maxParticipants: 15 }),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('maxParticipants (15) must be a multiple of requiredParticipants (4)');
      expect(responseBody.error).toContain('Suggested values: 12 or 16');
    });

    it('should allow valid team event capacity updates', async () => {
      const mockUpdatedEvent = {
        ...createMockEventItem(),
        isTeamEvent: true,
        requiredParticipants: 4,
        maxParticipants: 16,
      };
      const updateData = { maxParticipants: 16 };

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.event.maxParticipants).toBe(16);
    });
  });

  describe('admin privileges', () => {
    it('should allow admin to update isFeatured field', async () => {
      const mockUpdatedEvent = {
        ...createMockEventItem(),
        isFeatured: true,
      };
      const updateData = { isFeatured: true };

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          role: 'admin',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.event.isFeatured).toBe(true);
    });

    it('should silently ignore isFeatured field for non-admin users', async () => {
      const mockUpdatedEvent = {
        ...createMockEventItem(),
        isFeatured: false, // Should remain false
      };
      const updateData = {
        title: 'Updated Title',
        isFeatured: true, // Should be ignored for non-admin
      };

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent('test-event-id', {
        body: JSON.stringify(updateData),
        user: {
          id: 'regular-user-id',
          email: 'regular@example.com',
          role: 'organizer',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.event.isFeatured).toBe(false);
    });
  });
});