import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { isValidULID } from '../../../../shared/utils/ulid';
import { teamRegistrationService } from '../../services/team-registration.service';
import { handler } from '../createTeamRegistration';

// Mock the team registration service
jest.mock('../../services/team-registration.service');
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
  // Call handler with proper signature - modern Lambda runtime supports async handlers
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

// Valid participant data for testing
const validParticipant1 = {
  email: 'participant1@example.com',
  firstName: 'John',
  lastName: 'Doe',
  waiver: true,
  newsletter: false,
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
  role: 'swimmer',
};

const validParticipant2 = {
  email: 'participant2@example.com',
  firstName: 'Jane',
  lastName: 'Smith',
  waiver: true,
  newsletter: true,
  role: 'cyclist',
};

const validParticipant3 = {
  email: 'participant3@example.com',
  firstName: 'Bob',
  lastName: 'Johnson',
  waiver: true,
  newsletter: false,
  role: 'runner',
};

// Valid team registration data
const validTeamRegistrationData = {
  participants: [validParticipant1, validParticipant2, validParticipant3],
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
    {
      participantId: '01ARZ3NDEKTSV4RRFFQ69G5FBZ',
      email: 'participant3@example.com',
      firstName: 'Bob',
      lastName: 'Johnson',
      role: 'runner',
    },
  ],
  paymentStatus: false,
  registrationFee: 150.00,
  totalParticipants: 3,
  createdAt: '2023-01-01T00:00:00.000Z',
};

describe('Create Team Registration Handler', () => {
  describe('Successful Registration', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
      mockTeamRegistrationService.registerTeam.mockResolvedValue(mockTeamRegistrationResult);
    });

    it('should successfully create team registration with all fields', async () => {
      const event = createMockEvent({
        body: JSON.stringify(validTeamRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      expect(result.headers!['Content-Type']).toBe('application/json');

      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: true,
        data: {
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
            {
              participantId: '01ARZ3NDEKTSV4RRFFQ69G5FBZ',
              email: 'participant3@example.com',
              firstName: 'Bob',
              lastName: 'Johnson',
              role: 'runner',
            },
          ],
          paymentStatus: false,
          registrationFee: 150.00,
          totalParticipants: 3,
          createdAt: '2023-01-01T00:00:00.000Z',
          message: 'Team registration created successfully',
        },
      });

      expect(mockTeamRegistrationService.registerTeam).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        validTeamRegistrationData
      );
    });

    it('should successfully create team registration with minimal participant data', async () => {
      const minimalTeamData = {
        participants: [
          {
            email: 'participant1@example.com',
            firstName: 'John',
            lastName: 'Doe',
            waiver: true,
            newsletter: false,
          },
          {
            email: 'participant2@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
            waiver: true,
            newsletter: true,
          },
        ],
      };

      const event = createMockEvent({
        body: JSON.stringify(minimalTeamData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(true);
      expect(parsedBody.data.message).toBe('Team registration created successfully');

      expect(mockTeamRegistrationService.registerTeam).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        minimalTeamData
      );
    });

    it('should include CORS headers in successful response', async () => {
      const event = createMockEvent({
        body: JSON.stringify(validTeamRegistrationData),
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

  describe('Path Parameter Validation', () => {
    it('should return 400 for missing eventId parameter', async () => {
      const event = createMockEvent({
        pathParameters: undefined,
        body: JSON.stringify(validTeamRegistrationData),
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
        body: JSON.stringify(validTeamRegistrationData),
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
        body: JSON.stringify(validTeamRegistrationData),
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
      expect(parsedBody).toEqual({
        success: false,
        error: {
          message: 'Request body is required',
          code: 'BAD_REQUEST',
        },
        data: null,
      });
    });

    it('should return 400 for invalid JSON in request body', async () => {
      const event = createMockEvent({
        body: 'invalid-json{',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: false,
        error: {
          message: 'Invalid JSON in request body',
          code: 'BAD_REQUEST',
        },
        data: null,
      });
    });

    it('should return 422 for missing participants array', async () => {
      const event = createMockEvent({
        body: '{}',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Request body must include participants array');
    });

    it('should return 422 for non-array participants field', async () => {
      const event = createMockEvent({
        body: JSON.stringify({ participants: 'not-an-array' }),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Participants must be an array');
    });

    it('should return 422 for empty participants array', async () => {
      const event = createMockEvent({
        body: JSON.stringify({ participants: [] }),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Team registration must include at least one participant');
    });
  });

  describe('Participant Validation', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should return 422 for participant missing required fields', async () => {
      const incompleteParticipant = {
        participants: [
          {
            email: 'test@example.com',
            firstName: 'John',
            // Missing lastName, waiver, newsletter
          },
        ],
      };

      const event = createMockEvent({
        body: JSON.stringify(incompleteParticipant),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.code).toBe('VALIDATION_ERROR');
      expect(parsedBody.error.message).toContain('Participant at index 0 is missing required fields');
      expect(parsedBody.error.details.missingFields).toEqual(['lastName', 'waiver', 'newsletter']);
    });

    it('should return 422 for participant with invalid field types', async () => {
      const invalidParticipant = {
        participants: [
          {
            email: 123, // Should be string
            firstName: 'John',
            lastName: 'Doe',
            waiver: true,
            newsletter: false,
          },
        ],
      };

      const event = createMockEvent({
        body: JSON.stringify(invalidParticipant),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Participant at index 0: email must be a string');
    });

    it('should validate all participant required field types', async () => {
      const testCases = [
        { field: 'firstName', value: 123, expectedMessage: 'Participant at index 0: firstName must be a string' },
        { field: 'lastName', value: [], expectedMessage: 'Participant at index 0: lastName must be a string' },
        { field: 'waiver', value: 'true', expectedMessage: 'Participant at index 0: waiver must be a boolean' },
        { field: 'newsletter', value: 1, expectedMessage: 'Participant at index 0: newsletter must be a boolean' },
      ];

      for (const testCase of testCases) {
        const invalidData = {
          participants: [
            {
              ...validParticipant1,
              [testCase.field]: testCase.value,
            },
          ],
        };

        const event = createMockEvent({
          body: JSON.stringify(invalidData),
        });
        const context = createMockContext();

        const result = await callWrappedHandler(event, context);

        expect(result.statusCode).toBe(422);
        const parsedBody = JSON.parse(result.body);
        expect(parsedBody.error.message).toBe(testCase.expectedMessage);
      }
    });

    it('should validate optional field types when provided', async () => {
      const invalidOptionalData = {
        participants: [
          {
            ...validParticipant1,
            phone: 123, // Should be string if provided
          },
        ],
      };

      const event = createMockEvent({
        body: JSON.stringify(invalidOptionalData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Participant at index 0: phone must be a string if provided');
    });

    it('should return 422 for duplicate emails within team', async () => {
      const duplicateEmailData = {
        participants: [
          {
            email: 'duplicate@example.com',
            firstName: 'John',
            lastName: 'Doe',
            waiver: true,
            newsletter: false,
          },
          {
            email: 'duplicate@example.com', // Same email
            firstName: 'Jane',
            lastName: 'Smith',
            waiver: true,
            newsletter: true,
          },
        ],
      };

      const event = createMockEvent({
        body: JSON.stringify(duplicateEmailData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Team registration contains duplicate email addresses');
      expect(parsedBody.error.details.duplicateEmails).toEqual(['duplicate@example.com']);
    });

    it('should handle case-insensitive duplicate email detection', async () => {
      const duplicateEmailData = {
        participants: [
          {
            email: 'Test@Example.com',
            firstName: 'John',
            lastName: 'Doe',
            waiver: true,
            newsletter: false,
          },
          {
            email: 'test@example.com', // Same email, different case
            firstName: 'Jane',
            lastName: 'Smith',
            waiver: true,
            newsletter: true,
          },
        ],
      };

      const event = createMockEvent({
        body: JSON.stringify(duplicateEmailData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Team registration contains duplicate email addresses');
      expect(parsedBody.error.details.duplicateEmails).toEqual(['test@example.com']);
    });

    it('should validate multiple participants with different errors', async () => {
      const multipleErrorData = {
        participants: [
          {
            email: 'valid@example.com',
            firstName: 'John',
            lastName: 'Doe',
            waiver: true,
            newsletter: false,
          },
          {
            // Missing required fields
            email: 'invalid@example.com',
            firstName: 'Jane',
            // Missing lastName, waiver, newsletter
          },
        ],
      };

      const event = createMockEvent({
        body: JSON.stringify(multipleErrorData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toContain('Participant at index 1 is missing required fields');
    });
  });

  describe('Service Integration', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should handle service validation errors (422)', async () => {
      // Import the actual ValidationError class
      const { ValidationError } = require('../../../../shared/errors');
      const validationError = new ValidationError('Team contains invalid participant data');

      mockTeamRegistrationService.registerTeam.mockRejectedValue(validationError);

      const event = createMockEvent({
        body: JSON.stringify(validTeamRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Team contains invalid participant data');
    });

    it('should handle service conflict errors for duplicate emails (409)', async () => {
      // Import the actual ConflictError class
      const { ConflictError } = require('../../../../shared/errors');
      const conflictError = new ConflictError('Email already registered for this event', {
        duplicateEmails: ['participant1@example.com']
      });

      mockTeamRegistrationService.registerTeam.mockRejectedValue(conflictError);

      const event = createMockEvent({
        body: JSON.stringify(validTeamRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(409);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Email already registered for this event');
    });

    it('should handle capacity exceeded errors (409)', async () => {
      // Import the actual ConflictError class
      const { ConflictError } = require('../../../../shared/errors');
      const capacityError = new ConflictError('Event has reached maximum capacity', {
        maxParticipants: 100,
        currentParticipants: 98,
        requestedParticipants: 3
      });

      mockTeamRegistrationService.registerTeam.mockRejectedValue(capacityError);

      const event = createMockEvent({
        body: JSON.stringify(validTeamRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(409);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Event has reached maximum capacity');
    });

    it('should handle service not found errors (404)', async () => {
      // Import the actual NotFoundError class
      const { NotFoundError } = require('../../../../shared/errors');
      const notFoundError = new NotFoundError('Event not found');

      mockTeamRegistrationService.registerTeam.mockRejectedValue(notFoundError);

      const event = createMockEvent({
        body: JSON.stringify(validTeamRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(404);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Event not found');
    });

    it('should handle registration type mismatch errors (409)', async () => {
      // Import the actual ConflictError class
      const { ConflictError } = require('../../../../shared/errors');
      const registrationTypeMismatchError = new ConflictError(
        'Registration type mismatch. This event is configured for individual registration only.',
        {
          eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          eventRegistrationType: 'individual',
          attemptedRegistrationType: 'team',
        }
      );

      mockTeamRegistrationService.registerTeam.mockRejectedValue(registrationTypeMismatchError);

      const event = createMockEvent({
        body: JSON.stringify(validTeamRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(409);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Registration type mismatch. This event is configured for individual registration only.');
    });

    it('should handle generic service errors (500)', async () => {
      const genericError = new Error('Database connection failed');
      mockTeamRegistrationService.registerTeam.mockRejectedValue(genericError);

      const event = createMockEvent({
        body: JSON.stringify(validTeamRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(500);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error).toBeDefined();
    });
  });

  describe('ULID Validation Scenarios', () => {
    it('should validate ULID format correctly for valid ULIDs', async () => {
      const validULIDs = [
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        '01BX5ZZKBKACTAV9WEVGEMMVRZ',
        '01CXYZ123456789ABCDEFGHIJK',
      ];

      mockTeamRegistrationService.registerTeam.mockResolvedValue(mockTeamRegistrationResult);

      for (const validULID of validULIDs) {
        mockIsValidULID.mockReturnValue(true);

        const event = createMockEvent({
          pathParameters: { eventId: validULID },
          body: JSON.stringify(validTeamRegistrationData),
        });
        const context = createMockContext();

        const result = await callWrappedHandler(event, context);

        expect(result.statusCode).toBe(201);
        expect(mockIsValidULID).toHaveBeenCalledWith(validULID);
        expect(mockTeamRegistrationService.registerTeam).toHaveBeenCalledWith(
          validULID,
          expect.any(Object)
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
          body: JSON.stringify(validTeamRegistrationData),
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

  describe('Edge Cases and Complex Scenarios', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should handle large team registrations', async () => {
      const largeTeam = {
        participants: Array.from({ length: 10 }, (_, i) => ({
          email: `participant${i + 1}@example.com`,
          firstName: `Participant${i + 1}`,
          lastName: 'Test',
          waiver: true,
          newsletter: i % 2 === 0,
          role: i % 3 === 0 ? 'swimmer' : i % 3 === 1 ? 'cyclist' : 'runner',
        })),
      };

      const largeTeamResult = {
        ...mockTeamRegistrationResult,
        participants: largeTeam.participants.map((p, i) => ({
          participantId: `01ARZ3NDEKTSV4RRFFQ69G5FB${i}`,
          email: p.email,
          firstName: p.firstName,
          lastName: p.lastName,
          role: p.role,
        })),
        totalParticipants: 10,
        registrationFee: 500.00,
      };

      mockTeamRegistrationService.registerTeam.mockResolvedValue(largeTeamResult);

      const event = createMockEvent({
        body: JSON.stringify(largeTeam),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.data.totalParticipants).toBe(10);
      expect(parsedBody.data.participants).toHaveLength(10);
    });

    it('should handle participants with extensive optional data', async () => {
      const extensiveParticipant = {
        participants: [
          {
            ...validParticipant1,
            dietaryRestrictions: 'Vegetarian, gluten-free, no nuts, lactose intolerant',
            medicalConditions: 'Asthma, diabetes type 1, previous knee surgery',
            medications: 'Insulin, albuterol inhaler, vitamin D supplements',
            allergies: 'Peanuts, shellfish, bee stings, latex',
          },
        ],
      };

      mockTeamRegistrationService.registerTeam.mockResolvedValue({
        ...mockTeamRegistrationResult,
        participants: [mockTeamRegistrationResult.participants[0]],
        totalParticipants: 1,
        registrationFee: 50.00,
      });

      const event = createMockEvent({
        body: JSON.stringify(extensiveParticipant),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      expect(mockTeamRegistrationService.registerTeam).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        extensiveParticipant
      );
    });

    it('should handle mixed participant data completeness', async () => {
      const mixedTeamData = {
        participants: [
          // Full data participant
          validParticipant1,
          // Minimal data participant
          {
            email: 'minimal@example.com',
            firstName: 'Min',
            lastName: 'Imal',
            waiver: true,
            newsletter: false,
          },
          // Partial data participant
          {
            email: 'partial@example.com',
            firstName: 'Par',
            lastName: 'Tial',
            waiver: true,
            newsletter: true,
            phone: '+1234567890',
            emergencyName: 'Emergency Contact',
            emergencyPhone: '+0987654321',
          },
        ],
      };

      mockTeamRegistrationService.registerTeam.mockResolvedValue(mockTeamRegistrationResult);

      const event = createMockEvent({
        body: JSON.stringify(mixedTeamData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      expect(mockTeamRegistrationService.registerTeam).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        mixedTeamData
      );
    });
  });

  describe('Response Format Validation', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
      mockTeamRegistrationService.registerTeam.mockResolvedValue(mockTeamRegistrationResult);
    });

    it('should return consistent response structure for success', async () => {
      const event = createMockEvent({
        body: JSON.stringify(validTeamRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      expect(result.headers).toBeDefined();
      expect(result.body).toBeDefined();

      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toHaveProperty('success', true);
      expect(parsedBody).toHaveProperty('data');
      expect(parsedBody).not.toHaveProperty('error');

      // Verify response data structure
      expect(parsedBody.data).toHaveProperty('reservationId');
      expect(parsedBody.data).toHaveProperty('eventId');
      expect(parsedBody.data).toHaveProperty('participants');
      expect(parsedBody.data).toHaveProperty('paymentStatus');
      expect(parsedBody.data).toHaveProperty('registrationFee');
      expect(parsedBody.data).toHaveProperty('totalParticipants');
      expect(parsedBody.data).toHaveProperty('createdAt');
      expect(parsedBody.data).toHaveProperty('message');

      // Verify participants structure
      expect(Array.isArray(parsedBody.data.participants)).toBe(true);
      parsedBody.data.participants.forEach((participant: any) => {
        expect(participant).toHaveProperty('participantId');
        expect(participant).toHaveProperty('email');
        expect(participant).toHaveProperty('firstName');
        expect(participant).toHaveProperty('lastName');
      });
    });

    it('should return consistent response structure for errors', async () => {
      const event = createMockEvent({
        pathParameters: { eventId: 'invalid' },
        body: JSON.stringify(validTeamRegistrationData),
      });
      const context = createMockContext();

      mockIsValidULID.mockReturnValue(false);

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toHaveProperty('success', false);
      expect(parsedBody).toHaveProperty('error');
      expect(parsedBody).toHaveProperty('data', null);

      // Verify error structure
      expect(parsedBody.error).toHaveProperty('message');
      expect(parsedBody.error).toHaveProperty('code');
    });
  });
});