// Mock environment variables FIRST
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';

import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { organizerService } from '../../services';
import { OrganizerItem, UpdateOrganizerData } from '../../types/organizer.types';

// Mock the organizer service
jest.mock('../../services', () => ({
  organizerService: {
    updateOrganizer: jest.fn(),
  },
}));

// Mock the auth middleware
jest.mock('../../../../shared/auth/middleware', () => ({
  withAuth: (handlerFn: any) => handlerFn,
}));

// Mock the shared middleware
jest.mock('../../../../shared', () => ({
  withMiddleware: (handlerFn: any) => async (event: any, context: any) => {
    try {
      const result = await handlerFn(event, context);
      return result;
    } catch (error: any) {
      throw error;
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
}));

import { handler } from '../updateOrganizer';

const mockOrganizerService = organizerService as jest.Mocked<typeof organizerService>;

// Get the mocked error classes
const { BadRequestError, ForbiddenError, NotFoundError } = jest.requireMock('../../../../shared');

describe('updateOrganizer Handler', () => {
  const mockUser = {
    id: 'user_test123',
    role: 'organizer',
  };

  const mockOrganizer: OrganizerItem = {
    organizerId: 'org_test123',
    clerkId: 'user_test123',
    name: 'Updated Test Organizer',
    contact: 'updated@example.com',
    website: 'https://updated.example.com',
    description: 'Updated test organizer description',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  };

  const createMockEvent = (
    organizerId: string = 'org_test123',
    body: any = {},
    user: any = mockUser
  ): AuthenticatedEvent => ({
    version: '2.0',
    routeKey: 'PUT /organizers/{organizerId}',
    rawPath: `/organizers/${organizerId}`,
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'PUT',
        path: `/organizers/${organizerId}`,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: 'PUT /organizers/{organizerId}',
      stage: 'test',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200,
    },
    pathParameters: { organizerId },
    body: JSON.stringify(body),
    isBase64Encoded: false,
    user,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Updates', () => {
    it('should update organizer with valid data', async () => {
      const updateData: UpdateOrganizerData = {
        name: 'Updated Test Organizer',
        contact: 'updated@example.com',
      };

      mockOrganizerService.updateOrganizer.mockResolvedValue(mockOrganizer);

      const event = createMockEvent('org_test123', updateData);
      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: {
            statusCode: 200,
            body: {
              organizer: mockOrganizer,
            },
          },
        }),
      });

      expect(mockOrganizerService.updateOrganizer).toHaveBeenCalledWith(
        'org_test123',
        updateData,
        mockUser
      );
    });

    it('should update organizer with partial data', async () => {
      const updateData: UpdateOrganizerData = {
        name: 'Updated Name Only',
      };

      const partiallyUpdatedOrganizer = {
        ...mockOrganizer,
        name: 'Updated Name Only',
      };

      mockOrganizerService.updateOrganizer.mockResolvedValue(partiallyUpdatedOrganizer);

      const event = createMockEvent('org_test123', updateData);
      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: {
            statusCode: 200,
            body: {
              organizer: partiallyUpdatedOrganizer,
            },
          },
        }),
      });

      expect(mockOrganizerService.updateOrganizer).toHaveBeenCalledWith(
        'org_test123',
        updateData,
        mockUser
      );
    });

    it('should allow admin to update any organizer', async () => {
      const adminUser = {
        id: 'admin_user123',
        role: 'admin',
      };

      const updateData: UpdateOrganizerData = {
        name: 'Admin Updated Organizer',
      };

      mockOrganizerService.updateOrganizer.mockResolvedValue(mockOrganizer);

      const event = createMockEvent('org_test123', updateData, adminUser);
      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: {
            statusCode: 200,
            body: {
              organizer: mockOrganizer,
            },
          },
        }),
      });

      expect(mockOrganizerService.updateOrganizer).toHaveBeenCalledWith(
        'org_test123',
        updateData,
        adminUser
      );
    });
  });

  describe('Validation Errors', () => {
    it('should return BadRequestError when organizerId is missing', async () => {
      const event = createMockEvent('', { name: 'Test' });
      event.pathParameters = {};

      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Organizer ID is required in path parameters',
            code: 'BAD_REQUEST',
          },
          data: null,
        }),
      });
    });

    it('should return BadRequestError when body is missing', async () => {
      const event = createMockEvent();
      event.body = null as any;

      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Request body is required',
            code: 'BAD_REQUEST',
          },
          data: null,
        }),
      });
    });

    it('should return BadRequestError when body is invalid JSON', async () => {
      const event = createMockEvent();
      event.body = 'invalid json';

      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Invalid JSON in request body',
            code: 'BAD_REQUEST',
          },
          data: null,
        }),
      });
    });

    it('should return BadRequestError when user is missing', async () => {
      const event = createMockEvent('org_test123', { name: 'Test' });
      delete event.user; // Remove user property entirely

      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'User authentication required',
            code: 'BAD_REQUEST',
          },
          data: null,
        }),
      });
    });
  });

  describe('Service Layer Errors', () => {
    it('should return NotFoundError from service', async () => {
      const updateData: UpdateOrganizerData = {
        name: 'Updated Name',
      };

      mockOrganizerService.updateOrganizer.mockRejectedValue(
        new NotFoundError('Organizer with ID org_nonexistent not found')
      );

      const event = createMockEvent('org_nonexistent', updateData);
      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Organizer with ID org_nonexistent not found',
          },
          data: null,
        }),
      });
    });

    it('should return ForbiddenError from service for ownership validation', async () => {
      const updateData: UpdateOrganizerData = {
        name: 'Updated Name',
      };

      mockOrganizerService.updateOrganizer.mockRejectedValue(
        new ForbiddenError('You can only modify organizers you created')
      );

      const event = createMockEvent('org_test123', updateData);
      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'You can only modify organizers you created',
          },
          data: null,
        }),
      });
    });

    it('should return validation errors from service', async () => {
      const updateData: UpdateOrganizerData = {
        name: '', // Invalid empty name
      };

      mockOrganizerService.updateOrganizer.mockRejectedValue(
        new Error('Name must be a non-empty string')
      );

      const event = createMockEvent('org_test123', updateData);
      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Name must be a non-empty string',
          },
          data: null,
        }),
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty update data object', async () => {
      const updateData = {};

      mockOrganizerService.updateOrganizer.mockRejectedValue(
        new Error('At least one field must be provided for update')
      );

      const event = createMockEvent('org_test123', updateData);
      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'At least one field must be provided for update',
          },
          data: null,
        }),
      });
    });

    it('should handle null values in update data', async () => {
      const updateData = {
        name: 'Valid Name',
        website: null as any, // This should be handled by validation
      };

      mockOrganizerService.updateOrganizer.mockRejectedValue(
        new Error('Website must be a string')
      );

      const event = createMockEvent('org_test123', updateData);
      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Website must be a string',
          },
          data: null,
        }),
      });
    });
  });
});