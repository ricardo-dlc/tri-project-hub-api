import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { organizerService } from '../../services/organizer.service';
import { handler } from '../createOrganizer';
import { AuthenticatedEvent } from '../../../../shared/auth/middleware';

// Mock environment variables
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';

// Mock the organizer service
jest.mock('../../services/organizer.service');
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
      return {
        statusCode: result.statusCode || 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.body || result),
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
  jest.clearAllMocks();
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

// Helper function to create mock API Gateway event
const createMockEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): AuthenticatedEvent => ({
  version: '2.0',
  routeKey: 'POST /organizers',
  rawPath: '/organizers',
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
      path: '/organizers',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'POST /organizers',
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

describe('createOrganizer handler', () => {
  describe('successful organizer creation', () => {
    it('should create organizer with valid data', async () => {
      // Mock successful organizer creation
      const mockOrganizer = {
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        clerkId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
        name: 'Test Organizer',
        contact: 'test@example.com',
        website: 'https://example.com',
        description: 'Test description',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockOrganizerService.createOrganizer.mockResolvedValue(mockOrganizer);

      const event = createMockEvent({
        body: JSON.stringify({
          name: 'Test Organizer',
          contact: 'test@example.com',
          website: 'https://example.com',
          description: 'Test description',
        }),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.organizer).toEqual(mockOrganizer);
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

    it('should return 400 when organizer name is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          contact: 'test@example.com',
        }),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Organizer name is required');
    });

    it('should return 400 when organizer contact is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          name: 'Test Organizer',
        }),
      });

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Organizer contact is required');
    });
  });
});
