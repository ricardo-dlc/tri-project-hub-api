// Mock environment variables FIRST
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';
process.env.EVENTS_TABLE_NAME = 'test-events-table';

import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { eventService } from '../../services/event.service';
import { organizerService } from '../../services/organizer.service';
import { AuthenticatedEvent } from '../../../../shared/auth/middleware';
import { EventItem, CreateEventData, UpdateEventData } from '../../types/event.types';
import { OrganizerItem } from '../../types/organizer.types';

// Mock the services
jest.mock('../../services/event.service');
jest.mock('../../services/organizer.service');
const mockEventService = eventService as jest.Mocked<typeof eventService>;
const mockOrganizerService = organizerService as jest.Mocked<typeof organizerService>;

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

      return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data,
        }),
      };
    } catch (error: any) {
      let statusCode = 400;
      let errorCode = 'BAD_REQUEST';
      
      if (error.name === 'NotFoundError') {
        statusCode = 404;
        errorCode = 'NOT_FOUND';
      }
      if (error.name === 'ForbiddenError') {
        statusCode = 403;
        errorCode = 'FORBIDDEN';
      }
      if (error.name === 'ConflictError') {
        statusCode = 409;
        errorCode = 'CONFLICT';
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

// Import handlers after mocking
import { handler as createEventHandler } from '../createEvent';
import { handler as updateEventHandler } from '../updateEvent';
import { handler as deleteEventHandler } from '../deleteEvent';
import { handler as getEventBySlugHandler } from '../getEventBySlug';

// Get the mocked error classes
const { BadRequestError, ForbiddenError, NotFoundError, ConflictError } = jest.requireMock('../../../../shared');

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

// Helper function to create valid event data with new model structure
const createValidEventData = (): CreateEventData => ({
  organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', // ULID format
  title: 'Test Marathon Event',
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

// Helper function to create mock event item with new model structure
const createMockEventItem = (overrides: Partial<EventItem> = {}): EventItem => ({
  eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', // ULID format
  creatorId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
  organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW', // ULID format
  title: 'Test Marathon Event',
  slug: 'test-marathon-event', // Generated slug
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

// Helper function to create mock organizer item
const createMockOrganizerItem = (overrides: Partial<OrganizerItem> = {}): OrganizerItem => ({
  organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW', // ULID format
  clerkId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
  name: 'Test Event Organizer',
  contact: 'organizer@example.com',
  website: 'https://testorganizer.com',
  description: 'Professional event organizer specializing in running events',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('Event Handlers Integration Tests - New Model', () => {
  describe('Create Event Handler - New Model Integration', () => {
    it('should create event with ULID-based IDs and organizer relationship', async () => {
      const eventData = createValidEventData();
      const mockEvent = createMockEventItem();

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(createEventHandler, event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockEvent);

      // Verify service was called with correct parameters for new model
      expect(mockEventService.createEvent).toHaveBeenCalledWith(
        eventData,
        'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );

      // Verify new model structure
      expect(mockEvent.eventId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
      expect(mockEvent.organizerId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
      expect(mockEvent.slug).toBe('test-marathon-event');
    });

    it('should create team event with valid capacity validation', async () => {
      const teamEventData: CreateEventData = {
        ...createValidEventData(),
        isTeamEvent: true,
        requiredParticipants: 4,
        maxParticipants: 20, // Valid multiple of 4
      };

      const mockTeamEvent = createMockEventItem({
        isTeamEvent: true,
        requiredParticipants: 4,
        maxParticipants: 20,
      });

      mockEventService.createEvent.mockResolvedValue(mockTeamEvent);

      const event = createMockEvent({
        body: JSON.stringify(teamEventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(createEventHandler, event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.isTeamEvent).toBe(true);
      expect(responseBody.data.event.requiredParticipants).toBe(4);
      expect(responseBody.data.event.maxParticipants).toBe(20);
    });

    it('should handle organizer auto-injection when organizerId not provided', async () => {
      const eventDataWithoutOrganizer = { ...createValidEventData() };
      delete (eventDataWithoutOrganizer as any).organizerId;

      const mockEvent = createMockEventItem({
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAX', // Auto-injected organizer ID
      });

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(eventDataWithoutOrganizer),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(createEventHandler, event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.organizerId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAX');
    });

    it('should validate organizer relationship during creation', async () => {
      const eventData = createValidEventData();

      mockEventService.createEvent.mockRejectedValue(
        new BadRequestError('Organizer with ID 01ARZ3NDEKTSV4RRFFQ69G5FAV not found')
      );

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(createEventHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Organizer with ID 01ARZ3NDEKTSV4RRFFQ69G5FAV not found');
    });

    it('should generate unique slug during event creation', async () => {
      const eventData = createValidEventData();
      const mockEvent = createMockEventItem({
        slug: 'test-marathon-event-2', // Unique slug generated due to collision
      });

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(createEventHandler, event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.slug).toBe('test-marathon-event-2');
    });
  });

  describe('Update Event Handler - New Model Integration', () => {
    it('should update event while preserving organizer relationship', async () => {
      const updateData: UpdateEventData = {
        title: 'Updated Marathon Event',
        description: 'Updated description for the marathon event',
        registrationFee: 75,
      };

      const mockUpdatedEvent = createMockEventItem({
        title: 'Updated Marathon Event',
        description: 'Updated description for the marathon event',
        registrationFee: 75,
        updatedAt: '2024-01-02T00:00:00.000Z',
      });

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent({
        routeKey: 'PUT /events/{eventId}',
        rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV',
        pathParameters: { eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(updateEventHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual(mockUpdatedEvent);

      // Verify organizer relationship is preserved
      expect(responseBody.data.event.organizerId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAW');

      // Verify service was called with correct parameters
      expect(mockEventService.updateEvent).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        updateData,
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should prevent slug modification during update', async () => {
      const updateData = {
        title: 'Updated Title',
        slug: 'new-slug-attempt', // Should be ignored
      } as any;

      const mockUpdatedEvent = createMockEventItem({
        title: 'Updated Title',
        slug: 'test-marathon-event', // Original slug preserved
        updatedAt: '2024-01-02T00:00:00.000Z',
      });

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent({
        routeKey: 'PUT /events/{eventId}',
        rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV',
        pathParameters: { eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(updateEventHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.slug).toBe('test-marathon-event'); // Original slug preserved
      expect(responseBody.data.event.title).toBe('Updated Title');
    });

    it('should validate team event capacity during update', async () => {
      const updateData: UpdateEventData = {
        maxParticipants: 15, // Invalid for team event with requiredParticipants: 4
      };

      mockEventService.updateEvent.mockRejectedValue(
        new BadRequestError('For team events, maxParticipants (15) must be a multiple of requiredParticipants (4)')
      );

      const event = createMockEvent({
        routeKey: 'PUT /events/{eventId}',
        rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV',
        pathParameters: { eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(updateEventHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('maxParticipants (15) must be a multiple of requiredParticipants (4)');
    });

    it('should prevent organizerId modification during update', async () => {
      const updateData = {
        title: 'Updated Title',
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAX', // Should be ignored
      } as any;

      const mockUpdatedEvent = createMockEventItem({
        title: 'Updated Title',
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAW', // Original organizerId preserved
        updatedAt: '2024-01-02T00:00:00.000Z',
      });

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const event = createMockEvent({
        routeKey: 'PUT /events/{eventId}',
        rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV',
        pathParameters: { eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
        body: JSON.stringify(updateData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(updateEventHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.organizerId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAW'); // Original preserved
      expect(responseBody.data.event.title).toBe('Updated Title');
    });

    it('should handle ownership validation with new model', async () => {
      const updateData: UpdateEventData = {
        title: 'Unauthorized Update Attempt',
      };

      mockEventService.updateEvent.mockRejectedValue(
        new ForbiddenError('You can only update events you created')
      );

      const event = createMockEvent({
        routeKey: 'PUT /events/{eventId}',
        rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV',
        pathParameters: { eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
        body: JSON.stringify(updateData),
        user: {
          id: 'different_user_id',
          email: 'different@example.com',
          role: 'organizer',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(updateEventHandler, event, context);

      expect(result.statusCode).toBe(403);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('You can only update events you created');
    });
  });

  describe('Delete Event Handler - New Model Integration', () => {
    it('should delete event with ULID-based ID', async () => {
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent({
        routeKey: 'DELETE /events/{eventId}',
        rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV',
        pathParameters: { eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(deleteEventHandler, event, context);

      expect(result.statusCode).toBe(204);

      // Verify service was called with ULID-based eventId
      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        {
          id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
          email: 'test@example.com',
          role: 'organizer',
        }
      );
    });

    it('should prevent deletion when event has registrations', async () => {
      mockEventService.deleteEvent.mockRejectedValue(
        new ConflictError('Cannot delete event with existing registrations. Please contact participants to cancel their registrations first.')
      );

      const event = createMockEvent({
        routeKey: 'DELETE /events/{eventId}',
        rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV',
        pathParameters: { eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(deleteEventHandler, event, context);

      expect(result.statusCode).toBe(409);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Cannot delete event with existing registrations');
    });

    it('should handle ownership validation during deletion', async () => {
      mockEventService.deleteEvent.mockRejectedValue(
        new ForbiddenError('You can only modify events you created')
      );

      const event = createMockEvent({
        routeKey: 'DELETE /events/{eventId}',
        rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV',
        pathParameters: { eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
        user: {
          id: 'different_user_id',
          email: 'different@example.com',
          role: 'organizer',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(deleteEventHandler, event, context);

      expect(result.statusCode).toBe(403);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('You can only modify events you created');
    });

    it('should allow admin to delete any event', async () => {
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const event = createMockEvent({
        routeKey: 'DELETE /events/{eventId}',
        rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV',
        pathParameters: { eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
        user: {
          id: 'admin_user_id',
          email: 'admin@example.com',
          role: 'admin',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(deleteEventHandler, event, context);

      expect(result.statusCode).toBe(204);

      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        {
          id: 'admin_user_id',
          email: 'admin@example.com',
          role: 'admin',
        }
      );
    });
  });

  describe('Get Event By Slug Handler - New Model Integration', () => {
    it('should retrieve event by slug with organizer data', async () => {
      const mockEvent = createMockEventItem({
        slug: 'test-marathon-event',
      });
      const mockOrganizer = createMockOrganizerItem();

      mockEventService.getEventBySlug.mockResolvedValue(mockEvent);
      mockOrganizerService.getOrganizer.mockResolvedValue(mockOrganizer);

      const event = createMockEvent({
        routeKey: 'GET /events/slug/{slug}',
        rawPath: '/events/slug/test-marathon-event',
        pathParameters: { slug: 'test-marathon-event' },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(getEventBySlugHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event).toEqual({
        ...mockEvent,
        organizer: mockOrganizer,
      });

      // Verify services were called correctly
      expect(mockEventService.getEventBySlug).toHaveBeenCalledWith('test-marathon-event');
      expect(mockOrganizerService.getOrganizer).toHaveBeenCalledWith('01ARZ3NDEKTSV4RRFFQ69G5FAW');

      // Verify organizer relationship
      expect(mockEvent.organizerId).toBe(mockOrganizer.organizerId);
    });

    it('should handle slug with special characters and numbers', async () => {
      const mockEvent = createMockEventItem({
        slug: 'marathon-2024-special-event',
        title: 'Marathon 2024 Special Event!',
      });
      const mockOrganizer = createMockOrganizerItem();

      mockEventService.getEventBySlug.mockResolvedValue(mockEvent);
      mockOrganizerService.getOrganizer.mockResolvedValue(mockOrganizer);

      const event = createMockEvent({
        routeKey: 'GET /events/slug/{slug}',
        rawPath: '/events/slug/marathon-2024-special-event',
        pathParameters: { slug: 'marathon-2024-special-event' },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(getEventBySlugHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.slug).toBe('marathon-2024-special-event');
      expect(responseBody.data.event.title).toBe('Marathon 2024 Special Event!');
    });

    it('should handle team event retrieval with organizer data', async () => {
      const mockTeamEvent = createMockEventItem({
        slug: 'team-triathlon-relay',
        title: 'Team Triathlon Relay',
        isTeamEvent: true,
        isRelay: true,
        requiredParticipants: 3,
        maxParticipants: 30,
      });
      const mockOrganizer = createMockOrganizerItem({
        name: 'Triathlon Team Organizer',
        description: 'Specialized in team triathlon events',
      });

      mockEventService.getEventBySlug.mockResolvedValue(mockTeamEvent);
      mockOrganizerService.getOrganizer.mockResolvedValue(mockOrganizer);

      const event = createMockEvent({
        routeKey: 'GET /events/slug/{slug}',
        rawPath: '/events/slug/team-triathlon-relay',
        pathParameters: { slug: 'team-triathlon-relay' },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(getEventBySlugHandler, event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.isTeamEvent).toBe(true);
      expect(responseBody.data.event.isRelay).toBe(true);
      expect(responseBody.data.event.requiredParticipants).toBe(3);
      expect(responseBody.data.event.maxParticipants).toBe(30);
      expect(responseBody.data.event.organizer.name).toBe('Triathlon Team Organizer');
    });

    it('should return 404 when event slug not found', async () => {
      mockEventService.getEventBySlug.mockRejectedValue(
        new NotFoundError('Event not found')
      );

      const event = createMockEvent({
        routeKey: 'GET /events/slug/{slug}',
        rawPath: '/events/slug/nonexistent-event',
        pathParameters: { slug: 'nonexistent-event' },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(getEventBySlugHandler, event, context);

      expect(result.statusCode).toBe(404);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Event not found');

      expect(mockEventService.getEventBySlug).toHaveBeenCalledWith('nonexistent-event');
      expect(mockOrganizerService.getOrganizer).not.toHaveBeenCalled();
    });

    it('should return 404 when organizer not found for event', async () => {
      const mockEvent = createMockEventItem({
        slug: 'event-with-missing-organizer',
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAX', // Different organizer ID
      });

      mockEventService.getEventBySlug.mockResolvedValue(mockEvent);
      mockOrganizerService.getOrganizer.mockRejectedValue(
        new NotFoundError('Organizer with ID 01ARZ3NDEKTSV4RRFFQ69G5FAX not found')
      );

      const event = createMockEvent({
        routeKey: 'GET /events/slug/{slug}',
        rawPath: '/events/slug/event-with-missing-organizer',
        pathParameters: { slug: 'event-with-missing-organizer' },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(getEventBySlugHandler, event, context);

      expect(result.statusCode).toBe(404);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Organizer with ID 01ARZ3NDEKTSV4RRFFQ69G5FAX not found');

      expect(mockEventService.getEventBySlug).toHaveBeenCalledWith('event-with-missing-organizer');
      expect(mockOrganizerService.getOrganizer).toHaveBeenCalledWith('01ARZ3NDEKTSV4RRFFQ69G5FAX');
    });

    it('should validate slug parameter is provided', async () => {
      const event = createMockEvent({
        routeKey: 'GET /events/slug/{slug}',
        rawPath: '/events/slug/',
        pathParameters: {},
      });

      const context = createMockContext();
      const result = await callWrappedHandler(getEventBySlugHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Missing slug parameter');

      expect(mockEventService.getEventBySlug).not.toHaveBeenCalled();
      expect(mockOrganizerService.getOrganizer).not.toHaveBeenCalled();
    });
  });

  describe('Organizer Relationship Validation Integration', () => {
    it('should validate organizer exists during event creation', async () => {
      const eventData = createValidEventData();

      mockEventService.createEvent.mockRejectedValue(
        new BadRequestError('Organizer with ID 01ARZ3NDEKTSV4RRFFQ69G5FAV not found')
      );

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(createEventHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Organizer with ID 01ARZ3NDEKTSV4RRFFQ69G5FAV not found');
    });

    it('should validate organizer ownership during event creation', async () => {
      const eventData = createValidEventData();

      mockEventService.createEvent.mockRejectedValue(
        new ForbiddenError('You can only use organizers you created')
      );

      const event = createMockEvent({
        body: JSON.stringify(eventData),
        user: {
          id: 'different_user_id',
          email: 'different@example.com',
          role: 'organizer',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(createEventHandler, event, context);

      expect(result.statusCode).toBe(403);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('You can only use organizers you created');
    });

    it('should maintain organizer relationship consistency across operations', async () => {
      const eventData = createValidEventData();
      const mockEvent = createMockEventItem();
      const mockOrganizer = createMockOrganizerItem();

      // Test create event
      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const createEvent = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const createResult = await callWrappedHandler(createEventHandler, createEvent, context);

      expect(createResult.statusCode).toBe(201);
      const createResponseBody = JSON.parse(createResult.body);
      const createdEventId = createResponseBody.data.event.eventId;
      const createdOrganizerId = createResponseBody.data.event.organizerId;

      // Test get event by slug with organizer data
      mockEventService.getEventBySlug.mockResolvedValue(mockEvent);
      mockOrganizerService.getOrganizer.mockResolvedValue(mockOrganizer);

      const getEvent = createMockEvent({
        routeKey: 'GET /events/slug/{slug}',
        rawPath: '/events/slug/test-marathon-event',
        pathParameters: { slug: 'test-marathon-event' },
      });

      const getResult = await callWrappedHandler(getEventBySlugHandler, getEvent, context);

      expect(getResult.statusCode).toBe(200);
      const getResponseBody = JSON.parse(getResult.body);

      // Verify organizer relationship consistency
      expect(getResponseBody.data.event.eventId).toBe(createdEventId);
      expect(getResponseBody.data.event.organizerId).toBe(createdOrganizerId);
      expect(getResponseBody.data.event.organizer.organizerId).toBe(createdOrganizerId);
    });

    it('should handle admin override for organizer validation', async () => {
      const eventData = createValidEventData();
      const mockEvent = createMockEventItem();

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(eventData),
        user: {
          id: 'admin_user_id',
          email: 'admin@example.com',
          role: 'admin',
        },
      });

      const context = createMockContext();
      const result = await callWrappedHandler(createEventHandler, event, context);

      expect(result.statusCode).toBe(201);

      // Verify admin can use any valid organizer
      expect(mockEventService.createEvent).toHaveBeenCalledWith(
        eventData,
        'admin_user_id',
        {
          id: 'admin_user_id',
          email: 'admin@example.com',
          role: 'admin',
        }
      );
    });
  });

  describe('ULID-based Model Integration', () => {
    it('should handle ULID format validation across all operations', async () => {
      const ulidEventId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const ulidOrganizerId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';

      // Test create with ULID organizerId
      const eventData = createValidEventData();
      eventData.organizerId = ulidOrganizerId;

      const mockEvent = createMockEventItem({
        eventId: ulidEventId,
        organizerId: ulidOrganizerId,
      });

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const createEvent = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const createResult = await callWrappedHandler(createEventHandler, createEvent, context);

      expect(createResult.statusCode).toBe(201);
      const createResponseBody = JSON.parse(createResult.body);
      expect(createResponseBody.data.event.eventId).toBe(ulidEventId);
      expect(createResponseBody.data.event.organizerId).toBe(ulidOrganizerId);

      // Test update with ULID eventId
      const updateData: UpdateEventData = { title: 'Updated Title' };
      const mockUpdatedEvent = createMockEventItem({
        eventId: ulidEventId,
        organizerId: ulidOrganizerId,
        title: 'Updated Title',
      });

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const updateEvent = createMockEvent({
        routeKey: 'PUT /events/{eventId}',
        rawPath: `/events/${ulidEventId}`,
        pathParameters: { eventId: ulidEventId },
        body: JSON.stringify(updateData),
      });

      const updateResult = await callWrappedHandler(updateEventHandler, updateEvent, context);

      expect(updateResult.statusCode).toBe(200);
      const updateResponseBody = JSON.parse(updateResult.body);
      expect(updateResponseBody.data.event.eventId).toBe(ulidEventId);

      // Test delete with ULID eventId
      mockEventService.deleteEvent.mockResolvedValue(undefined);

      const deleteEvent = createMockEvent({
        routeKey: 'DELETE /events/{eventId}',
        rawPath: `/events/${ulidEventId}`,
        pathParameters: { eventId: ulidEventId },
      });

      const deleteResult = await callWrappedHandler(deleteEventHandler, deleteEvent, context);

      expect(deleteResult.statusCode).toBe(204);

      // Verify all operations used ULID format
      expect(mockEventService.updateEvent).toHaveBeenCalledWith(ulidEventId, updateData, expect.any(Object));
      expect(mockEventService.deleteEvent).toHaveBeenCalledWith(ulidEventId, expect.any(Object));
    });

    it('should validate ULID format in error scenarios', async () => {
      const invalidEventId = 'invalid-id-format';

      mockEventService.updateEvent.mockRejectedValue(
        new BadRequestError('Invalid event ID format. Must be a valid ULID.')
      );

      const event = createMockEvent({
        routeKey: 'PUT /events/{eventId}',
        rawPath: `/events/${invalidEventId}`,
        pathParameters: { eventId: invalidEventId },
        body: JSON.stringify({ title: 'Test' }),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(updateEventHandler, event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toContain('Invalid event ID format. Must be a valid ULID.');
    });
  });

  describe('Slug Generation and Immutability Integration', () => {
    it('should generate unique slugs and prevent modification', async () => {
      // Test slug generation during creation
      const eventData = createValidEventData();
      eventData.title = 'Special Event with Unique Title!';

      const mockEvent = createMockEventItem({
        title: 'Special Event with Unique Title!',
        slug: 'special-event-with-unique-title',
      });

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const createEvent = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const createResult = await callWrappedHandler(createEventHandler, createEvent, context);

      expect(createResult.statusCode).toBe(201);
      const createResponseBody = JSON.parse(createResult.body);
      expect(createResponseBody.data.event.slug).toBe('special-event-with-unique-title');

      // Test slug immutability during update
      const updateData = {
        title: 'Updated Title',
        slug: 'attempted-new-slug', // Should be ignored
      } as any;

      const mockUpdatedEvent = createMockEventItem({
        title: 'Updated Title',
        slug: 'special-event-with-unique-title', // Original slug preserved
      });

      mockEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const updateEvent = createMockEvent({
        routeKey: 'PUT /events/{eventId}',
        rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV',
        pathParameters: { eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
        body: JSON.stringify(updateData),
      });

      const updateResult = await callWrappedHandler(updateEventHandler, updateEvent, context);

      expect(updateResult.statusCode).toBe(200);
      const updateResponseBody = JSON.parse(updateResult.body);
      expect(updateResponseBody.data.event.slug).toBe('special-event-with-unique-title'); // Original preserved
      expect(updateResponseBody.data.event.title).toBe('Updated Title');
    });

    it('should handle slug collision resolution', async () => {
      const eventData = createValidEventData();
      eventData.title = 'Popular Event Title';

      const mockEvent = createMockEventItem({
        title: 'Popular Event Title',
        slug: 'popular-event-title-2', // Collision resolved with suffix
      });

      mockEventService.createEvent.mockResolvedValue(mockEvent);

      const event = createMockEvent({
        body: JSON.stringify(eventData),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(createEventHandler, event, context);

      expect(result.statusCode).toBe(201);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.event.slug).toBe('popular-event-title-2');
    });
  });
});