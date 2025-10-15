import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { eventService } from '../../services/event.service';
import { handler } from '../createEvent';
import { AuthenticatedEvent } from '@/shared/auth/middleware';
import { BadRequestError } from '@/shared/errors';

// Mock environment variables
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';

// Mock the event service
jest.mock('@/features/events/services/event.service');
const mockEventService = eventService as jest.Mocked<typeof eventService>;

// Mock the auth middleware
jest.mock('@/shared/auth/middleware', () => ({
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
  overrides: Partial<AuthenticatedEvent> = {}
): AuthenticatedEvent => ({
  version: '2.0',
  routeKey: 'POST /events',
  rawPath: '/events',
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
      method: 'POST',
      path: '/events',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'POST /events',
    stage: 'test',
    time: '01/Jan/2024:00:00:00 +0000',
    timeEpoch: 1704067200000,
  },
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

// Helper function to create valid event data
const createValidEventData = () => ({
  organizerId: 'org_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  title: 'Test Marathon',
  type: 'running',
  date: '2024-12-01T10:00:00Z',
  isTeamEvent: false,
  requiredParticipants: 1,
  maxParticipants: 100,
  location: 'Central Park, New York',
  description: 'Annual marathon event in Central Park',
  distance: '42.2km',
  registrationFee: 50,
  registrationDeadline: '2024-11-25T23:59:59Z',
  image: 'https://example.com/marathon.jpg',
  difficulty: 'intermediate',
  tags: ['running', 'marathon', 'fitness'],
});

describe('createEvent handler', () => {
  describe('successful event creation', () => {
    it('should create event with valid data', async () => {
      // Mock successful event creation
      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        organizerId: 'org_01ARZ3NDEKTSV4RRFFQ69G5FAV',
        title: 'Test Marathon',
        type: 'running',
        date: '2024-12-01T10:00:00Z',
        isFeatured: false,
        isTeamEvent: false,
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
        slug: 'test-marathon',
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(createValidEventData()),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockEvent);

      // Verify service was called with correct parameters
      expect(mockEventService.createEvent).toHaveBeenCalledWith(
        createValidEventData(),
        'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should create team event with valid data', async () => {
      const teamEventData = {
        ...createValidEventData(),
        isTeamEvent: true,
        requiredParticipants: 4,
        maxParticipants: 20,
      };

      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        ...teamEventData,
        currentParticipants: 0,
        slug: 'test-marathon',
        isFeatured: false,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(teamEventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockEvent);
    });

    it('should create event with optional fields', async () => {
      const eventDataWithOptionals = {
        ...createValidEventData(),
        isRelay: true,
        isFeatured: true, // Should be ignored
      };

      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        ...eventDataWithOptionals,
        isFeatured: false, // Should always be false
        currentParticipants: 0,
        slug: 'test-marathon',
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(eventDataWithOptionals),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockEvent);
    });
  });

  describe('validation errors', () => {
    it('should return 400 when request body is missing', async () => {
      const event = createMockEvent({
        body: undefined,
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Request body is required');
    });

    it('should return 400 when request body is invalid JSON', async () => {
      const event = createMockEvent({
        body: 'invalid json',
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Invalid JSON in request body');
    });

    it('should return 400 when title is missing', async () => {
      const eventData = { ...createValidEventData() };
      delete (eventData as any).title;

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Event title is required');
    });

    it('should auto-inject organizerId when not provided', async () => {
      const eventData = { ...createValidEventData() };
      delete (eventData as any).organizerId;

      const { organizerId: _, ...eventDataWithoutOrganizerId } = eventData;
      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        organizerId: 'org_auto_injected_123', // Auto-injected organizerId
        ...eventDataWithoutOrganizerId,
        currentParticipants: 0,
        slug: 'test-marathon',
        isFeatured: false,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockEvent);
      expect(responseBody.data.event.organizerId).toBe('org_auto_injected_123');

      // Verify service was called with data without organizerId
      expect(mockEventService.createEvent).toHaveBeenCalledWith(
        eventData, // eventData without organizerId
        'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should return 400 when type is missing', async () => {
      const eventData = { ...createValidEventData() };
      delete (eventData as any).type;

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Event type is required');
    });

    it('should return 400 when date is missing', async () => {
      const eventData = { ...createValidEventData() };
      delete (eventData as any).date;

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Event date is required');
    });

    it('should return 400 when isTeamEvent is not a boolean', async () => {
      const eventData = { ...createValidEventData(), isTeamEvent: 'true' as any };

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('isTeamEvent must be a boolean');
    });

    it('should return 400 when requiredParticipants is not a positive number', async () => {
      const eventData = { ...createValidEventData(), requiredParticipants: 0 };

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('requiredParticipants must be a positive number');
    });

    it('should return 400 when requiredParticipants is not a number', async () => {
      const eventData = { ...createValidEventData(), requiredParticipants: '5' as any };

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('requiredParticipants must be a positive number');
    });

    it('should return 400 when maxParticipants is not a positive number', async () => {
      const eventData = { ...createValidEventData(), maxParticipants: -1 };

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('maxParticipants must be a positive number');
    });

    it('should return 400 when location is missing', async () => {
      const eventData = { ...createValidEventData() };
      delete (eventData as any).location;

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Event location is required');
    });

    it('should return 400 when description is missing', async () => {
      const eventData = { ...createValidEventData() };
      delete (eventData as any).description;

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Event description is required');
    });

    it('should return 400 when distance is missing', async () => {
      const eventData = { ...createValidEventData() };
      delete (eventData as any).distance;

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Event distance is required');
    });

    it('should return 400 when registrationFee is negative', async () => {
      const eventData = { ...createValidEventData(), registrationFee: -10 };

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('registrationFee must be a non-negative number');
    });

    it('should return 400 when registrationFee is not a number', async () => {
      const eventData = { ...createValidEventData(), registrationFee: '50' as any };

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('registrationFee must be a non-negative number');
    });

    it('should return 400 when registrationDeadline is missing', async () => {
      const eventData = { ...createValidEventData() };
      delete (eventData as any).registrationDeadline;

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('registrationDeadline is required');
    });

    it('should return 400 when image is missing', async () => {
      const eventData = { ...createValidEventData() };
      delete (eventData as any).image;

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Event image is required');
    });

    it('should return 400 when difficulty is missing', async () => {
      const eventData = { ...createValidEventData() };
      delete (eventData as any).difficulty;

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Event difficulty is required');
    });

    it('should return 400 when user is not authenticated', async () => {
      const event = createMockEvent({
        body: JSON.stringify(createValidEventData()),
        user: undefined,
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('User authentication required');
    });

    it('should return 400 when user id is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify(createValidEventData()),
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
    it('should handle service errors gracefully', async () => {
      mockEventService.createEvent.mockRejectedValue(new Error('Service error'));

      const event = createMockEvent({
        body: JSON.stringify(createValidEventData()),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Service error');
    });

    it('should handle BadRequestError from service', async () => {
      mockEventService.createEvent.mockRejectedValue(new BadRequestError('Invalid organizer'));

      const event = createMockEvent({
        body: JSON.stringify(createValidEventData()),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Invalid organizer');
    });

    it('should return 400 when auto-injection fails (no organizer profile)', async () => {
      const eventData = { ...createValidEventData() };
      delete (eventData as any).organizerId;

      mockEventService.createEvent.mockRejectedValue(
        new BadRequestError('No organizer profile found for user. Please create an organizer profile first or provide a valid organizerId.')
      );

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('No organizer profile found for user');
    });
  });

  describe('edge cases', () => {
    it('should handle zero registrationFee', async () => {
      const eventData = { ...createValidEventData(), registrationFee: 0 };

      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        ...eventData,
        currentParticipants: 0,
        slug: 'test-marathon',
        isFeatured: false,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.registrationFee).toBe(0);
    });

    it('should handle empty tags array', async () => {
      const eventData = { ...createValidEventData(), tags: [] };

      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        ...eventData,
        currentParticipants: 0,
        slug: 'test-marathon',
        isFeatured: false,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.tags).toEqual([]);
    });

    it('should handle missing tags field', async () => {
      const eventData = { ...createValidEventData() };
      delete (eventData as any).tags;

      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        ...eventData,
        tags: [],
        currentParticipants: 0,
        slug: 'test-marathon',
        isFeatured: false,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockEvent);
    });
  });

  describe('admin user scenarios', () => {
    it('should create event for admin user', async () => {
      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'admin_user_id',
        ...createValidEventData(),
        currentParticipants: 0,
        slug: 'test-marathon',
        isFeatured: false,
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(createValidEventData()),
        user: {
          id: 'admin_user_id',
          email: 'admin@example.com',
          role: 'admin',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockEvent);

      // Verify service was called with admin user
      expect(mockEventService.createEvent).toHaveBeenCalledWith(
        createValidEventData(),
        'admin_user_id',
        {
          id: 'admin_user_id',
          email: 'admin@example.com',
          role: 'admin',
        }
      );
    });
  });
});