import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { isValidULID } from '../../../../shared/utils/ulid';
import { individualRegistrationService } from '../../services/individual-registration.service';
import { handler } from '../createIndividualRegistration';

// Mock the individual registration service
jest.mock('../../services/individual-registration.service');
const mockIndividualRegistrationService = individualRegistrationService as jest.Mocked<typeof individualRegistrationService>;

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

// Valid registration data for testing
const validRegistrationData = {
  email: 'test@example.com',
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
};

// Mock successful registration result
const mockRegistrationResult = {
  reservationId: '01ARZ3NDEKTSV4RRFFQ69G5FBW',
  participantId: '01ARZ3NDEKTSV4RRFFQ69G5FBX',
  eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  email: 'test@example.com',
  paymentStatus: false,
  registrationFee: 50.00,
  createdAt: '2023-01-01T00:00:00.000Z',
};

describe('Create Individual Registration Handler', () => {
  describe('Successful Registration', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
      mockIndividualRegistrationService.registerIndividual.mockResolvedValue(mockRegistrationResult);
    });

    it('should successfully create individual registration with all fields', async () => {
      const event = createMockEvent({
        body: JSON.stringify(validRegistrationData),
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
          participantId: '01ARZ3NDEKTSV4RRFFQ69G5FBX',
          eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          email: 'test@example.com',
          paymentStatus: false,
          registrationFee: 50.00,
          createdAt: '2023-01-01T00:00:00.000Z',
          message: 'Individual registration created successfully',
        },
      });

      expect(mockIndividualRegistrationService.registerIndividual).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        validRegistrationData
      );
    });

    it('should successfully create registration with only required fields', async () => {
      const minimalData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
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
      expect(parsedBody.success).toBe(true);
      expect(parsedBody.data.message).toBe('Individual registration created successfully');

      expect(mockIndividualRegistrationService.registerIndividual).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        expect.objectContaining(minimalData)
      );
    });

    it('should include CORS headers in successful response', async () => {
      const event = createMockEvent({
        body: JSON.stringify(validRegistrationData),
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
        body: JSON.stringify(validRegistrationData),
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
        body: JSON.stringify(validRegistrationData),
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
        body: JSON.stringify(validRegistrationData),
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
        body: JSON.stringify(validRegistrationData),
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
          body: JSON.stringify(validRegistrationData),
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

    it('should return 422 for missing required fields', async () => {
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
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.code).toBe('VALIDATION_ERROR');
      expect(parsedBody.error.message).toContain('Missing required fields');
      expect(parsedBody.error.details.missingFields).toEqual(['lastName', 'waiver', 'newsletter']);
    });

    it('should return 422 for invalid field types', async () => {
      const invalidTypeData = {
        email: 123, // Should be string
        firstName: 'John',
        lastName: 'Doe',
        waiver: true,
        newsletter: false,
      };

      const event = createMockEvent({
        body: JSON.stringify(invalidTypeData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Email must be a string');
    });

    it('should validate all required field types', async () => {
      const testCases = [
        { field: 'firstName', value: 123, expectedMessage: 'First name must be a string' },
        { field: 'lastName', value: [], expectedMessage: 'Last name must be a string' },
        { field: 'waiver', value: 'true', expectedMessage: 'Waiver must be a boolean' },
        { field: 'newsletter', value: 1, expectedMessage: 'Newsletter must be a boolean' },
      ];

      for (const testCase of testCases) {
        const invalidData = {
          ...validRegistrationData,
          [testCase.field]: testCase.value,
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
        ...validRegistrationData,
        phone: 123, // Should be string if provided
      };

      const event = createMockEvent({
        body: JSON.stringify(invalidOptionalData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('phone must be a string if provided');
    });

    it('should accept null or undefined optional fields', async () => {
      const dataWithNullOptionals = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        waiver: true,
        newsletter: false,
        // Don't include optional fields at all (undefined)
      };

      mockIndividualRegistrationService.registerIndividual.mockResolvedValue(mockRegistrationResult);

      const event = createMockEvent({
        body: JSON.stringify(dataWithNullOptionals),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      expect(mockIndividualRegistrationService.registerIndividual).toHaveBeenCalled();
    });
  });

  describe('Service Integration', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should handle service validation errors (422)', async () => {
      // Import the actual ValidationError class
      const { ValidationError } = require('../../../../shared/errors');
      const validationError = new ValidationError('Invalid email format');

      mockIndividualRegistrationService.registerIndividual.mockRejectedValue(validationError);

      const event = createMockEvent({
        body: JSON.stringify(validRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Invalid email format');
    });

    it('should handle service conflict errors (409)', async () => {
      // Import the actual ConflictError class
      const { ConflictError } = require('../../../../shared/errors');
      const conflictError = new ConflictError('Email already registered for this event');

      mockIndividualRegistrationService.registerIndividual.mockRejectedValue(conflictError);

      const event = createMockEvent({
        body: JSON.stringify(validRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(409);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Email already registered for this event');
    });

    it('should handle service not found errors (404)', async () => {
      // Import the actual NotFoundError class
      const { NotFoundError } = require('../../../../shared/errors');
      const notFoundError = new NotFoundError('Event not found');

      mockIndividualRegistrationService.registerIndividual.mockRejectedValue(notFoundError);

      const event = createMockEvent({
        body: JSON.stringify(validRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(404);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Event not found');
    });

    it('should handle capacity exceeded errors', async () => {
      // Import the actual ConflictError class
      const { ConflictError } = require('../../../../shared/errors');
      const capacityError = new ConflictError('Event has reached maximum capacity', {
        maxParticipants: 100,
        currentParticipants: 100
      });

      mockIndividualRegistrationService.registerIndividual.mockRejectedValue(capacityError);

      const event = createMockEvent({
        body: JSON.stringify(validRegistrationData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(409);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Event has reached maximum capacity');
    });

    it('should handle generic service errors (500)', async () => {
      const genericError = new Error('Database connection failed');
      mockIndividualRegistrationService.registerIndividual.mockRejectedValue(genericError);

      const event = createMockEvent({
        body: JSON.stringify(validRegistrationData),
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

      mockIndividualRegistrationService.registerIndividual.mockResolvedValue(mockRegistrationResult);

      for (const validULID of validULIDs) {
        mockIsValidULID.mockReturnValue(true);

        const event = createMockEvent({
          pathParameters: { eventId: validULID },
          body: JSON.stringify(validRegistrationData),
        });
        const context = createMockContext();

        const result = await callWrappedHandler(event, context);

        expect(result.statusCode).toBe(201);
        expect(mockIsValidULID).toHaveBeenCalledWith(validULID);
        expect(mockIndividualRegistrationService.registerIndividual).toHaveBeenCalledWith(
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
          body: JSON.stringify(validRegistrationData),
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

    it('should handle empty JSON object in request body', async () => {
      const event = createMockEvent({
        body: '{}',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toContain('Missing required fields');
    });

    it('should handle null request body after JSON parsing', async () => {
      const event = createMockEvent({
        body: 'null',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Request body must be a valid JSON object');
    });

    it('should handle array instead of object in request body', async () => {
      const event = createMockEvent({
        body: '[]',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Request body must be a valid JSON object');
    });

    it('should handle string instead of object in request body', async () => {
      const event = createMockEvent({
        body: '"string"',
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Request body must be a valid JSON object');
    });

    it('should handle very large request body', async () => {
      const largeData = {
        ...validRegistrationData,
        dietaryRestrictions: 'A'.repeat(10000), // Very long string
      };

      mockIndividualRegistrationService.registerIndividual.mockResolvedValue(mockRegistrationResult);

      const event = createMockEvent({
        body: JSON.stringify(largeData),
      });
      const context = createMockContext();

      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);
      expect(mockIndividualRegistrationService.registerIndividual).toHaveBeenCalledWith(
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        expect.objectContaining({
          dietaryRestrictions: 'A'.repeat(10000),
        })
      );
    });
  });

  describe('Response Format Validation', () => {
    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
      mockIndividualRegistrationService.registerIndividual.mockResolvedValue(mockRegistrationResult);
    });

    it('should return consistent response structure for success', async () => {
      const event = createMockEvent({
        body: JSON.stringify(validRegistrationData),
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
      expect(parsedBody.data).toHaveProperty('participantId');
      expect(parsedBody.data).toHaveProperty('eventId');
      expect(parsedBody.data).toHaveProperty('email');
      expect(parsedBody.data).toHaveProperty('paymentStatus');
      expect(parsedBody.data).toHaveProperty('registrationFee');
      expect(parsedBody.data).toHaveProperty('createdAt');
      expect(parsedBody.data).toHaveProperty('message');
    });

    it('should return consistent response structure for errors', async () => {
      const event = createMockEvent({
        pathParameters: { eventId: 'invalid' },
        body: JSON.stringify(validRegistrationData),
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
