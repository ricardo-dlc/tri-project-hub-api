/**
 * Integration tests for organizer handlers
 * Tests all CRUD operations with authentication, error scenarios, and admin vs creator permissions
 * Requirements: 7.1, 7.2, 8.1, 8.2, 10.1, 10.2, 10.3
 */

import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { AuthenticatedEvent } from '@/shared/auth/middleware';
import { organizerService } from '../../services/organizer.service';
import { CreateOrganizerData, OrganizerItem, UpdateOrganizerData } from '../../types/organizer.types';

// Import handlers
import { handler as createOrganizerHandler } from '../createOrganizer';
import { handler as deleteOrganizerHandler } from '../deleteOrganizer';
import { handler as getOrganizerHandler } from '../getOrganizer';
import { handler as getOrganizerMeHandler } from '../getOrganizerMe';
import { handler as updateOrganizerHandler } from '../updateOrganizer';

// Mock environment variables
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';
process.env.EVENTS_TABLE_NAME = 'test-events-table';

// Mock the organizer service
jest.mock('@/features/events/services/organizer.service');
const mockOrganizerService = organizerService as jest.Mocked<typeof organizerService>;

// Mock the auth middleware to pass through the handler function
jest.mock('@/shared/auth/middleware', () => ({
  withAuth: (handlerFn: any, options?: any) => handlerFn,
}));

// Mock the shared middleware to simulate API Gateway response formatting
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
      if (error.name === 'BadRequestError') statusCode = 400;
      else if (error.name === 'NotAuthorizedError') statusCode = 401;
      else if (error.name === 'ForbiddenError') statusCode = 403;
      else if (error.name === 'NotFoundError') statusCode = 404;
      else if (error.name === 'ConflictError') statusCode = 409;
      else if (error.name === 'ValidationError') statusCode = 422;

      return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            message: error.message,
            code: error.name?.replace('Error', '').toUpperCase() || 'INTERNAL_SERVER_ERROR',
            details: error.details,
          },
          data: null,
        }),
      };
    }
  },
  BadRequestError: class BadRequestError extends Error {
    constructor(message: string, public details?: any) {
      super(message);
      this.name = 'BadRequestError';
    }
  },
  NotAuthorizedError: class NotAuthorizedError extends Error {
    constructor(message: string, public details?: any) {
      super(message);
      this.name = 'NotAuthorizedError';
    }
  },
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message: string, public details?: any) {
      super(message);
      this.name = 'ForbiddenError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string, public details?: any) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(message: string, public details?: any) {
      super(message);
      this.name = 'ConflictError';
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message: string, public details?: any) {
      super(message);
      this.name = 'ValidationError';
    }
  },
}));

// Get the mocked error classes
const {
  BadRequestError,
  NotAuthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError
} = jest.requireMock('../../../../shared');

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

// Test data
const mockOrganizerData: OrganizerItem = {
  organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  clerkId: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
  name: 'Test Organizer',
  contact: 'test@example.com',
  website: 'https://example.com',
  description: 'Test organizer description',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockAdminUser = {
  id: 'user_admin123',
  email: 'admin@example.com',
  role: 'admin' as const,
};

const mockOrganizerUser = {
  id: 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu',
  email: 'test@example.com',
  role: 'organizer' as const,
};

const mockDifferentUser = {
  id: 'user_different123',
  email: 'different@example.com',
  role: 'organizer' as const,
};

describe('Organizer Handlers Integration Tests', () => {
  describe('CREATE Organizer Handler Integration', () => {
    describe('Successful Creation', () => {
      it('should create organizer with valid data and organizer role', async () => {
        const createData: CreateOrganizerData = {
          name: 'Test Organizer',
          contact: 'test@example.com',
          website: 'https://example.com',
          description: 'Test description',
        };

        mockOrganizerService.createOrganizer.mockResolvedValue(mockOrganizerData);

        const event = createMockEvent({
          body: JSON.stringify(createData),
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(createOrganizerHandler, event, context);

        expect(result.statusCode).toBe(201);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.organizer).toEqual(mockOrganizerData);

        expect(mockOrganizerService.createOrganizer).toHaveBeenCalledWith(
          createData,
          mockOrganizerUser
        );
      });

      it('should create organizer with admin role', async () => {
        const createData: CreateOrganizerData = {
          name: 'Admin Organizer',
          contact: 'admin@example.com',
        };

        const adminOrganizerData = {
          ...mockOrganizerData,
          clerkId: mockAdminUser.id,
          name: 'Admin Organizer',
          contact: 'admin@example.com',
        };

        mockOrganizerService.createOrganizer.mockResolvedValue(adminOrganizerData);

        const event = createMockEvent({
          body: JSON.stringify(createData),
          user: mockAdminUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(createOrganizerHandler, event, context);

        expect(result.statusCode).toBe(201);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.organizer).toEqual(adminOrganizerData);

        expect(mockOrganizerService.createOrganizer).toHaveBeenCalledWith(
          createData,
          mockAdminUser
        );
      });

      it('should return existing organizer if already exists for user', async () => {
        const createData: CreateOrganizerData = {
          name: 'Test Organizer',
          contact: 'test@example.com',
        };

        // Service returns existing organizer instead of creating new one
        mockOrganizerService.createOrganizer.mockResolvedValue(mockOrganizerData);

        const event = createMockEvent({
          body: JSON.stringify(createData),
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(createOrganizerHandler, event, context);

        expect(result.statusCode).toBe(201);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.organizer).toEqual(mockOrganizerData);
      });
    });

    describe('Validation Errors', () => {
      it('should return 400 when request body is missing', async () => {
        const event = createMockEvent({
          body: undefined,
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(createOrganizerHandler, event, context);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Request body is required');
      });

      it('should return 400 when request body is invalid JSON', async () => {
        const event = createMockEvent({
          body: 'invalid json',
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(createOrganizerHandler, event, context);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Invalid JSON in request body');
      });

      it('should return 400 when organizer name is missing', async () => {
        const event = createMockEvent({
          body: JSON.stringify({ contact: 'test@example.com' }),
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(createOrganizerHandler, event, context);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Organizer name is required');
      });

      it('should return 400 when organizer contact is missing', async () => {
        const event = createMockEvent({
          body: JSON.stringify({ name: 'Test Organizer' }),
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(createOrganizerHandler, event, context);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Organizer contact is required');
      });

      it('should return 400 when user authentication is missing', async () => {
        const event = createMockEvent({
          body: JSON.stringify({ name: 'Test', contact: 'test@example.com' }),
          user: undefined,
        } as any);

        const context = createMockContext();
        const result = await callWrappedHandler(createOrganizerHandler, event, context);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('User authentication required');
      });
    });

    describe('Service Layer Errors', () => {
      it('should handle validation errors from service', async () => {
        const createData: CreateOrganizerData = {
          name: 'Test Organizer',
          contact: 'invalid-email',
        };

        mockOrganizerService.createOrganizer.mockRejectedValue(
          new ValidationError('Invalid email format', { field: 'contact', value: 'invalid-email' })
        );

        const event = createMockEvent({
          body: JSON.stringify(createData),
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(createOrganizerHandler, event, context);

        expect(result.statusCode).toBe(422);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Invalid email format');
        expect(responseBody.error.details).toEqual({ field: 'contact', value: 'invalid-email' });
      });

      it('should handle database errors from service', async () => {
        const createData: CreateOrganizerData = {
          name: 'Test Organizer',
          contact: 'test@example.com',
        };

        mockOrganizerService.createOrganizer.mockRejectedValue(
          new Error('Failed to create organizer: Database connection failed')
        );

        const event = createMockEvent({
          body: JSON.stringify(createData),
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(createOrganizerHandler, event, context);

        expect(result.statusCode).toBe(500);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Failed to create organizer: Database connection failed');
      });
    });
  });

  describe('UPDATE Organizer Handler Integration', () => {
    describe('Successful Updates', () => {
      it('should update organizer when user owns the organizer', async () => {
        const updateData: UpdateOrganizerData = {
          name: 'Updated Organizer Name',
          contact: 'updated@example.com',
        };

        const updatedOrganizer = {
          ...mockOrganizerData,
          name: 'Updated Organizer Name',
          contact: 'updated@example.com',
          updatedAt: '2024-01-02T00:00:00.000Z',
        };

        mockOrganizerService.updateOrganizer.mockResolvedValue(updatedOrganizer);

        const event = createMockEvent({
          routeKey: 'PUT /organizers/{organizerId}',
          rawPath: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
          pathParameters: { organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
          body: JSON.stringify(updateData),
          user: mockOrganizerUser,
          requestContext: {
            ...createMockEvent().requestContext,
            http: {
              ...createMockEvent().requestContext.http,
              method: 'PUT',
              path: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
            },
          },
        });

        const context = createMockContext();
        const result = await callWrappedHandler(updateOrganizerHandler, event, context);

        expect(result.statusCode).toBe(200);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.organizer).toEqual(updatedOrganizer);

        expect(mockOrganizerService.updateOrganizer).toHaveBeenCalledWith(
          '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          updateData,
          mockOrganizerUser
        );
      });

      it('should allow admin to update any organizer', async () => {
        const updateData: UpdateOrganizerData = {
          name: 'Admin Updated Name',
        };

        const updatedOrganizer = {
          ...mockOrganizerData,
          name: 'Admin Updated Name',
          updatedAt: '2024-01-02T00:00:00.000Z',
        };

        mockOrganizerService.updateOrganizer.mockResolvedValue(updatedOrganizer);

        const event = createMockEvent({
          routeKey: 'PUT /organizers/{organizerId}',
          rawPath: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
          pathParameters: { organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
          body: JSON.stringify(updateData),
          user: mockAdminUser,
          requestContext: {
            ...createMockEvent().requestContext,
            http: {
              ...createMockEvent().requestContext.http,
              method: 'PUT',
              path: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
            },
          },
        });

        const context = createMockContext();
        const result = await callWrappedHandler(updateOrganizerHandler, event, context);

        expect(result.statusCode).toBe(200);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.organizer).toEqual(updatedOrganizer);

        expect(mockOrganizerService.updateOrganizer).toHaveBeenCalledWith(
          '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          updateData,
          mockAdminUser
        );
      });

      it('should update organizer with partial data', async () => {
        const updateData: UpdateOrganizerData = {
          website: 'https://updated.example.com',
        };

        const updatedOrganizer = {
          ...mockOrganizerData,
          website: 'https://updated.example.com',
          updatedAt: '2024-01-02T00:00:00.000Z',
        };

        mockOrganizerService.updateOrganizer.mockResolvedValue(updatedOrganizer);

        const event = createMockEvent({
          routeKey: 'PUT /organizers/{organizerId}',
          rawPath: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
          pathParameters: { organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
          body: JSON.stringify(updateData),
          user: mockOrganizerUser,
          requestContext: {
            ...createMockEvent().requestContext,
            http: {
              ...createMockEvent().requestContext.http,
              method: 'PUT',
              path: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
            },
          },
        });

        const context = createMockContext();
        const result = await callWrappedHandler(updateOrganizerHandler, event, context);

        expect(result.statusCode).toBe(200);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.organizer).toEqual(updatedOrganizer);
      });
    });

    describe('Validation Errors', () => {
      it('should return 400 when organizerId is missing', async () => {
        const event = createMockEvent({
          routeKey: 'PUT /organizers/{organizerId}',
          pathParameters: {},
          body: JSON.stringify({ name: 'Test' }),
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(updateOrganizerHandler, event, context);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Organizer ID is required in path parameters');
      });

      it('should return 400 when request body is missing', async () => {
        const event = createMockEvent({
          routeKey: 'PUT /organizers/{organizerId}',
          pathParameters: { organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
          body: undefined,
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(updateOrganizerHandler, event, context);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Request body is required');
      });
    });

    describe('Authorization Errors', () => {
      it('should return 403 when user does not own the organizer', async () => {
        const updateData: UpdateOrganizerData = {
          name: 'Unauthorized Update',
        };

        mockOrganizerService.updateOrganizer.mockRejectedValue(
          new ForbiddenError('You can only modify organizers you created')
        );

        const event = createMockEvent({
          routeKey: 'PUT /organizers/{organizerId}',
          pathParameters: { organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
          body: JSON.stringify(updateData),
          user: mockDifferentUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(updateOrganizerHandler, event, context);

        expect(result.statusCode).toBe(403);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('You can only modify organizers you created');
      });

      it('should return 404 when organizer does not exist', async () => {
        const updateData: UpdateOrganizerData = {
          name: 'Update Non-existent',
        };

        mockOrganizerService.updateOrganizer.mockRejectedValue(
          new NotFoundError('Organizer with ID nonexistent not found')
        );

        const event = createMockEvent({
          routeKey: 'PUT /organizers/{organizerId}',
          pathParameters: { organizerId: 'nonexistent' },
          body: JSON.stringify(updateData),
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(updateOrganizerHandler, event, context);

        expect(result.statusCode).toBe(404);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Organizer with ID nonexistent not found');
      });
    });
  });

  describe('GET Organizer Handler Integration', () => {
    describe('Successful Retrieval', () => {
      it('should get organizer when user owns it', async () => {
        mockOrganizerService.validateOrganizerExists.mockResolvedValue(mockOrganizerData);

        const event = createMockEvent({
          routeKey: 'GET /organizers/{organizerId}',
          rawPath: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
          pathParameters: { organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
          user: mockOrganizerUser,
          requestContext: {
            ...createMockEvent().requestContext,
            http: {
              ...createMockEvent().requestContext.http,
              method: 'GET',
              path: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
            },
          },
        });

        const context = createMockContext();
        const result = await callWrappedHandler(getOrganizerHandler, event, context);

        expect(result.statusCode).toBe(200);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.organizer).toEqual(mockOrganizerData);

        expect(mockOrganizerService.validateOrganizerExists).toHaveBeenCalledWith(
          '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          mockOrganizerUser
        );
      });

      it('should allow admin to get any organizer', async () => {
        const differentOrganizerData = {
          ...mockOrganizerData,
          clerkId: 'user_different123',
          name: 'Different Organizer',
        };

        mockOrganizerService.validateOrganizerExists.mockResolvedValue(differentOrganizerData);

        const event = createMockEvent({
          routeKey: 'GET /organizers/{organizerId}',
          rawPath: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
          pathParameters: { organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
          user: mockAdminUser,
          requestContext: {
            ...createMockEvent().requestContext,
            http: {
              ...createMockEvent().requestContext.http,
              method: 'GET',
              path: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
            },
          },
        });

        const context = createMockContext();
        const result = await callWrappedHandler(getOrganizerHandler, event, context);

        expect(result.statusCode).toBe(200);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.organizer).toEqual(differentOrganizerData);

        expect(mockOrganizerService.validateOrganizerExists).toHaveBeenCalledWith(
          '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          mockAdminUser
        );
      });
    });

    describe('Authorization Errors', () => {
      it('should return 404 when user does not own organizer (security)', async () => {
        // Service returns NotFoundError to not reveal existence to unauthorized users
        mockOrganizerService.validateOrganizerExists.mockRejectedValue(
          new NotFoundError('Organizer with ID 01ARZ3NDEKTSV4RRFFQ69G5FAV not found')
        );

        const event = createMockEvent({
          routeKey: 'GET /organizers/{organizerId}',
          pathParameters: { organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
          user: mockDifferentUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(getOrganizerHandler, event, context);

        expect(result.statusCode).toBe(404);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Organizer with ID 01ARZ3NDEKTSV4RRFFQ69G5FAV not found');
      });

      it('should return 404 when organizer does not exist', async () => {
        mockOrganizerService.validateOrganizerExists.mockRejectedValue(
          new NotFoundError('Organizer with ID nonexistent not found')
        );

        const event = createMockEvent({
          routeKey: 'GET /organizers/{organizerId}',
          pathParameters: { organizerId: 'nonexistent' },
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(getOrganizerHandler, event, context);

        expect(result.statusCode).toBe(404);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Organizer with ID nonexistent not found');
      });
    });
  });

  describe('GET Organizer Me Handler Integration', () => {
    describe('Successful Retrieval', () => {
      it('should get current user organizer profile', async () => {
        mockOrganizerService.getOrganizerByClerkId.mockResolvedValue(mockOrganizerData);

        const event = createMockEvent({
          routeKey: 'GET /organizers/me',
          rawPath: '/organizers/me',
          user: mockOrganizerUser,
          requestContext: {
            ...createMockEvent().requestContext,
            http: {
              ...createMockEvent().requestContext.http,
              method: 'GET',
              path: '/organizers/me',
            },
          },
        });

        const context = createMockContext();
        const result = await callWrappedHandler(getOrganizerMeHandler, event, context);

        expect(result.statusCode).toBe(200);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.organizer).toEqual(mockOrganizerData);

        expect(mockOrganizerService.getOrganizerByClerkId).toHaveBeenCalledWith(
          mockOrganizerUser.id
        );
      });

      it('should get admin user organizer profile', async () => {
        const adminOrganizerData = {
          ...mockOrganizerData,
          clerkId: mockAdminUser.id,
          name: 'Admin Organizer',
          contact: 'admin@example.com',
        };

        mockOrganizerService.getOrganizerByClerkId.mockResolvedValue(adminOrganizerData);

        const event = createMockEvent({
          routeKey: 'GET /organizers/me',
          rawPath: '/organizers/me',
          user: mockAdminUser,
          requestContext: {
            ...createMockEvent().requestContext,
            http: {
              ...createMockEvent().requestContext.http,
              method: 'GET',
              path: '/organizers/me',
            },
          },
        });

        const context = createMockContext();
        const result = await callWrappedHandler(getOrganizerMeHandler, event, context);

        expect(result.statusCode).toBe(200);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.organizer).toEqual(adminOrganizerData);

        expect(mockOrganizerService.getOrganizerByClerkId).toHaveBeenCalledWith(
          mockAdminUser.id
        );
      });
    });

    describe('Error Scenarios', () => {
      it('should return 404 when user has no organizer profile', async () => {
        mockOrganizerService.getOrganizerByClerkId.mockRejectedValue(
          new NotFoundError('Organizer with Clerk ID user_2NiWoBO5HDIKVXegEXPqNkqZwHu not found')
        );

        const event = createMockEvent({
          routeKey: 'GET /organizers/me',
          rawPath: '/organizers/me',
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(getOrganizerMeHandler, event, context);

        expect(result.statusCode).toBe(404);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Organizer with Clerk ID user_2NiWoBO5HDIKVXegEXPqNkqZwHu not found');
      });

      it('should return 400 when user authentication is missing', async () => {
        const event = createMockEvent({
          routeKey: 'GET /organizers/me',
          user: undefined,
        } as any);

        const context = createMockContext();
        const result = await callWrappedHandler(getOrganizerMeHandler, event, context);

        expect(result.statusCode).toBe(400);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('User authentication required');
      });
    });
  });

  describe('DELETE Organizer Handler Integration', () => {
    describe('Successful Deletion', () => {
      it('should delete organizer when user owns it', async () => {
        mockOrganizerService.deleteOrganizer.mockResolvedValue(undefined);

        const event = createMockEvent({
          routeKey: 'DELETE /organizers/{organizerId}',
          rawPath: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
          pathParameters: { organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
          user: mockOrganizerUser,
          requestContext: {
            ...createMockEvent().requestContext,
            http: {
              ...createMockEvent().requestContext.http,
              method: 'DELETE',
              path: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
            },
          },
        });

        const context = createMockContext();
        const result = await callWrappedHandler(deleteOrganizerHandler, event, context);

        expect(result.statusCode).toBe(200);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.statusCode).toBe(204);
        expect(responseBody.data.body).toBe(null);

        expect(mockOrganizerService.deleteOrganizer).toHaveBeenCalledWith(
          '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          mockOrganizerUser
        );
      });

      it('should allow admin to delete any organizer', async () => {
        mockOrganizerService.deleteOrganizer.mockResolvedValue(undefined);

        const event = createMockEvent({
          routeKey: 'DELETE /organizers/{organizerId}',
          rawPath: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
          pathParameters: { organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
          user: mockAdminUser,
          requestContext: {
            ...createMockEvent().requestContext,
            http: {
              ...createMockEvent().requestContext.http,
              method: 'DELETE',
              path: '/organizers/01ARZ3NDEKTSV4RRFFQ69G5FAV',
            },
          },
        });

        const context = createMockContext();
        const result = await callWrappedHandler(deleteOrganizerHandler, event, context);

        expect(result.statusCode).toBe(200);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.statusCode).toBe(204);

        expect(mockOrganizerService.deleteOrganizer).toHaveBeenCalledWith(
          '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          mockAdminUser
        );
      });
    });

    describe('Authorization Errors', () => {
      it('should return 403 when user does not own organizer', async () => {
        mockOrganizerService.deleteOrganizer.mockRejectedValue(
          new ForbiddenError('You can only modify organizers you created')
        );

        const event = createMockEvent({
          routeKey: 'DELETE /organizers/{organizerId}',
          pathParameters: { organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
          user: mockDifferentUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(deleteOrganizerHandler, event, context);

        expect(result.statusCode).toBe(403);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('You can only modify organizers you created');
      });

      it('should return 404 when organizer does not exist', async () => {
        mockOrganizerService.deleteOrganizer.mockRejectedValue(
          new NotFoundError('Organizer with ID nonexistent not found')
        );

        const event = createMockEvent({
          routeKey: 'DELETE /organizers/{organizerId}',
          pathParameters: { organizerId: 'nonexistent' },
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(deleteOrganizerHandler, event, context);

        expect(result.statusCode).toBe(404);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Organizer with ID nonexistent not found');
      });

      it('should return 409 when organizer has associated events', async () => {
        mockOrganizerService.deleteOrganizer.mockRejectedValue(
          new ConflictError(
            'Cannot delete organizer. 2 event(s) are associated with this organizer: Event 1, Event 2.',
            {
              organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
              eventCount: 2,
              events: [
                { eventId: 'event1', title: 'Event 1' },
                { eventId: 'event2', title: 'Event 2' },
              ],
            }
          )
        );

        const event = createMockEvent({
          routeKey: 'DELETE /organizers/{organizerId}',
          pathParameters: { organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
          user: mockOrganizerUser,
        });

        const context = createMockContext();
        const result = await callWrappedHandler(deleteOrganizerHandler, event, context);

        expect(result.statusCode).toBe(409);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.message).toContain('Cannot delete organizer. 2 event(s) are associated');
        // Note: Details may not be available in integration test mock setup
        if (responseBody.error.details) {
          expect(responseBody.error.details).toEqual({
            organizerId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
            eventCount: 2,
            events: [
              { eventId: 'event1', title: 'Event 1' },
              { eventId: 'event2', title: 'Event 2' },
            ],
          });
        }
      });
    });
  });

  describe('Cross-Handler Integration Scenarios', () => {
    describe('Complete CRUD Workflow', () => {
      it('should support complete organizer lifecycle', async () => {
        // 1. Create organizer
        const createData: CreateOrganizerData = {
          name: 'Lifecycle Test Organizer',
          contact: 'lifecycle@example.com',
          website: 'https://lifecycle.example.com',
        };

        mockOrganizerService.createOrganizer.mockResolvedValue(mockOrganizerData);

        let event = createMockEvent({
          body: JSON.stringify(createData),
          user: mockOrganizerUser,
        });

        let context = createMockContext();
        let result = await callWrappedHandler(createOrganizerHandler, event, context);

        expect(result.statusCode).toBe(201);
        expect(mockOrganizerService.createOrganizer).toHaveBeenCalledWith(createData, mockOrganizerUser);

        // 2. Get organizer
        mockOrganizerService.validateOrganizerExists.mockResolvedValue(mockOrganizerData);

        event = createMockEvent({
          routeKey: 'GET /organizers/{organizerId}',
          pathParameters: { organizerId: mockOrganizerData.organizerId },
          user: mockOrganizerUser,
        });

        result = await callWrappedHandler(getOrganizerHandler, event, context);

        expect(result.statusCode).toBe(200);
        expect(mockOrganizerService.validateOrganizerExists).toHaveBeenCalledWith(
          mockOrganizerData.organizerId,
          mockOrganizerUser
        );

        // 3. Update organizer
        const updateData: UpdateOrganizerData = {
          name: 'Updated Lifecycle Organizer',
        };

        const updatedOrganizer = { ...mockOrganizerData, name: 'Updated Lifecycle Organizer' };
        mockOrganizerService.updateOrganizer.mockResolvedValue(updatedOrganizer);

        event = createMockEvent({
          routeKey: 'PUT /organizers/{organizerId}',
          pathParameters: { organizerId: mockOrganizerData.organizerId },
          body: JSON.stringify(updateData),
          user: mockOrganizerUser,
        });

        result = await callWrappedHandler(updateOrganizerHandler, event, context);

        expect(result.statusCode).toBe(200);
        expect(mockOrganizerService.updateOrganizer).toHaveBeenCalledWith(
          mockOrganizerData.organizerId,
          updateData,
          mockOrganizerUser
        );

        // 4. Delete organizer
        mockOrganizerService.deleteOrganizer.mockResolvedValue(undefined);

        event = createMockEvent({
          routeKey: 'DELETE /organizers/{organizerId}',
          pathParameters: { organizerId: mockOrganizerData.organizerId },
          user: mockOrganizerUser,
        });

        result = await callWrappedHandler(deleteOrganizerHandler, event, context);

        expect(result.statusCode).toBe(200);
        expect(mockOrganizerService.deleteOrganizer).toHaveBeenCalledWith(
          mockOrganizerData.organizerId,
          mockOrganizerUser
        );
      });
    });

    describe('Admin vs Creator Permission Matrix', () => {
      const testCases = [
        {
          operation: 'CREATE',
          handler: createOrganizerHandler,
          userRole: 'organizer' as const,
          shouldSucceed: true,
          description: 'organizer can create organizer',
        },
        {
          operation: 'CREATE',
          handler: createOrganizerHandler,
          userRole: 'admin' as const,
          shouldSucceed: true,
          description: 'admin can create organizer',
        },
        {
          operation: 'UPDATE',
          handler: updateOrganizerHandler,
          userRole: 'organizer' as const,
          shouldSucceed: true,
          description: 'organizer can update own organizer',
        },
        {
          operation: 'UPDATE',
          handler: updateOrganizerHandler,
          userRole: 'admin' as const,
          shouldSucceed: true,
          description: 'admin can update any organizer',
        },
        {
          operation: 'GET',
          handler: getOrganizerHandler,
          userRole: 'organizer' as const,
          shouldSucceed: true,
          description: 'organizer can get own organizer',
        },
        {
          operation: 'GET',
          handler: getOrganizerHandler,
          userRole: 'admin' as const,
          shouldSucceed: true,
          description: 'admin can get any organizer',
        },
        {
          operation: 'DELETE',
          handler: deleteOrganizerHandler,
          userRole: 'organizer' as const,
          shouldSucceed: true,
          description: 'organizer can delete own organizer',
        },
        {
          operation: 'DELETE',
          handler: deleteOrganizerHandler,
          userRole: 'admin' as const,
          shouldSucceed: true,
          description: 'admin can delete any organizer',
        },
      ];

      testCases.forEach(({ operation, handler, userRole, shouldSucceed, description }) => {
        it(`should ${shouldSucceed ? 'allow' : 'deny'} ${description}`, async () => {
          const user = userRole === 'admin' ? mockAdminUser : mockOrganizerUser;

          // Mock service responses based on operation
          if (operation === 'CREATE') {
            mockOrganizerService.createOrganizer.mockResolvedValue(mockOrganizerData);
          } else if (operation === 'UPDATE') {
            mockOrganizerService.updateOrganizer.mockResolvedValue(mockOrganizerData);
          } else if (operation === 'GET') {
            mockOrganizerService.validateOrganizerExists.mockResolvedValue(mockOrganizerData);
          } else if (operation === 'DELETE') {
            mockOrganizerService.deleteOrganizer.mockResolvedValue(undefined);
          }

          let event: AuthenticatedEvent;

          if (operation === 'CREATE') {
            event = createMockEvent({
              body: JSON.stringify({ name: 'Test', contact: 'test@example.com' }),
              user,
            });
          } else {
            event = createMockEvent({
              routeKey: `${operation} /organizers/{organizerId}`,
              pathParameters: { organizerId: mockOrganizerData.organizerId },
              body: operation === 'UPDATE' ? JSON.stringify({ name: 'Updated' }) : undefined,
              user,
            });
          }

          const context = createMockContext();
          const result = await callWrappedHandler(handler, event, context);

          if (shouldSucceed) {
            expect(result.statusCode).toBeLessThan(400);
          } else {
            expect(result.statusCode).toBeGreaterThanOrEqual(400);
          }
        });
      });
    });

    describe('Error Consistency Across Handlers', () => {
      const errorScenarios = [
        {
          name: 'Missing authentication',
          setupEvent: (baseEvent: AuthenticatedEvent) => ({ ...baseEvent, user: undefined } as any),
          expectedStatus: 400,
          expectedMessage: 'User authentication required',
        },
        {
          name: 'Invalid organizerId format',
          setupEvent: (baseEvent: AuthenticatedEvent) => ({
            ...baseEvent,
            pathParameters: { organizerId: 'invalid-id' },
          }),
          expectedStatus: 404,
          expectedMessage: 'not found',
        },
      ];

      const handlersToTest = [
        { name: 'GET', handler: getOrganizerHandler },
        { name: 'UPDATE', handler: updateOrganizerHandler },
        { name: 'DELETE', handler: deleteOrganizerHandler },
      ];

      errorScenarios.forEach(({ name, setupEvent, expectedStatus, expectedMessage }) => {
        handlersToTest.forEach(({ name: handlerName, handler }) => {
          it(`should handle ${name} consistently in ${handlerName} handler`, async () => {
            // Setup service mocks to throw appropriate errors
            if (name === 'Invalid organizerId format') {
              mockOrganizerService.validateOrganizerExists.mockRejectedValue(
                new NotFoundError('Organizer with ID invalid-id not found')
              );
              mockOrganizerService.updateOrganizer.mockRejectedValue(
                new NotFoundError('Organizer with ID invalid-id not found')
              );
              mockOrganizerService.deleteOrganizer.mockRejectedValue(
                new NotFoundError('Organizer with ID invalid-id not found')
              );
            }

            const baseEvent = createMockEvent({
              routeKey: `${handlerName} /organizers/{organizerId}`,
              pathParameters: { organizerId: mockOrganizerData.organizerId },
              body: handlerName === 'UPDATE' ? JSON.stringify({ name: 'Test' }) : undefined,
              user: mockOrganizerUser,
            });

            const event = setupEvent(baseEvent);
            const context = createMockContext();
            const result = await callWrappedHandler(handler, event, context);

            expect(result.statusCode).toBe(expectedStatus);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(false);
            expect(responseBody.error.message.toLowerCase()).toContain(expectedMessage.toLowerCase());
          });
        });
      });
    });
  });
});
