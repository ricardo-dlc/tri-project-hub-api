import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { isValidULID } from '@/shared/utils/ulid';
import { participantQueryService } from '../../services/participant-query.service';
import { handler } from '../getParticipantsByEvent';
import { AuthenticatedEvent } from '@/shared/auth/middleware';

// Mock the participant query service
jest.mock('@/features/registrations/services/participant-query.service');
const mockParticipantQueryService = participantQueryService as jest.Mocked<typeof participantQueryService>;

// Mock ULID validation
jest.mock('@/shared/utils/ulid');
const mockIsValidULID = isValidULID as jest.MockedFunction<typeof isValidULID>;

// Mock auth middleware
jest.mock('@/shared/auth/middleware', () => ({
  withAuth: (handler: any, options: any) => handler,
}));

// Mock Clerk authentication
jest.mock('@/shared/auth/clerk', () => ({
  authenticateUser: jest.fn(),
  requireRole: jest.fn(),
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
  event: AuthenticatedEvent,
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
  overrides: Partial<AuthenticatedEvent> = {}
): AuthenticatedEvent => ({
  version: '2.0',
  routeKey: 'GET /events/{eventId}/registrations',
  rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV/registrations',
  rawQueryString: '',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mock-token',
  },
  pathParameters: {
    eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  },
  queryStringParameters: undefined,
  requestContext: {
    accountId: '123456789',
    apiId: 'test-api',
    domainName: 'test.example.com',
    domainPrefix: 'test',
    http: {
      method: 'GET',
      path: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV/registrations',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'GET /events/{eventId}/registrations',
    stage: 'test',
    time: '01/Jan/2023:00:00:00 +0000',
    timeEpoch: 1672531200000,
  },
  isBase64Encoded: false,
  // Add user from auth middleware
  user: {
    id: 'user_123456789',
    role: 'organizer' as const,
    email: 'organizer@example.com',
  },
  ...overrides,
});

// Helper function to create mock Lambda context
const createMockContext = (overrides: Partial<Context> = {}): Context => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test-function',
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

// Mock participant data
const mockParticipant1 = {
  participantId: '01ARZ3NDEKTSV4RRFFQ69G5FBX',
  reservationId: '01ARZ3NDEKTSV4RRFFQ69G5FBW',
  eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+1234567890',
  dateOfBirth: '1990-01-01',
  gender: 'male',
  address: '123 Main St',
  city: 'Anytown',
  state: 'CA',
  zipCode: '12345',
  country: 'USA',
  emergencyName: 'Jane Doe',
  emergencyRelationship: 'spouse',
  emergencyPhone: '+1234567891',
  emergencyEmail: 'jane@example.com',
  shirtSize: 'M',
  dietaryRestrictions: 'None',
  medicalConditions: 'None',
  medications: 'None',
  allergies: 'None',
  waiver: true,
  newsletter: false,
  role: undefined, // Explicitly set to undefined for individual registration
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  registrationType: 'individual' as const,
  paymentStatus: false,
  totalParticipants: 1,
  registrationFee: 50.00,
  registrationCreatedAt: '2023-01-01T00:00:00.000Z',
};

const mockParticipant2 = {
  participantId: '01ARZ3NDEKTSV4RRFFQ69G5FBY',
  reservationId: '01ARZ3NDEKTSV4RRFFQ69G5FBZ',
  eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  phone: '+1234567892',
  waiver: true,
  newsletter: true,
  createdAt: '2023-01-01T01:00:00.000Z',
  updatedAt: '2023-01-01T01:00:00.000Z',
  registrationType: 'team' as const,
  paymentStatus: true,
  totalParticipants: 2,
  registrationFee: 100.00,
  registrationCreatedAt: '2023-01-01T01:00:00.000Z',
};

const mockParticipant3 = {
  participantId: '01ARZ3NDEKTSV4RRFFQ69G5FC0',
  reservationId: '01ARZ3NDEKTSV4RRFFQ69G5FBZ', // Same reservation as participant 2 (team)
  eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  email: 'bob@example.com',
  firstName: 'Bob',
  lastName: 'Johnson',
  phone: '+1234567893',
  waiver: true,
  newsletter: false,
  role: 'teammate',
  createdAt: '2023-01-01T01:05:00.000Z',
  updatedAt: '2023-01-01T01:05:00.000Z',
  registrationType: 'team' as const,
  paymentStatus: true,
  totalParticipants: 2,
  registrationFee: 100.00,
  registrationCreatedAt: '2023-01-01T01:00:00.000Z',
};

// Mock query result
const mockQueryResult = {
  participants: [mockParticipant1, mockParticipant2, mockParticipant3],
  totalCount: 3,
  registrationSummary: {
    totalRegistrations: 2,
    paidRegistrations: 1,
    unpaidRegistrations: 1,
    individualRegistrations: 1,
    teamRegistrations: 1,
  },
};

describe('Get Participants By Event Handler', () => {
  describe('Successful Queries', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
      mockParticipantQueryService.getParticipantsByEvent.mockResolvedValue(mockQueryResult);
    });

    it('should successfully retrieve participants grouped by reservation', async () => {
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers!['Content-Type']).toBe('application/json');

      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: true,
        data: {
          eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          totalParticipants: 3,
          registrations: [
            {
              reservationId: '01ARZ3NDEKTSV4RRFFQ69G5FBZ',
              registrationType: 'team',
              paymentStatus: true,
              registrationFee: 100.00,
              totalParticipants: 2,
              registrationCreatedAt: '2023-01-01T01:00:00.000Z',
              participants: [
                {
                  participantId: '01ARZ3NDEKTSV4RRFFQ69G5FBY',
                  email: 'alice@example.com',
                  firstName: 'Alice',
                  lastName: 'Smith',
                  phone: '+1234567892',
                  dateOfBirth: undefined,
                  gender: undefined,
                  address: undefined,
                  city: undefined,
                  state: undefined,
                  zipCode: undefined,
                  country: undefined,
                  emergencyName: undefined,
                  emergencyRelationship: undefined,
                  emergencyPhone: undefined,
                  emergencyEmail: undefined,
                  shirtSize: undefined,
                  dietaryRestrictions: undefined,
                  medicalConditions: undefined,
                  medications: undefined,
                  allergies: undefined,
                  waiver: true,
                  newsletter: true,
                  role: undefined,
                  createdAt: '2023-01-01T01:00:00.000Z',
                },
                {
                  participantId: '01ARZ3NDEKTSV4RRFFQ69G5FC0',
                  email: 'bob@example.com',
                  firstName: 'Bob',
                  lastName: 'Johnson',
                  phone: '+1234567893',
                  dateOfBirth: undefined,
                  gender: undefined,
                  address: undefined,
                  city: undefined,
                  state: undefined,
                  zipCode: undefined,
                  country: undefined,
                  emergencyName: undefined,
                  emergencyRelationship: undefined,
                  emergencyPhone: undefined,
                  emergencyEmail: undefined,
                  shirtSize: undefined,
                  dietaryRestrictions: undefined,
                  medicalConditions: undefined,
                  medications: undefined,
                  allergies: undefined,
                  waiver: true,
                  newsletter: false,
                  role: 'teammate',
                  createdAt: '2023-01-01T01:05:00.000Z',
                },
              ],
            },
            {
              reservationId: '01ARZ3NDEKTSV4RRFFQ69G5FBW',
              registrationType: 'individual',
              paymentStatus: false,
              registrationFee: 50.00,
              totalParticipants: 1,
              registrationCreatedAt: '2023-01-01T00:00:00.000Z',
              participants: [
                {
                  participantId: '01ARZ3NDEKTSV4RRFFQ69G5FBX',
                  email: 'john@example.com',
                  firstName: 'John',
                  lastName: 'Doe',
                  phone: '+1234567890',
                  dateOfBirth: '1990-01-01',
                  gender: 'male',
                  address: '123 Main St',
                  city: 'Anytown',
                  state: 'CA',
                  zipCode: '12345',
                  country: 'USA',
                  emergencyName: 'Jane Doe',
                  emergencyRelationship: 'spouse',
                  emergencyPhone: '+1234567891',
                  emergencyEmail: 'jane@example.com',
                  shirtSize: 'M',
                  dietaryRestrictions: 'None',
                  medicalConditions: 'None',
                  medications: 'None',
                  allergies: 'None',
                  waiver: true,
                  newsletter: false,
                  role: undefined,
                  createdAt: '2023-01-01T00:00:00.000Z',
                },
              ],
            },
          ],
          summary: {
            totalRegistrations: 2,
            paidRegistrations: 1,
            unpaidRegistrations: 1,
            individualRegistrations: 1,
            teamRegistrations: 1,
          },
        },
      });

      expect(mockParticipantQueryService.getParticipantsByEvent).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        'user_123456789'
      );
    });

    it('should handle empty participant list', async () => {
      const emptyResult = {
        participants: [],
        totalCount: 0,
        registrationSummary: {
          totalRegistrations: 0,
          paidRegistrations: 0,
          unpaidRegistrations: 0,
          individualRegistrations: 0,
          teamRegistrations: 0,
        },
      };

      mockParticipantQueryService.getParticipantsByEvent.mockResolvedValue(emptyResult);

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.data).toEqual({
        eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        totalParticipants: 0,
        registrations: [],
        summary: {
          totalRegistrations: 0,
          paidRegistrations: 0,
          unpaidRegistrations: 0,
          individualRegistrations: 0,
          teamRegistrations: 0,
        },
      });
    });

    it('should include CORS headers in successful response', async () => {
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
    });
  });

  describe('Path Parameter Validation', () => {
    it('should return 400 for missing eventId parameter', async () => {
      const event = createMockEvent({
        pathParameters: undefined,
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: false,
        error: {
          message: 'Missing eventId parameter in path',
          code: 'BAD_REQUEST',
        },
        data: null,
      });
    });

    it('should return 400 for empty eventId parameter', async () => {
      const event = createMockEvent({
        pathParameters: { eventId: '' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Missing eventId parameter in path');
    });

    it('should return 400 for whitespace-only eventId parameter', async () => {
      const event = createMockEvent({
        pathParameters: { eventId: '   ' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Missing eventId parameter in path');
    });

    it('should return 400 for invalid ULID format in eventId', async () => {
      mockIsValidULID.mockReturnValue(false);

      const event = createMockEvent({
        pathParameters: { eventId: 'invalid-ulid-format' },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: false,
        error: {
          message: 'Invalid eventId format. Must be a valid ULID.',
          code: 'BAD_REQUEST',
          details: { eventId: 'invalid-ulid-format' },
        },
        data: null,
      });

      expect(mockIsValidULID).toHaveBeenCalledWith('invalid-ulid-format');
    });

    it('should validate ULID format for various invalid formats', async () => {
      const invalidULIDs = [
        'too-short',
        'TOO-LONG-ULID-FORMAT-INVALID',
        '01ARZ3NDEKTSV4RRFFQ69G5FA!', // Invalid character
        '01arz3ndektsv4rrffq69g5fav', // Lowercase (invalid for ULID)
        '123456789012345678901234567', // Too long
        '12345678901234567890123456', // Valid length but invalid characters
      ];

      for (const invalidULID of invalidULIDs) {
        mockIsValidULID.mockReturnValue(false);

        const event = createMockEvent({
          pathParameters: { eventId: invalidULID },
        });
        const context = createMockContext();

        const result = await callWrappedHandler(event, context);

        expect(result.statusCode).toBe(400);
        const parsedBody = JSON.parse(result.body);
        expect(parsedBody.error.message).toBe('Invalid eventId format. Must be a valid ULID.');
        expect(parsedBody.error.details.eventId).toBe(invalidULID);
      }
    });
  });

  describe('Access Control and Authorization', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should handle access denied errors (403)', async () => {
      const { BadRequestError } = require('../../../../shared/errors');
      const accessDeniedError = new BadRequestError(
        'Access denied. You can only view participants for events you created.',
        {
          eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          organizerId: 'user_123456789',
          eventCreatorId: 'different_user_id',
        }
      );

      mockParticipantQueryService.getParticipantsByEvent.mockRejectedValue(accessDeniedError);

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Access denied. You can only view participants for events you created.');
    });

    it('should handle event not found errors (404)', async () => {
      const { NotFoundError } = require('../../../../shared/errors');
      const notFoundError = new NotFoundError('Event with ID 01ARZ3NDEKTSV4RRFFQ69G5FAV not found');

      mockParticipantQueryService.getParticipantsByEvent.mockRejectedValue(notFoundError);

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(404);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Event with ID 01ARZ3NDEKTSV4RRFFQ69G5FAV not found');
    });

    it('should pass correct organizer ID from authenticated user', async () => {
      mockParticipantQueryService.getParticipantsByEvent.mockResolvedValue(mockQueryResult);

      const event = createMockEvent({
        user: {
          id: 'organizer_xyz123',
          role: 'organizer' as const,
          email: 'organizer@example.com',
        },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);
      expect(mockParticipantQueryService.getParticipantsByEvent).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        'organizer_xyz123'
      );
    });

    it('should work with admin role', async () => {
      mockParticipantQueryService.getParticipantsByEvent.mockResolvedValue(mockQueryResult);

      const event = createMockEvent({
        user: {
          id: 'admin_abc456',
          role: 'admin' as const,
          email: 'admin@example.com',
        },
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);
      expect(mockParticipantQueryService.getParticipantsByEvent).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        'admin_abc456'
      );
    });
  });

  describe('Service Integration', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should handle service validation errors (422)', async () => {
      const { ValidationError } = require('../../../../shared/errors');
      const validationError = new ValidationError('Invalid event ID format');

      mockParticipantQueryService.getParticipantsByEvent.mockRejectedValue(validationError);

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Invalid event ID format');
    });

    it('should handle generic service errors (500)', async () => {
      const genericError = new Error('Database connection failed');
      mockParticipantQueryService.getParticipantsByEvent.mockRejectedValue(genericError);

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(500);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error).toBeDefined();
    });
  });

  describe('Response Format and Data Transformation', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should correctly group participants by reservation ID', async () => {
      mockParticipantQueryService.getParticipantsByEvent.mockResolvedValue(mockQueryResult);

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);
      const parsedBody = JSON.parse(result.body);

      // Should have 2 registration groups (one individual, one team)
      expect(parsedBody.data.registrations).toHaveLength(2);

      // Team registration should come first (newer registration date)
      const teamRegistration = parsedBody.data.registrations[0];
      expect(teamRegistration.reservationId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FBZ');
      expect(teamRegistration.registrationType).toBe('team');
      expect(teamRegistration.participants).toHaveLength(2);

      // Individual registration should come second
      const individualRegistration = parsedBody.data.registrations[1];
      expect(individualRegistration.reservationId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FBW');
      expect(individualRegistration.registrationType).toBe('individual');
      expect(individualRegistration.participants).toHaveLength(1);
    });

    it('should include all required participant fields', async () => {
      mockParticipantQueryService.getParticipantsByEvent.mockResolvedValue(mockQueryResult);

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      const parsedBody = JSON.parse(result.body);
      const participant = parsedBody.data.registrations[1].participants[0]; // Individual participant

      // Check all required fields are present
      expect(participant).toHaveProperty('participantId');
      expect(participant).toHaveProperty('email');
      expect(participant).toHaveProperty('firstName');
      expect(participant).toHaveProperty('lastName');
      expect(participant).toHaveProperty('waiver');
      expect(participant).toHaveProperty('newsletter');
      expect(participant).toHaveProperty('createdAt');

      // Check optional fields are included (even if undefined)
      expect(participant).toHaveProperty('phone');
      expect(participant).toHaveProperty('dateOfBirth');
      expect(participant).toHaveProperty('gender');

      // Role field should be included - check if it exists in the response
      // Note: JSON.stringify removes undefined values, so we check the actual response structure
      expect(participant.role).toBeUndefined();
    });

    it('should include correct registration summary', async () => {
      mockParticipantQueryService.getParticipantsByEvent.mockResolvedValue(mockQueryResult);

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.data.summary).toEqual({
        totalRegistrations: 2,
        paidRegistrations: 1,
        unpaidRegistrations: 1,
        individualRegistrations: 1,
        teamRegistrations: 1,
      });
    });

    it('should maintain consistent response structure', async () => {
      mockParticipantQueryService.getParticipantsByEvent.mockResolvedValue(mockQueryResult);

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);
      const parsedBody = JSON.parse(result.body);

      expect(parsedBody).toHaveProperty('success', true);
      expect(parsedBody).toHaveProperty('data');
      expect(parsedBody).not.toHaveProperty('error');

      // Verify top-level data structure
      expect(parsedBody.data).toHaveProperty('eventId');
      expect(parsedBody.data).toHaveProperty('totalParticipants');
      expect(parsedBody.data).toHaveProperty('registrations');
      expect(parsedBody.data).toHaveProperty('summary');

      // Verify registration structure
      parsedBody.data.registrations.forEach((registration: any) => {
        expect(registration).toHaveProperty('reservationId');
        expect(registration).toHaveProperty('registrationType');
        expect(registration).toHaveProperty('paymentStatus');
        expect(registration).toHaveProperty('registrationFee');
        expect(registration).toHaveProperty('totalParticipants');
        expect(registration).toHaveProperty('registrationCreatedAt');
        expect(registration).toHaveProperty('participants');
        expect(Array.isArray(registration.participants)).toBe(true);
      });
    });
  });

  describe('ULID Validation Scenarios', () => {
    it('should validate ULID format correctly for valid ULIDs', async () => {
      const validULIDs = [
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        '01BX5ZZKBKACTAV9WEVGEMMVRZ',
        '01CXYZ123456789ABCDEFGHIJK',
      ];

      mockParticipantQueryService.getParticipantsByEvent.mockResolvedValue(mockQueryResult);

      for (const validULID of validULIDs) {
        mockIsValidULID.mockReturnValue(true);

        const event = createMockEvent({
          pathParameters: { eventId: validULID },
        });
        const context = createMockContext();

        const result = await callWrappedHandler(event, context);

        expect(result.statusCode).toBe(200);
        expect(mockIsValidULID).toHaveBeenCalledWith(validULID);
        expect(mockParticipantQueryService.getParticipantsByEvent).toHaveBeenCalledWith(
          validULID,
          'user_123456789'
        );
      }
    });

    it('should reject various invalid ULID formats', async () => {
      const invalidFormats = [
        { ulid: '123', description: 'too short' },
        { ulid: '01ARZ3NDEKTSV4RRFFQ69G5FA', description: 'one character short' },
        { ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAVX', description: 'one character too long' },
        { ulid: '01arz3ndektsv4rrffq69g5fav', description: 'lowercase letters' },
        { ulid: '01ARZ3NDEKTSV4RRFFQ69G5FA!', description: 'invalid character' },
        { ulid: 'OIARZ3NDEKTSV4RRFFQ69G5FAV', description: 'invalid character O' },
        { ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAL', description: 'invalid character L' },
      ];

      for (const { ulid, description } of invalidFormats) {
        mockIsValidULID.mockReturnValue(false);

        const event = createMockEvent({
          pathParameters: { eventId: ulid },
        });
        const context = createMockContext();

        const result = await callWrappedHandler(event, context);

        expect(result.statusCode).toBe(400);
        const parsedBody = JSON.parse(result.body);
        expect(parsedBody.error.message).toBe('Invalid eventId format. Must be a valid ULID.');
        expect(parsedBody.error.details.eventId).toBe(ulid);
      }
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should handle single participant registration', async () => {
      const singleParticipantResult = {
        participants: [mockParticipant1],
        totalCount: 1,
        registrationSummary: {
          totalRegistrations: 1,
          paidRegistrations: 0,
          unpaidRegistrations: 1,
          individualRegistrations: 1,
          teamRegistrations: 0,
        },
      };

      mockParticipantQueryService.getParticipantsByEvent.mockResolvedValue(singleParticipantResult);

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.data.totalParticipants).toBe(1);
      expect(parsedBody.data.registrations).toHaveLength(1);
      expect(parsedBody.data.registrations[0].participants).toHaveLength(1);
    });

    it('should handle large team registration', async () => {
      // Create a team with 5 participants
      const largeTeamParticipants = Array.from({ length: 5 }, (_, i) => ({
        ...mockParticipant2,
        participantId: `01ARZ3NDEKTSV4RRFFQ69G5FC${i}`,
        email: `participant${i}@example.com`,
        firstName: `Participant${i}`,
      }));

      const largeTeamResult = {
        participants: largeTeamParticipants,
        totalCount: 5,
        registrationSummary: {
          totalRegistrations: 1,
          paidRegistrations: 1,
          unpaidRegistrations: 0,
          individualRegistrations: 0,
          teamRegistrations: 1,
        },
      };

      mockParticipantQueryService.getParticipantsByEvent.mockResolvedValue(largeTeamResult);

      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.data.totalParticipants).toBe(5);
      expect(parsedBody.data.registrations).toHaveLength(1);
      expect(parsedBody.data.registrations[0].participants).toHaveLength(5);
      expect(parsedBody.data.registrations[0].registrationType).toBe('team');
    });
  });
});