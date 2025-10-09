import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { eventService } from '../../services/event.service';
import { organizerService } from '../../services/organizer.service';
import { handler } from '../getEventBySlug';

// Mock environment variables
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';

// Mock the event service
jest.mock('../../services/event.service');
const mockEventService = eventService as jest.Mocked<typeof eventService>;

// Mock the organizer service
jest.mock('../../services/organizer.service');
const mockOrganizerService = organizerService as jest.Mocked<typeof organizerService>;

// Mock the shared middleware
jest.mock('../../../../shared', () => ({
  withMiddleware: (handlerFn: any) => async (event: any, context: any) => {
    try {
      const result = await handlerFn(event, context);
      return {
        statusCode: result.statusCode || 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: result.body || result,
        }),
      };
    } catch (error: any) {
      // Use the error's statusCode if it exists, otherwise default based on error name
      let statusCode = error.statusCode || 500;
      let errorCode = error.code || 'INTERNAL_SERVER_ERROR';
      
      // Fallback for errors without statusCode property
      if (!error.statusCode) {
        if (error.name === 'NotFoundError') {
          statusCode = 404;
          errorCode = 'NOT_FOUND';
        } else if (error.name === 'BadRequestError') {
          statusCode = 400;
          errorCode = 'BAD_REQUEST';
        }
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
    readonly statusCode = 400;
    readonly code = 'BAD_REQUEST';
    constructor(message: string) {
      super(message);
      this.name = 'BadRequestError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    readonly statusCode = 404;
    readonly code = 'NOT_FOUND';
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
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
  routeKey: 'GET /events/slug/{slug}',
  rawPath: '/events/slug/test-event-slug',
  rawQueryString: '',
  headers: {
    'content-type': 'application/json',
  },
  pathParameters: {
    slug: 'test-event-slug',
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    domainName: 'test.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'test',
    http: {
      method: 'GET',
      path: '/events/slug/test-event-slug',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'GET /events/slug/{slug}',
    stage: 'test',
    time: '01/Jan/2024:00:00:00 +0000',
    timeEpoch: 1704067200000,
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

describe('getEventBySlug handler', () => {
  describe('successful event retrieval', () => {
    it('should get event by slug with organizer data', async () => {
      // Mock event data
      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        title: 'Test Event',
        slug: 'test-event-slug',
        type: 'triathlon',
        date: '2024-06-15T09:00:00.000Z',
        isFeatured: false,
        isTeamEvent: false,
        requiredParticipants: 1,
        maxParticipants: 100,
        currentParticipants: 0,
        location: 'Test Location',
        description: 'Test event description',
        distance: '5km',
        registrationFee: 50,
        registrationDeadline: '2024-06-10T23:59:59.000Z',
        image: 'https://example.com/image.jpg',
        difficulty: 'beginner',
        tags: ['test', 'triathlon'],
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Mock organizer data
      const mockOrganizer = {
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        clerkId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        name: 'Test Organizer',
        contact: 'test@example.com',
        website: 'https://example.com',
        description: 'Test organizer description',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.getEventBySlug.mockResolvedValue(mockEvent);
      mockOrganizerService.getOrganizer.mockResolvedValue(mockOrganizer);

      const event = createMockEvent();
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockEvent);
      expect(responseBody.data.organizer).toEqual(mockOrganizer);

      // Verify services were called with correct parameters
      expect(mockEventService.getEventBySlug).toHaveBeenCalledWith('test-event-slug');
      expect(mockOrganizerService.getOrganizer).toHaveBeenCalledWith('01ARZ3NDEKTSV4RRFFQ69G5FAW');
    });

    it('should handle events with minimal organizer data', async () => {
      // Mock event data
      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        title: 'Test Event',
        slug: 'test-event-slug',
        type: 'triathlon',
        date: '2024-06-15T09:00:00.000Z',
        isFeatured: false,
        isTeamEvent: false,
        requiredParticipants: 1,
        maxParticipants: 100,
        currentParticipants: 0,
        location: 'Test Location',
        description: 'Test event description',
        distance: '5km',
        registrationFee: 50,
        registrationDeadline: '2024-06-10T23:59:59.000Z',
        image: 'https://example.com/image.jpg',
        difficulty: 'beginner',
        tags: ['test', 'triathlon'],
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Mock organizer data with minimal fields
      const mockOrganizer = {
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        clerkId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        name: 'Test Organizer',
        contact: 'test@example.com',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.getEventBySlug.mockResolvedValue(mockEvent);
      mockOrganizerService.getOrganizer.mockResolvedValue(mockOrganizer);

      const event = createMockEvent();
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockEvent);
      expect(responseBody.data.organizer).toEqual(mockOrganizer);
    });

    it('should handle team events with organizer data', async () => {
      // Mock team event data
      const mockTeamEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        title: 'Team Triathlon Event',
        slug: 'team-triathlon-event',
        type: 'triathlon',
        date: '2024-06-15T09:00:00.000Z',
        isFeatured: true,
        isTeamEvent: true,
        isRelay: true,
        requiredParticipants: 3,
        maxParticipants: 60, // 20 teams of 3
        currentParticipants: 12, // 4 teams registered
        location: 'Team Event Location',
        description: 'Team triathlon event description',
        distance: '10km',
        registrationFee: 150,
        registrationDeadline: '2024-06-10T23:59:59.000Z',
        image: 'https://example.com/team-image.jpg',
        difficulty: 'intermediate',
        tags: ['team', 'triathlon', 'relay'],
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Mock organizer data
      const mockOrganizer = {
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        clerkId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        name: 'Team Event Organizer',
        contact: 'team@example.com',
        website: 'https://teamevents.com',
        description: 'Specialized in team triathlon events',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.getEventBySlug.mockResolvedValue(mockTeamEvent);
      mockOrganizerService.getOrganizer.mockResolvedValue(mockOrganizer);

      const event = createMockEvent({
        pathParameters: { slug: 'team-triathlon-event' },
        rawPath: '/events/slug/team-triathlon-event',
      });
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockTeamEvent);
      expect(responseBody.data.organizer).toEqual(mockOrganizer);

      // Verify services were called with correct parameters
      expect(mockEventService.getEventBySlug).toHaveBeenCalledWith('team-triathlon-event');
      expect(mockOrganizerService.getOrganizer).toHaveBeenCalledWith('01ARZ3NDEKTSV4RRFFQ69G5FAW');
    });
  });

  describe('validation errors', () => {
    it('should return 400 when slug is missing from path parameters', async () => {
      const event = createMockEvent({
        pathParameters: {},
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Missing slug parameter');
      expect(responseBody.error.code).toBe('BAD_REQUEST');

      // Verify services were not called
      expect(mockEventService.getEventBySlug).not.toHaveBeenCalled();
      expect(mockOrganizerService.getOrganizer).not.toHaveBeenCalled();
    });

    it('should return 400 when slug is null', async () => {
      const event = createMockEvent({
        pathParameters: { slug: null },
      } as any);

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Missing slug parameter');
    });

    it('should return 400 when slug is undefined', async () => {
      const event = createMockEvent({
        pathParameters: { slug: undefined },
      } as any);

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Missing slug parameter');
    });

    it('should return 400 when pathParameters is null', async () => {
      const event = createMockEvent({
        pathParameters: null as any,
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Missing slug parameter');
    });
  });

  describe('service errors', () => {
    it('should return 404 when event is not found', async () => {
      // Import the mocked NotFoundError from the shared module
      const { NotFoundError } = require('../../../../shared');
      const notFoundError = new NotFoundError('Event not found');
      mockEventService.getEventBySlug.mockRejectedValue(notFoundError);

      const event = createMockEvent();
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(404);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Event not found');

      // Verify event service was called but organizer service was not
      expect(mockEventService.getEventBySlug).toHaveBeenCalledWith('test-event-slug');
      expect(mockOrganizerService.getOrganizer).not.toHaveBeenCalled();
    });

    it('should return 404 when organizer is not found', async () => {
      // Mock event data
      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        title: 'Test Event',
        slug: 'test-event-slug',
        type: 'triathlon',
        date: '2024-06-15T09:00:00.000Z',
        isFeatured: false,
        isTeamEvent: false,
        requiredParticipants: 1,
        maxParticipants: 100,
        currentParticipants: 0,
        location: 'Test Location',
        description: 'Test event description',
        distance: '5km',
        registrationFee: 50,
        registrationDeadline: '2024-06-10T23:59:59.000Z',
        image: 'https://example.com/image.jpg',
        difficulty: 'beginner',
        tags: ['test', 'triathlon'],
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Import the mocked NotFoundError from the shared module
      const { NotFoundError } = require('../../../../shared');
      const notFoundError = new NotFoundError('Organizer with ID 01ARZ3NDEKTSV4RRFFQ69G5FAW not found');

      mockEventService.getEventBySlug.mockResolvedValue(mockEvent);
      mockOrganizerService.getOrganizer.mockRejectedValue(notFoundError);

      const event = createMockEvent();
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(404);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Organizer with ID 01ARZ3NDEKTSV4RRFFQ69G5FAW not found');

      // Verify both services were called
      expect(mockEventService.getEventBySlug).toHaveBeenCalledWith('test-event-slug');
      expect(mockOrganizerService.getOrganizer).toHaveBeenCalledWith('01ARZ3NDEKTSV4RRFFQ69G5FAW');
    });

    it('should return 500 when event service throws unexpected error', async () => {
      const unexpectedError = new Error('Database connection failed');
      mockEventService.getEventBySlug.mockRejectedValue(unexpectedError);

      const event = createMockEvent();
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(500);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Database connection failed');

      // Verify event service was called but organizer service was not
      expect(mockEventService.getEventBySlug).toHaveBeenCalledWith('test-event-slug');
      expect(mockOrganizerService.getOrganizer).not.toHaveBeenCalled();
    });

    it('should return 500 when organizer service throws unexpected error', async () => {
      // Mock event data
      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        title: 'Test Event',
        slug: 'test-event-slug',
        type: 'triathlon',
        date: '2024-06-15T09:00:00.000Z',
        isFeatured: false,
        isTeamEvent: false,
        requiredParticipants: 1,
        maxParticipants: 100,
        currentParticipants: 0,
        location: 'Test Location',
        description: 'Test event description',
        distance: '5km',
        registrationFee: 50,
        registrationDeadline: '2024-06-10T23:59:59.000Z',
        image: 'https://example.com/image.jpg',
        difficulty: 'beginner',
        tags: ['test', 'triathlon'],
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const unexpectedError = new Error('Organizer service unavailable');
      mockEventService.getEventBySlug.mockResolvedValue(mockEvent);
      mockOrganizerService.getOrganizer.mockRejectedValue(unexpectedError);

      const event = createMockEvent();
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(500);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Organizer service unavailable');

      // Verify both services were called
      expect(mockEventService.getEventBySlug).toHaveBeenCalledWith('test-event-slug');
      expect(mockOrganizerService.getOrganizer).toHaveBeenCalledWith('01ARZ3NDEKTSV4RRFFQ69G5FAW');
    });
  });

  describe('edge cases', () => {
    it('should handle empty slug parameter', async () => {
      const event = createMockEvent({
        pathParameters: { slug: '' },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Missing slug parameter');
    });

    it('should handle slug with special characters', async () => {
      // Mock event data with special characters in slug
      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        title: 'Test Event with Special Characters!',
        slug: 'test-event-with-special-characters',
        type: 'triathlon',
        date: '2024-06-15T09:00:00.000Z',
        isFeatured: false,
        isTeamEvent: false,
        requiredParticipants: 1,
        maxParticipants: 100,
        currentParticipants: 0,
        location: 'Test Location',
        description: 'Test event description',
        distance: '5km',
        registrationFee: 50,
        registrationDeadline: '2024-06-10T23:59:59.000Z',
        image: 'https://example.com/image.jpg',
        difficulty: 'beginner',
        tags: ['test', 'triathlon'],
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Mock organizer data
      const mockOrganizer = {
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        clerkId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        name: 'Test Organizer',
        contact: 'test@example.com',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.getEventBySlug.mockResolvedValue(mockEvent);
      mockOrganizerService.getOrganizer.mockResolvedValue(mockOrganizer);

      const event = createMockEvent({
        pathParameters: { slug: 'test-event-with-special-characters' },
        rawPath: '/events/slug/test-event-with-special-characters',
      });
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockEvent);
      expect(responseBody.data.organizer).toEqual(mockOrganizer);

      // Verify services were called with correct parameters
      expect(mockEventService.getEventBySlug).toHaveBeenCalledWith('test-event-with-special-characters');
      expect(mockOrganizerService.getOrganizer).toHaveBeenCalledWith('01ARZ3NDEKTSV4RRFFQ69G5FAW');
    });

    it('should handle very long slug', async () => {
      const longSlug = 'very-long-event-slug-that-might-be-generated-from-a-very-long-event-title-with-many-words-and-details';
      
      // Mock event data with long slug
      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        title: 'Very Long Event Title That Might Be Generated From A Very Long Event Title With Many Words And Details',
        slug: longSlug,
        type: 'triathlon',
        date: '2024-06-15T09:00:00.000Z',
        isFeatured: false,
        isTeamEvent: false,
        requiredParticipants: 1,
        maxParticipants: 100,
        currentParticipants: 0,
        location: 'Test Location',
        description: 'Test event description',
        distance: '5km',
        registrationFee: 50,
        registrationDeadline: '2024-06-10T23:59:59.000Z',
        image: 'https://example.com/image.jpg',
        difficulty: 'beginner',
        tags: ['test', 'triathlon'],
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Mock organizer data
      const mockOrganizer = {
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        clerkId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        name: 'Test Organizer',
        contact: 'test@example.com',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.getEventBySlug.mockResolvedValue(mockEvent);
      mockOrganizerService.getOrganizer.mockResolvedValue(mockOrganizer);

      const event = createMockEvent({
        pathParameters: { slug: longSlug },
        rawPath: `/events/slug/${longSlug}`,
      });
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockEvent);
      expect(responseBody.data.organizer).toEqual(mockOrganizer);

      // Verify services were called with correct parameters
      expect(mockEventService.getEventBySlug).toHaveBeenCalledWith(longSlug);
      expect(mockOrganizerService.getOrganizer).toHaveBeenCalledWith('01ARZ3NDEKTSV4RRFFQ69G5FAW');
    });
  });

  describe('response structure validation', () => {
    it('should return response with correct structure and both event and organizer data', async () => {
      // Mock event data
      const mockEvent = {
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        title: 'Test Event',
        slug: 'test-event-slug',
        type: 'triathlon',
        date: '2024-06-15T09:00:00.000Z',
        isFeatured: false,
        isTeamEvent: false,
        requiredParticipants: 1,
        maxParticipants: 100,
        currentParticipants: 0,
        location: 'Test Location',
        description: 'Test event description',
        distance: '5km',
        registrationFee: 50,
        registrationDeadline: '2024-06-10T23:59:59.000Z',
        image: 'https://example.com/image.jpg',
        difficulty: 'beginner',
        tags: ['test', 'triathlon'],
        isEnabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Mock organizer data
      const mockOrganizer = {
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        clerkId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        name: 'Test Organizer',
        contact: 'test@example.com',
        website: 'https://example.com',
        description: 'Test organizer description',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockEventService.getEventBySlug.mockResolvedValue(mockEvent);
      mockOrganizerService.getOrganizer.mockResolvedValue(mockOrganizer);

      const event = createMockEvent();
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toEqual({ 'Content-Type': 'application/json' });

      const responseBody = JSON.parse(result.body);
      
      // Validate response structure
      expect(responseBody).toHaveProperty('success', true);
      expect(responseBody).toHaveProperty('data');
      expect(responseBody.data).toHaveProperty('event');
      expect(responseBody.data).toHaveProperty('organizer');
      
      // Validate event data structure
      expect(responseBody.data.event).toMatchObject({
        eventId: expect.any(String),
        creatorId: expect.any(String),
        organizerId: expect.any(String),
        title: expect.any(String),
        slug: expect.any(String),
        type: expect.any(String),
        date: expect.any(String),
        isFeatured: expect.any(Boolean),
        isTeamEvent: expect.any(Boolean),
        requiredParticipants: expect.any(Number),
        maxParticipants: expect.any(Number),
        currentParticipants: expect.any(Number),
        location: expect.any(String),
        description: expect.any(String),
        distance: expect.any(String),
        registrationFee: expect.any(Number),
        registrationDeadline: expect.any(String),
        image: expect.any(String),
        difficulty: expect.any(String),
        tags: expect.any(Array),
        isEnabled: expect.any(Boolean),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      
      // Validate organizer data structure
      expect(responseBody.data.organizer).toMatchObject({
        organizerId: expect.any(String),
        clerkId: expect.any(String),
        name: expect.any(String),
        contact: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Validate that organizerId matches between event and organizer
      expect(responseBody.data.event.organizerId).toBe(responseBody.data.organizer.organizerId);
    });
  });
});