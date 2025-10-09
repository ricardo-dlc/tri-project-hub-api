// Mock environment variables FIRST
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';

import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { AuthenticatedEvent } from '../../../../shared/auth/middleware';

// Mock the event service
const mockEventService = {
  deleteEvent: jest.fn(),
};

jest.mock('../../services', () => ({
  eventService: mockEventService,
}));

// Mock the auth middleware
jest.mock('../../../../shared/auth/middleware', () => ({
  withAuth: (handlerFn: any) => handlerFn,
}));

// Mock the shared middleware
jest.mock('../../../../shared', () => ({
  withMiddleware: (handlerFn: any) => async (event: any, context: any) => {
    try {
      const result = await handlerFn(event, context);
      return {
        statusCode: result.statusCode || 200,
        headers: { 'Content-Type': 'application/json' },
        body: result.body ? JSON.stringify(result.body) : null,
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
  ConflictError: class ConflictError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConflictError';
    }
  },
}));

import { handler } from '../deleteEvent';

// Get the mocked error classes
const { BadRequestError, ForbiddenError, NotFoundError, ConflictError } = jest.requireMock('../../../../shared');

// Type for API Gateway v2 response
interface APIGatewayProxyResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  body: string | null;
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
  routeKey: 'DELETE /events/{eventId}',
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
      method: 'DELETE',
      path: `/events/${eventId}`,
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'DELETE /events/{eventId}',
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

describe('deleteEvent handler', () => {
  describe('successful event deletion', () => {
    it('should delete event successfully when user is the creator', async () => {
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent('test-event-id');
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();

      // Verify service was called with correct parameters
      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        'test-event-id',
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should allow admin to delete any event', async () => {
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent('test-event-id', {
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          role: 'admin',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        'test-event-id',
        {
          id: 'admin-user-id',
          email: 'admin@example.com',
          role: 'admin',
        }
      );
    });

    it('should delete event with different eventId formats', async () => {
      const ulidEventId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent(ulidEventId);
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        ulidEventId,
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });
  });

  describe('validation errors', () => {
    it('should return 400 when eventId is missing', async () => {
      const event = createMockEvent('');
      event.pathParameters = {};

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('Event ID is required');

      // Verify service was not called
      expect(mockEventService.deleteEvent).not.toHaveBeenCalled();
    });

    it('should return 400 when eventId is empty string', async () => {
      const event = createMockEvent('');
      event.pathParameters = { eventId: '' };

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('Event ID is required');

      expect(mockEventService.deleteEvent).not.toHaveBeenCalled();
    });

    it('should return 400 when user is not authenticated', async () => {
      const event = createMockEvent('test-event-id', {
        user: undefined,
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('User authentication required');

      expect(mockEventService.deleteEvent).not.toHaveBeenCalled();
    });

    it('should return 400 when user id is missing', async () => {
      const event = createMockEvent('test-event-id', {
        user: {
          id: '',
          email: 'test@example.com',
          role: 'organizer',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('User authentication required');

      expect(mockEventService.deleteEvent).not.toHaveBeenCalled();
    });

    it('should return 400 when user id is null', async () => {
      const event = createMockEvent('test-event-id', {
        user: {
          id: null as any,
          email: 'test@example.com',
          role: 'organizer',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('User authentication required');

      expect(mockEventService.deleteEvent).not.toHaveBeenCalled();
    });
  });

  describe('service errors', () => {
    it('should handle NotFoundError when event does not exist', async () => {
      mockEventService.deleteEvent.mockRejectedValue(
        new NotFoundError('Event not found')
      );

      const event = createMockEvent('nonexistent-event-id');
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('Event not found');

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        'nonexistent-event-id',
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should handle ForbiddenError when user does not own event', async () => {
      mockEventService.deleteEvent.mockRejectedValue(
        new ForbiddenError('You can only modify events you created')
      );

      const event = createMockEvent('test-event-id', {
        user: {
          id: 'different-user-id',
          email: 'different@example.com',
          role: 'organizer',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('You can only modify events you created');

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        'test-event-id',
        {
          id: 'different-user-id',
          email: 'different@example.com',
          role: 'organizer',
        }
      );
    });

    it('should handle ConflictError when event has existing registrations', async () => {
      mockEventService.deleteEvent.mockRejectedValue(
        new ConflictError('Cannot delete event with existing registrations. Please contact participants to cancel their registrations first.')
      );

      const event = createMockEvent('test-event-id');
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('Cannot delete event with existing registrations');
      expect(responseBody.error).toContain('Please contact participants to cancel their registrations first');

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        'test-event-id',
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should handle ConflictError with detailed registration information', async () => {
      mockEventService.deleteEvent.mockRejectedValue(
        new ConflictError('Cannot delete event with existing registrations. Please contact participants to cancel their registrations first.')
      );

      const event = createMockEvent('test-event-id');
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('Cannot delete event with existing registrations');
    });

    it('should handle generic service errors', async () => {
      mockEventService.deleteEvent.mockRejectedValue(
        new Error('Database connection error')
      );

      const event = createMockEvent('test-event-id');
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('Database connection error');

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        'test-event-id',
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should handle BadRequestError for invalid event ID format', async () => {
      mockEventService.deleteEvent.mockRejectedValue(
        new BadRequestError('Invalid event ID format. Must be a valid ULID.')
      );

      const event = createMockEvent('invalid-event-id-format');
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('Invalid event ID format. Must be a valid ULID.');
    });
  });

  describe('edge cases', () => {
    it('should handle pathParameters being null', async () => {
      const event = createMockEvent('test-event-id');
      event.pathParameters = null as any;

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('Event ID is required');

      expect(mockEventService.deleteEvent).not.toHaveBeenCalled();
    });

    it('should handle pathParameters being undefined', async () => {
      const event = createMockEvent('test-event-id');
      event.pathParameters = undefined;

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('Event ID is required');

      expect(mockEventService.deleteEvent).not.toHaveBeenCalled();
    });

    it('should handle very long event IDs', async () => {
      const longEventId = 'a'.repeat(100);
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent(longEventId);
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        longEventId,
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should handle special characters in event ID', async () => {
      const specialEventId = 'event-123_test.id';
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent(specialEventId);
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        specialEventId,
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });
  });

  describe('user roles and permissions', () => {
    it('should allow organizer role to delete their own events', async () => {
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent('test-event-id', {
        user: {
          id: 'organizer-user-id',
          email: 'organizer@example.com',
          role: 'organizer',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        'test-event-id',
        {
          id: 'organizer-user-id',
          email: 'organizer@example.com',
          role: 'organizer',
        }
      );
    });

    it('should allow admin role to delete any event', async () => {
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent('test-event-id', {
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          role: 'admin',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        'test-event-id',
        {
          id: 'admin-user-id',
          email: 'admin@example.com',
          role: 'admin',
        }
      );
    });

    it('should handle user with missing role', async () => {
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent('test-event-id', {
        user: {
          id: 'user-without-role',
          email: 'user@example.com',
          role: undefined as any,
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        'test-event-id',
        {
          id: 'user-without-role',
          email: 'user@example.com',
          role: undefined,
        }
      );
    });

    it('should handle user with missing email', async () => {
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent('test-event-id', {
        user: {
          id: 'user-without-email',
          email: undefined as any,
          role: 'organizer',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        'test-event-id',
        {
          id: 'user-without-email',
          email: undefined,
          role: 'organizer',
        }
      );
    });
  });

  describe('registration dependency scenarios', () => {
    it('should prevent deletion when event has individual registrations', async () => {
      mockEventService.deleteEvent.mockRejectedValue(
        new ConflictError('Cannot delete event with existing registrations. Please contact participants to cancel their registrations first.')
      );

      const event = createMockEvent('test-event-id');
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('Cannot delete event with existing registrations');
    });

    it('should prevent deletion when event has team registrations', async () => {
      mockEventService.deleteEvent.mockRejectedValue(
        new ConflictError('Cannot delete event with existing registrations. Please contact participants to cancel their registrations first.')
      );

      const event = createMockEvent('test-event-id');
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('Cannot delete event with existing registrations');
    });

    it('should prevent deletion when event has mixed registration types', async () => {
      mockEventService.deleteEvent.mockRejectedValue(
        new ConflictError('Cannot delete event with existing registrations. Please contact participants to cancel their registrations first.')
      );

      const event = createMockEvent('test-event-id');
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error).toContain('Cannot delete event with existing registrations');
    });

    it('should allow deletion when event has no registrations', async () => {
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent('test-event-id');
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();
    });
  });

  describe('logging and audit trail', () => {
    it('should log deletion by regular user', async () => {
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent('test-event-id', {
        user: {
          id: 'regular-user-id',
          email: 'regular@example.com',
          role: 'organizer',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();

      // Verify the service was called (which handles internal logging)
      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        'test-event-id',
        {
          id: 'regular-user-id',
          email: 'regular@example.com',
          role: 'organizer',
        }
      );
    });

    it('should log deletion by admin user', async () => {
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent('test-event-id', {
        user: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          role: 'admin',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();

      // Verify the service was called (which handles internal logging)
      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        'test-event-id',
        {
          id: 'admin-user-id',
          email: 'admin@example.com',
          role: 'admin',
        }
      );
    });
  });
});
