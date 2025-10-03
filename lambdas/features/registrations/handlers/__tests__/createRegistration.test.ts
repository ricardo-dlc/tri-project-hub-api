import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { isValidULID } from '../../../../shared/utils/ulid';
import { individualRegistrationService } from '../../services/individual-registration.service';
import { teamRegistrationService } from '../../services/team-registration.service';
import { handler } from '../createRegistration';

// Mock the registration services
jest.mock('../../services/individual-registration.service');
jest.mock('../../services/team-registration.service');
const mockIndividualRegistrationService = individualRegistrationService as jest.Mocked<typeof individualRegistrationService>;
const mockTeamRegistrationService = teamRegistrationService as jest.Mocked<typeof teamRegistrationService>;

// Mock ULID validation
jest.mock('../../../../shared/utils/ulid');
const mockIsValidULID = isValidULID as jest.MockedFunction<typeof isValidULID>;

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
  routeKey: 'POST /events/{eventId}/registrations',
  rawPath: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV/registrations',
  rawQueryString: '',
  headers: {
    'Content-Type': 'application/json',
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
      method: 'POST',
      path: '/events/01ARZ3NDEKTSV4RRFFQ69G5FAV/registrations',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'POST /events/{eventId}/registrations',
    stage: 'test',
    time: '01/Jan/2023:00:00:00 +0000',
    timeEpoch: 1672531200000,
  },
  isBase64Encoded: false,
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

// Valid individual registration data
const validIndividualRegistrationData = {
  email: 'individual@example.com',
  firstName: 'John',
  lastName: 'Doe',
  waiver: true,
  newsletter: false,
  phone: '+1234567890',
  shirtSize: 'M',
};

// Valid team registration data
const validTeamRegistrationData = {
  participants: [
    {
      email: 'participant1@example.com',
      firstName: 'John',
      lastName: 'Doe',
      waiver: true,
      newsletter: false,
      role: 'swimmer',
    },
    {
      email: 'participant2@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      waiver: true,
      newsletter: true,
      role: 'cyclist',
    },
  ],
};

// Mock successful individual registration result
const mockIndividualRegistrationResult = {
  reservationId: '01ARZ3NDEKTSV4RRFFQ69G5FBW',
  participantId: '01ARZ3NDEKTSV4RRFFQ69G5FBX',
  eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  email: 'individual@example.com',
  paymentStatus: false,
  registrationFee: 50.00,
  createdAt: '2023-01-01T00:00:00.000Z',
};

// Mock successful team registration result
const mockTeamRegistrationResult = {
  reservationId: '01ARZ3NDEKTSV4RRFFQ69G5FBW',
  eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  participants: [
    {
      participantId: '01ARZ3NDEKTSV4RRFFQ69G5FBX',
      email: 'participant1@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'swimmer',
    },
    {
      participantId: '01ARZ3NDEKTSV4RRFFQ69G5FBY',
      email: 'participant2@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'cyclist',
    },
  ],
  paymentStatus: false,
  registrationFee: 100.00,
  totalParticipants: 2,
  createdAt: '2023-01-01T00:00:00.000Z',
};

describe('Unified Registration Handler', () => {
  describe('Individual Registration Detection and Processing', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
      mockIndividualRegistrationService.registerIndividual.mockResolvedValue(mockIndividualRegistrationResult);
    });

    it('should detect and process individual registration successfully', async () => {
      const event = createMockEvent({
        body: JSON.stringify(validIndividualRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      const parsedBody = JSON.parse(result.body);
      
      expect(parsedBody.success).toBe(true);
      expect(parsedBody.data.registrationType).toBe('individual');
      expect(parsedBody.data.message).toBe('Individual registration created successfully');
      expect(parsedBody.data.reservationId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FBW');
      expect(parsedBody.data.participantId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FBX');

      expect(mockIndividualRegistrationService.registerIndividual).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        expect.objectContaining(validIndividualRegistrationData)
      );
      expect(mockTeamRegistrationService.registerTeam).not.toHaveBeenCalled();
    });

    it('should handle individual registration with minimal required fields', async () => {
      const minimalData = {
        email: 'minimal@example.com',
        firstName: 'Min',
        lastName: 'Imal',
        waiver: true,
        newsletter: false,
      };

      const event = createMockEvent({
        body: JSON.stringify(minimalData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.data.registrationType).toBe('individual');

      expect(mockIndividualRegistrationService.registerIndividual).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        expect.objectContaining(minimalData)
      );
    });
  });

  describe('Team Registration Detection and Processing', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
      mockTeamRegistrationService.registerTeam.mockResolvedValue(mockTeamRegistrationResult);
    });

    it('should detect and process team registration successfully', async () => {
      const event = createMockEvent({
        body: JSON.stringify(validTeamRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      const parsedBody = JSON.parse(result.body);
      
      expect(parsedBody.success).toBe(true);
      expect(parsedBody.data.registrationType).toBe('team');
      expect(parsedBody.data.message).toBe('Team registration created successfully');
      expect(parsedBody.data.reservationId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FBW');
      expect(parsedBody.data.totalParticipants).toBe(2);
      expect(parsedBody.data.participants).toHaveLength(2);

      expect(mockTeamRegistrationService.registerTeam).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        validTeamRegistrationData
      );
      expect(mockIndividualRegistrationService.registerIndividual).not.toHaveBeenCalled();
    });

    it('should handle team registration with single participant', async () => {
      const singleParticipantTeam = {
        participants: [
          {
            email: 'solo@example.com',
            firstName: 'Solo',
            lastName: 'Player',
            waiver: true,
            newsletter: false,
            role: 'athlete',
          },
        ],
      };

      const singleParticipantResult = {
        ...mockTeamRegistrationResult,
        participants: [mockTeamRegistrationResult.participants[0]],
        totalParticipants: 1,
        registrationFee: 50.00,
      };

      mockTeamRegistrationService.registerTeam.mockResolvedValue(singleParticipantResult);

      const event = createMockEvent({
        body: JSON.stringify(singleParticipantTeam),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.data.registrationType).toBe('team');
      expect(parsedBody.data.totalParticipants).toBe(1);

      expect(mockTeamRegistrationService.registerTeam).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        singleParticipantTeam
      );
    });
  });

  describe('Registration Type Detection Edge Cases', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should return 422 for ambiguous request body (has both individual fields and participants)', async () => {
      const ambiguousData = {
        // Individual fields
        email: 'individual@example.com',
        firstName: 'John',
        lastName: 'Doe',
        waiver: true,
        newsletter: false,
        // Team field
        participants: [
          {
            email: 'participant@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
            waiver: true,
            newsletter: true,
            role: 'athlete',
          },
        ],
      };

      const event = createMockEvent({
        body: JSON.stringify(ambiguousData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201); // Should be treated as team registration
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.data.registrationType).toBe('team');
    });

    it('should return 422 for invalid registration format (neither individual nor team)', async () => {
      const invalidData = {
        // Missing required fields for both types
        someField: 'value',
        anotherField: 123,
      };

      const event = createMockEvent({
        body: JSON.stringify(invalidData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toContain('Invalid registration format');
    });

    it('should return 422 for empty participants array in team registration', async () => {
      const emptyTeamData = {
        participants: [],
      };

      const event = createMockEvent({
        body: JSON.stringify(emptyTeamData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Team registration must include at least one participant');
    });

    it('should return 422 for non-array participants field', async () => {
      const invalidTeamData = {
        participants: 'not-an-array',
      };

      const event = createMockEvent({
        body: JSON.stringify(invalidTeamData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Participants must be an array');
    });
  });

  describe('Path Parameter Validation', () => {
    it('should return 400 for missing eventId parameter', async () => {
      const event = createMockEvent({
        pathParameters: undefined,
        body: JSON.stringify(validIndividualRegistrationData),
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
        pathParameters: { eventId: 'invalid-ulid' },
        body: JSON.stringify(validIndividualRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Invalid eventId format. Must be a valid ULID.');
    });
  });

  describe('Request Body Validation', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should return 400 for missing request body', async () => {
      const event = createMockEvent({
        body: undefined,
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Request body is required');
    });

    it('should return 400 for invalid JSON in request body', async () => {
      const event = createMockEvent({
        body: 'invalid-json{',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Invalid JSON in request body');
    });

    it('should return 422 for array request body', async () => {
      const event = createMockEvent({
        body: '[]',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Request body must be a valid JSON object');
    });

    it('should return 422 for null request body', async () => {
      const event = createMockEvent({
        body: 'null',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Request body must be a valid JSON object');
    });
  });

  describe('Individual Registration Validation', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should return 422 for individual registration missing required fields', async () => {
      const incompleteData = {
        email: 'test@example.com',
        firstName: 'John',
        // Missing lastName, waiver, newsletter
      };

      const event = createMockEvent({
        body: JSON.stringify(incompleteData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toContain('Missing required fields');
      expect(parsedBody.error.details.missingFields).toEqual(['lastName', 'waiver', 'newsletter']);
    });

    it('should return 422 for individual registration with invalid field types', async () => {
      const invalidData = {
        email: 123, // Should be string
        firstName: 'John',
        lastName: 'Doe',
        waiver: true,
        newsletter: false,
      };

      const event = createMockEvent({
        body: JSON.stringify(invalidData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Email must be a string');
    });
  });

  describe('Team Registration Validation', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should return 422 for team participant missing required fields', async () => {
      const incompleteTeamData = {
        participants: [
          {
            email: 'test@example.com',
            firstName: 'John',
            // Missing lastName, role, waiver, newsletter
          },
        ],
      };

      const event = createMockEvent({
        body: JSON.stringify(incompleteTeamData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toContain('Participant at index 0 is missing required fields');
      expect(parsedBody.error.details.missingFields).toEqual(['lastName', 'role']);
    });

    it('should return 422 for duplicate emails within team', async () => {
      const duplicateEmailTeam = {
        participants: [
          {
            email: 'duplicate@example.com',
            firstName: 'John',
            lastName: 'Doe',
            waiver: true,
            newsletter: false,
            role: 'swimmer',
          },
          {
            email: 'duplicate@example.com', // Same email
            firstName: 'Jane',
            lastName: 'Smith',
            waiver: true,
            newsletter: true,
            role: 'cyclist',
          },
        ],
      };

      const event = createMockEvent({
        body: JSON.stringify(duplicateEmailTeam),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Team registration contains duplicate email addresses');
      expect(parsedBody.error.details.duplicateEmails).toEqual(['duplicate@example.com']);
    });
  });

  describe('Service Integration', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should handle individual registration service errors', async () => {
      const { ConflictError } = require('../../../../shared/errors');
      const conflictError = new ConflictError('Email already registered for this event');

      mockIndividualRegistrationService.registerIndividual.mockRejectedValue(conflictError);

      const event = createMockEvent({
        body: JSON.stringify(validIndividualRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(409);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Email already registered for this event');
    });

    it('should handle team registration service errors', async () => {
      const { ConflictError } = require('../../../../shared/errors');
      const capacityError = new ConflictError('Event has reached maximum capacity');

      mockTeamRegistrationService.registerTeam.mockRejectedValue(capacityError);

      const event = createMockEvent({
        body: JSON.stringify(validTeamRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(409);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Event has reached maximum capacity');
    });
  });

  describe('Response Format Consistency', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should return consistent response structure for individual registration', async () => {
      mockIndividualRegistrationService.registerIndividual.mockResolvedValue(mockIndividualRegistrationResult);

      const event = createMockEvent({
        body: JSON.stringify(validIndividualRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      const parsedBody = JSON.parse(result.body);
      
      expect(parsedBody).toHaveProperty('success', true);
      expect(parsedBody).toHaveProperty('data');
      expect(parsedBody.data).toHaveProperty('registrationType', 'individual');
      expect(parsedBody.data).toHaveProperty('reservationId');
      expect(parsedBody.data).toHaveProperty('participantId');
      expect(parsedBody.data).toHaveProperty('message');
    });

    it('should return consistent response structure for team registration', async () => {
      mockTeamRegistrationService.registerTeam.mockResolvedValue(mockTeamRegistrationResult);

      const event = createMockEvent({
        body: JSON.stringify(validTeamRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      const parsedBody = JSON.parse(result.body);
      
      expect(parsedBody).toHaveProperty('success', true);
      expect(parsedBody).toHaveProperty('data');
      expect(parsedBody.data).toHaveProperty('registrationType', 'team');
      expect(parsedBody.data).toHaveProperty('reservationId');
      expect(parsedBody.data).toHaveProperty('participants');
      expect(parsedBody.data).toHaveProperty('totalParticipants');
      expect(parsedBody.data).toHaveProperty('message');
    });

    it('should include CORS headers in all responses', async () => {
      mockIndividualRegistrationService.registerIndividual.mockResolvedValue(mockIndividualRegistrationResult);

      const event = createMockEvent({
        body: JSON.stringify(validIndividualRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
    });
  });
});