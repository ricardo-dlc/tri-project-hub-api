// Mock environment variables FIRST
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';

import { AuthenticatedEvent } from '@/shared/auth/middleware';
import { organizerService } from '../../services';

// Mock the organizer service
jest.mock('../../services', () => ({
  organizerService: {
    deleteOrganizer: jest.fn(),
  },
}));

// Mock the auth middleware
jest.mock('@/shared/auth/middleware', () => ({
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
  ConflictError: class ConflictError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConflictError';
    }
  },
}));

import { handler } from '../deleteOrganizer';

const mockOrganizerService = organizerService as jest.Mocked<typeof organizerService>;

// Get the mocked error classes
const { BadRequestError, ForbiddenError, NotFoundError, ConflictError } = jest.requireMock('../../../../shared');

describe('deleteOrganizer Handler', () => {
  const mockUser = {
    id: 'user_test123',
    role: 'organizer',
  };

  const createMockEvent = (
    organizerId: string = 'org_test123',
    user: any = mockUser
  ): AuthenticatedEvent => ({
    version: '2.0',
    routeKey: 'DELETE /organizers/{organizerId}',
    rawPath: `/organizers/${organizerId}`,
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'DELETE',
        path: `/organizers/${organizerId}`,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: 'DELETE /organizers/{organizerId}',
      stage: 'test',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200,
    },
    pathParameters: { organizerId },
    body: undefined,
    isBase64Encoded: false,
    user,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Deletions', () => {
    it('should delete organizer successfully', async () => {
      mockOrganizerService.deleteOrganizer.mockResolvedValue(undefined);

      const event = createMockEvent('org_test123');
      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: {
            statusCode: 204,
            body: null,
          },
        }),
      });

      expect(mockOrganizerService.deleteOrganizer).toHaveBeenCalledWith(
        'org_test123',
        mockUser
      );
    });

    it('should allow admin to delete any organizer', async () => {
      const adminUser = {
        id: 'admin_user123',
        role: 'admin',
      };

      mockOrganizerService.deleteOrganizer.mockResolvedValue(undefined);

      const event = createMockEvent('org_test123', adminUser);
      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: {
            statusCode: 204,
            body: null,
          },
        }),
      });

      expect(mockOrganizerService.deleteOrganizer).toHaveBeenCalledWith(
        'org_test123',
        adminUser
      );
    });
  });

  describe('Validation Errors', () => {
    it('should return BadRequestError when organizerId is missing', async () => {
      const event = createMockEvent('');
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

      expect(mockOrganizerService.deleteOrganizer).not.toHaveBeenCalled();
    });

    it('should return BadRequestError when user is missing', async () => {
      const event = createMockEvent('org_test123');
      (event as any).user = undefined; // Remove user property

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

      expect(mockOrganizerService.deleteOrganizer).not.toHaveBeenCalled();
    });
  });

  describe('Service Layer Errors', () => {
    it('should return NotFoundError from service', async () => {
      mockOrganizerService.deleteOrganizer.mockRejectedValue(
        new NotFoundError('Organizer with ID org_nonexistent not found')
      );

      const event = createMockEvent('org_nonexistent');
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

      expect(mockOrganizerService.deleteOrganizer).toHaveBeenCalledWith(
        'org_nonexistent',
        mockUser
      );
    });

    it('should return ForbiddenError from service for ownership validation', async () => {
      mockOrganizerService.deleteOrganizer.mockRejectedValue(
        new ForbiddenError('You can only modify organizers you created')
      );

      const event = createMockEvent('org_test123');
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

      expect(mockOrganizerService.deleteOrganizer).toHaveBeenCalledWith(
        'org_test123',
        mockUser
      );
    });

    it('should return ConflictError when organizer has associated events', async () => {
      mockOrganizerService.deleteOrganizer.mockRejectedValue(
        new ConflictError('Cannot delete organizer. 2 event(s) are associated with this organizer: Event 1, Event 2.')
      );

      const event = createMockEvent('org_test123');
      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Cannot delete organizer. 2 event(s) are associated with this organizer: Event 1, Event 2.',
          },
          data: null,
        }),
      });

      expect(mockOrganizerService.deleteOrganizer).toHaveBeenCalledWith(
        'org_test123',
        mockUser
      );
    });

    it('should handle generic service errors', async () => {
      mockOrganizerService.deleteOrganizer.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent('org_test123');
      const result = await handler(event, {} as any, {} as any);

      expect(result).toEqual({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Database connection failed',
          },
          data: null,
        }),
      });

      expect(mockOrganizerService.deleteOrganizer).toHaveBeenCalledWith(
        'org_test123',
        mockUser
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty organizerId in path parameters', async () => {
      const event = createMockEvent();
      event.pathParameters = { organizerId: '' };

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

      expect(mockOrganizerService.deleteOrganizer).not.toHaveBeenCalled();
    });

    it('should handle null pathParameters', async () => {
      const event = createMockEvent();
      event.pathParameters = null as any;

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

      expect(mockOrganizerService.deleteOrganizer).not.toHaveBeenCalled();
    });
  });
});
