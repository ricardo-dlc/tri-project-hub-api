import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { organizerService } from '../../services/organizer.service';
import { handler } from '../getOrganizerMe';

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
        body: JSON.stringify({
          success: true,
          data: result.body || result,
        }),
      };
    } catch (error: any) {
      let statusCode = 500;
      if (error.name === 'NotFoundError') statusCode = 404;
      else if (error.name === 'BadRequestError') statusCode = 400;
      
      return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            message: error.message,
            code: error.name === 'BadRequestError' ? 'BAD_REQUEST' : error.name?.toUpperCase(),
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
): APIGatewayProxyEventV2 & { user?: any } => ({
  version: '2.0',
  routeKey: 'GET /organizers/me',
  rawPath: '/organizers/me',
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
      method: 'GET',
      path: '/organizers/me',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'GET /organizers/me',
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

describe('getOrganizerMe handler', () => {
  describe('successful organizer retrieval', () => {
    it('should get current user organizer', async () => {
      // Mock successful organizer retrieval
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

      mockOrganizerService.getOrganizerByClerkId.mockResolvedValue(mockOrganizer);

      const event = createMockEvent();
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.body.organizer).toEqual(mockOrganizer);

      // Verify service was called with correct parameters
      expect(mockOrganizerService.getOrganizerByClerkId).toHaveBeenCalledWith(
        'user_2NiWoBO5HDIKVXegEXPqNkqZwHu'
      );
    });

    it('should get current user organizer for admin user', async () => {
      // Mock successful organizer retrieval
      const mockOrganizer = {
        organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        clerkId: 'user_admin',
        name: 'Admin Organizer',
        contact: 'admin@example.com',
        website: 'https://admin.example.com',
        description: 'Admin organizer description',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockOrganizerService.getOrganizerByClerkId.mockResolvedValue(mockOrganizer);

      const event = createMockEvent({
        user: {
          id: 'user_admin',
          email: 'admin@example.com',
          role: 'admin',
        },
      } as any);

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.body.organizer).toEqual(mockOrganizer);

      // Verify service was called with correct parameters
      expect(mockOrganizerService.getOrganizerByClerkId).toHaveBeenCalledWith('user_admin');
    });
  });

  describe('validation errors', () => {
    it('should return 400 when user is not authenticated', async () => {
      const event = createMockEvent({
        user: undefined,
      } as any);

      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.message).toContain('User authentication required');
    });
  });

  describe('service errors', () => {
    it('should return 500 when user has no organizer profile', async () => {
      const notFoundError = new Error('Organizer with Clerk ID user_2NiWoBO5HDIKVXegEXPqNkqZwHu not found');
      notFoundError.name = 'NotFoundError';
      mockOrganizerService.getOrganizerByClerkId.mockRejectedValue(notFoundError);

      const event = createMockEvent();
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(500);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.message).toContain('Organizer with Clerk ID user_2NiWoBO5HDIKVXegEXPqNkqZwHu not found');
    });

    it('should handle service errors gracefully', async () => {
      const serviceError = new Error('Database connection failed');
      mockOrganizerService.getOrganizerByClerkId.mockRejectedValue(serviceError);

      const event = createMockEvent();
      const context = createMockContext();
      const result = await callWrappedHandler(event, context);

      expect(result.statusCode).toBe(500);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.message).toContain('Database connection failed');
    });
  });
});
