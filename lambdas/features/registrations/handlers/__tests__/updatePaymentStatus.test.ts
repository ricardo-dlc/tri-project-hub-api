import { NotFoundError, ValidationError, ForbiddenError, NotAuthorizedError } from '@/shared/errors';
import { generateReservationId } from '@/shared/utils/ulid';
import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { paymentStatusService } from '../../services/payment-status.service';
import { EventEntity } from '@/features/events/models/event.model';
import { handler } from '../updatePaymentStatus';

// Mock the payment status service
jest.mock('../../services/payment-status.service', () => ({
  paymentStatusService: {
    getRegistrationByReservationId: jest.fn(),
    updatePaymentStatus: jest.fn(),
  },
}));

// Mock the event entity
jest.mock('@/features/events/models/event.model', () => ({
  EventEntity: {
    get: jest.fn().mockReturnValue({
      go: jest.fn(),
    }),
  },
}));

// Mock the auth middleware
jest.mock('@/shared/auth/middleware', () => ({
  withAuth: jest.fn((handler, options) => {
    return async (event: any, context: any) => {
      // Check if authorization header is present
      const authHeader = event.headers?.authorization || event.headers?.Authorization;
      if (!authHeader) {
        throw new NotAuthorizedError('Missing authorization header');
      }

      // Mock user based on test scenarios
      const mockUser = event.mockUser || { id: 'user123', role: 'organizer', email: 'test@example.com' };
      
      // Check required roles
      if (options?.requiredRoles && options.requiredRoles.length > 0) {
        if (!mockUser.role || !options.requiredRoles.includes(mockUser.role)) {
          throw new ForbiddenError(`Access denied. Required roles: ${options.requiredRoles.join(', ')}`);
        }
      }

      const authenticatedEvent = { ...event, user: mockUser };
      return await handler(authenticatedEvent, context);
    };
  }),
  AuthenticatedEvent: {} as any,
}));

// Mock the logger
jest.mock('@/shared/logger', () => ({
  createFeatureLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('updatePaymentStatus handler', () => {
  let mockPaymentStatusService: jest.Mocked<typeof paymentStatusService>;
  let mockEventEntityGet: jest.Mock;

  beforeEach(() => {
    mockPaymentStatusService = paymentStatusService as jest.Mocked<typeof paymentStatusService>;
    mockEventEntityGet = EventEntity.get as jest.Mock;
    jest.clearAllMocks();
  });

  // Helper function to call handler and ensure proper typing
  const callHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    return await handler(event, {} as any, {} as any) as APIGatewayProxyStructuredResultV2;
  };

  const createMockEvent = (
    reservationId: string,
    body: any,
    method: string = 'PATCH',
    mockUser?: any
  ): APIGatewayProxyEventV2 & { mockUser?: any } => ({
    version: '2.0',
    routeKey: `${method} /registrations/{reservationId}/payment`,
    rawPath: `/registrations/${reservationId}/payment`,
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer mock-token',
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'api.example.com',
      domainPrefix: 'api',
      http: {
        method,
        path: `/registrations/${reservationId}/payment`,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'request-id',
      routeKey: `${method} /registrations/{reservationId}/payment`,
      stage: 'test',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200,
    },
    pathParameters: {
      reservationId,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
    mockUser,
  });

  const mockRegistrationData = {
    reservationId: generateReservationId(),
    eventId: generateReservationId(),
    registrationType: 'individual' as const,
    paymentStatus: false,
    totalParticipants: 1,
    registrationFee: 100,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    paymentDate: '2024-01-01T00:00:00.000Z'
  };

  describe('successful payment status updates', () => {
    beforeEach(() => {
      // Mock registration data for all successful tests
      mockPaymentStatusService.getRegistrationByReservationId.mockResolvedValue(mockRegistrationData);
    });

    it('should successfully update payment status to paid', async () => {
      const reservationId = generateReservationId();
      const requestBody = {
        paymentStatus: true,
      };

      // Mock successful update
      const updateResult = {
        success: true,
        reservationId,
        paymentStatus: true,
        paymentDate: '2024-01-01T12:00:00.000Z',
        totalParticipants: 1,
      };
      mockPaymentStatusService.updatePaymentStatus.mockResolvedValue(updateResult);

      // Mock admin user for simplicity
      const adminUser = { id: 'admin123', role: 'admin', email: 'admin@example.com' };
      const event = createMockEvent(reservationId, requestBody, 'PATCH', adminUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(200);
      expect(result.body).toBeDefined();

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.data).toEqual({
        reservationId,
        paymentStatus: true,
        paymentDate: '2024-01-01T12:00:00.000Z',
        totalParticipants: 1,
        message: 'Payment status updated to paid successfully',
      });

      expect(mockPaymentStatusService.getRegistrationByReservationId).toHaveBeenCalledWith(reservationId);
      expect(mockPaymentStatusService.updatePaymentStatus).toHaveBeenCalledWith({
        reservationId,
        paymentStatus: true,
        paymentDate: undefined,
      });
    });

    it('should successfully update payment status to unpaid', async () => {
      const reservationId = generateReservationId();
      const requestBody = {
        paymentStatus: false,
      };

      // Mock successful update
      const updateResult = {
        success: true,
        reservationId,
        paymentStatus: false,
        paymentDate: '2024-01-01T12:00:00.000Z',
        totalParticipants: 1,
      };
      mockPaymentStatusService.updatePaymentStatus.mockResolvedValue(updateResult);

      const adminUser = { id: 'admin123', role: 'admin', email: 'admin@example.com' };
      const event = createMockEvent(reservationId, requestBody, 'PATCH', adminUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.data.paymentStatus).toBe(false);
      expect(responseBody.data.message).toBe('Payment status updated to unpaid successfully');
    });

    it('should successfully update payment status with custom payment date', async () => {
      const reservationId = generateReservationId();
      const customPaymentDate = '2024-02-01T15:30:00.000Z';
      const requestBody = {
        paymentStatus: true,
        paymentDate: customPaymentDate,
      };

      const updateResult = {
        success: true,
        reservationId,
        paymentStatus: true,
        paymentDate: customPaymentDate,
        totalParticipants: 1,
      };
      mockPaymentStatusService.updatePaymentStatus.mockResolvedValue(updateResult);

      const adminUser = { id: 'admin123', role: 'admin', email: 'admin@example.com' };
      const event = createMockEvent(reservationId, requestBody, 'PATCH', adminUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.data.paymentDate).toBe(customPaymentDate);

      expect(mockPaymentStatusService.updatePaymentStatus).toHaveBeenCalledWith({
        reservationId,
        paymentStatus: true,
        paymentDate: customPaymentDate,
      });
    });

    it('should handle team registration payment status update', async () => {
      const reservationId = generateReservationId();
      const requestBody = {
        paymentStatus: true,
      };

      const updateResult = {
        success: true,
        reservationId,
        paymentStatus: true,
        paymentDate: '2024-01-01T12:00:00.000Z',
        totalParticipants: 3,
      };
      mockPaymentStatusService.updatePaymentStatus.mockResolvedValue(updateResult);

      const adminUser = { id: 'admin123', role: 'admin', email: 'admin@example.com' };
      const event = createMockEvent(reservationId, requestBody, 'PATCH', adminUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.data.totalParticipants).toBe(3);
    });
  });

  describe('ULID validation', () => {
    it('should reject invalid ULID format in reservationId', async () => {
      const invalidReservationId = 'invalid-id';
      const requestBody = {
        paymentStatus: true,
      };

      const adminUser = { id: 'admin123', role: 'admin', email: 'admin@example.com' };
      const event = createMockEvent(invalidReservationId, requestBody, 'PATCH', adminUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Invalid reservationId format');
      expect(responseBody.error.details.reservationId).toBe(invalidReservationId);

      expect(mockPaymentStatusService.getRegistrationByReservationId).not.toHaveBeenCalled();
      expect(mockPaymentStatusService.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it('should reject empty reservationId', async () => {
      const requestBody = {
        paymentStatus: true,
      };

      const event = createMockEvent('', requestBody);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Missing reservationId parameter');
    });

    it('should reject reservationId with invalid characters', async () => {
      const invalidReservationId = '01ARZ3NDEKTSV4RRFFQ69G5FA@'; // Contains invalid character @
      const requestBody = {
        paymentStatus: true,
      };

      const event = createMockEvent(invalidReservationId, requestBody);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Invalid reservationId format');
    });

    it('should reject reservationId with wrong length', async () => {
      const shortId = '01ARZ3NDEKTSV4RRFFQ69G5FA'; // 25 characters instead of 26
      const requestBody = {
        paymentStatus: true,
      };

      const event = createMockEvent(shortId, requestBody);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Invalid reservationId format');
    });
  });

  describe('request body validation', () => {
    const validReservationId = generateReservationId();

    it('should reject missing request body', async () => {
      const adminUser = { id: 'admin123', role: 'admin', email: 'admin@example.com' };
      const event = createMockEvent(validReservationId, null, 'PATCH', adminUser);
      event.body = undefined;

      const result = await callHandler(event);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Request body is required');
    });

    it('should reject invalid JSON in request body', async () => {
      const event = createMockEvent(validReservationId, {});
      event.body = 'invalid json {';

      const result = await callHandler(event);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Invalid JSON in request body');
    });

    it('should reject missing paymentStatus field', async () => {
      const requestBody = {};

      const event = createMockEvent(validReservationId, requestBody);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(422);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Missing required field: paymentStatus');
    });

    it('should reject non-boolean paymentStatus', async () => {
      const requestBody = {
        paymentStatus: 'true', // String instead of boolean
      };

      const event = createMockEvent(validReservationId, requestBody);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(422);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Payment status must be a boolean');
    });

    it('should reject invalid paymentDate format', async () => {
      const requestBody = {
        paymentStatus: true,
        paymentDate: 'invalid-date',
      };

      const event = createMockEvent(validReservationId, requestBody);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(422);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Payment date must be in ISO 8601 format');
    });

    it('should reject non-string paymentDate', async () => {
      const requestBody = {
        paymentStatus: true,
        paymentDate: 123456789, // Number instead of string
      };

      const event = createMockEvent(validReservationId, requestBody);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(422);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Payment date must be a string if provided');
    });

    it('should reject unparseable paymentDate', async () => {
      const requestBody = {
        paymentStatus: true,
        paymentDate: '2024-13-45T25:70:90.000Z', // Invalid date values
      };

      const event = createMockEvent(validReservationId, requestBody);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(422);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Payment date must be a valid date');
    });

    it('should accept valid ISO date formats', async () => {
      const validReservationId = generateReservationId();
      const validDates = [
        '2024-01-01T12:00:00.000Z',
        '2024-01-01T12:00:00Z',
        '2024-12-31T23:59:59.999Z',
      ];

      mockPaymentStatusService.getRegistrationByReservationId.mockResolvedValue(mockRegistrationData);
      mockPaymentStatusService.updatePaymentStatus.mockResolvedValue({
        success: true,
        reservationId: validReservationId,
        paymentStatus: true,
        paymentDate: '2024-01-01T12:00:00.000Z',
        totalParticipants: 1,
      });

      const adminUser = { id: 'admin123', role: 'admin', email: 'admin@example.com' };

      for (const date of validDates) {
        const requestBody = {
          paymentStatus: true,
          paymentDate: date,
        };

        const event = createMockEvent(validReservationId, requestBody, 'PATCH', adminUser);
        const result = await callHandler(event);

        expect(result.statusCode).toBe(200);
      }
    });
  });

  describe('error handling', () => {
    const validReservationId = generateReservationId();
    const validRequestBody = {
      paymentStatus: true,
    };

    it('should handle registration not found', async () => {
      mockPaymentStatusService.getRegistrationByReservationId.mockResolvedValue(null);

      const event = createMockEvent(validReservationId, validRequestBody);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(404);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Registration not found');
      expect(responseBody.error.details.reservationId).toBe(validReservationId);

      expect(mockPaymentStatusService.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it('should handle service validation errors', async () => {
      mockPaymentStatusService.getRegistrationByReservationId.mockResolvedValue(mockRegistrationData);
      mockPaymentStatusService.updatePaymentStatus.mockRejectedValue(
        new ValidationError('Invalid reservation ID format', { field: 'reservationId' })
      );

      const adminUser = { id: 'admin123', role: 'admin', email: 'admin@example.com' };
      const event = createMockEvent(validReservationId, validRequestBody, 'PATCH', adminUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(422);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Invalid reservation ID format');
    });

    it('should handle service not found errors', async () => {
      mockPaymentStatusService.getRegistrationByReservationId.mockResolvedValue(mockRegistrationData);
      mockPaymentStatusService.updatePaymentStatus.mockRejectedValue(
        new NotFoundError('Registration not found', { reservationId: validReservationId })
      );

      const adminUser = { id: 'admin123', role: 'admin', email: 'admin@example.com' };
      const event = createMockEvent(validReservationId, validRequestBody, 'PATCH', adminUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(404);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Registration not found');
    });

    it('should handle database errors', async () => {
      mockPaymentStatusService.getRegistrationByReservationId.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent(validReservationId, validRequestBody);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(500);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Database connection failed');
    });

    it('should handle update operation failures', async () => {
      mockPaymentStatusService.getRegistrationByReservationId.mockResolvedValue(mockRegistrationData);
      mockPaymentStatusService.updatePaymentStatus.mockRejectedValue(
        new Error('Failed to update payment status: Update operation failed')
      );

      const adminUser = { id: 'admin123', role: 'admin', email: 'admin@example.com' };
      const event = createMockEvent(validReservationId, validRequestBody, 'PATCH', adminUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(500);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Failed to update payment status');
    });
  });

  describe('payment status transition validation', () => {
    const validReservationId = generateReservationId();
    const adminUser = { id: 'admin123', role: 'admin', email: 'admin@example.com' };

    beforeEach(() => {
      mockPaymentStatusService.getRegistrationByReservationId.mockResolvedValue(mockRegistrationData);
    });

    it('should allow transition from unpaid to paid', async () => {
      mockPaymentStatusService.updatePaymentStatus.mockResolvedValue({
        success: true,
        reservationId: validReservationId,
        paymentStatus: true,
        paymentDate: '2024-01-01T12:00:00.000Z',
        totalParticipants: 1,
      });

      const requestBody = { paymentStatus: true };
      const event = createMockEvent(validReservationId, requestBody, 'PATCH', adminUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.data.paymentStatus).toBe(true);
    });

    it('should allow transition from paid to unpaid (refund scenario)', async () => {
      mockPaymentStatusService.updatePaymentStatus.mockResolvedValue({
        success: true,
        reservationId: validReservationId,
        paymentStatus: false,
        paymentDate: '2024-01-01T12:00:00.000Z',
        totalParticipants: 1,
      });

      const requestBody = { paymentStatus: false };
      const event = createMockEvent(validReservationId, requestBody, 'PATCH', adminUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.data.paymentStatus).toBe(false);
    });

    it('should allow setting same status (idempotent operation)', async () => {
      mockPaymentStatusService.updatePaymentStatus.mockResolvedValue({
        success: true,
        reservationId: validReservationId,
        paymentStatus: true,
        paymentDate: '2024-01-01T12:00:00.000Z',
        totalParticipants: 1,
      });

      const requestBody = { paymentStatus: true };
      const event = createMockEvent(validReservationId, requestBody, 'PATCH', adminUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.data.paymentStatus).toBe(true);
    });
  });

  describe('authentication and authorization', () => {
    const validReservationId = generateReservationId();
    const validRequestBody = { paymentStatus: true };
    const eventId = generateReservationId();
    const organizerId = 'organizer123';

    beforeEach(() => {
      // Mock registration data
      mockPaymentStatusService.getRegistrationByReservationId.mockResolvedValue({
        ...mockRegistrationData,
        eventId,
      });

      // Mock successful update
      mockPaymentStatusService.updatePaymentStatus.mockResolvedValue({
        success: true,
        reservationId: validReservationId,
        paymentStatus: true,
        paymentDate: '2024-01-01T12:00:00.000Z',
        totalParticipants: 1,
      });
    });

    it('should reject requests without authorization header', async () => {
      const event = createMockEvent(validReservationId, validRequestBody);
      delete event.headers.authorization;

      const result = await callHandler(event);

      expect(result.statusCode).toBe(401);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Missing authorization header');
    });

    it('should reject users without required roles', async () => {
      const event = createMockEvent(validReservationId, validRequestBody, 'PATCH', {
        id: 'user123',
        role: 'participant', // Invalid role
        email: 'test@example.com',
      });

      const result = await callHandler(event);

      expect(result.statusCode).toBe(403);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Access denied. Required roles: organizer, admin');
    });

    it('should allow admin to update any payment status', async () => {
      const adminUser = {
        id: 'admin123',
        role: 'admin',
        email: 'admin@example.com',
      };

      const event = createMockEvent(validReservationId, validRequestBody, 'PATCH', adminUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.data.paymentStatus).toBe(true);

      // Admin should not need event ownership validation
      expect(mockEventEntityGet).not.toHaveBeenCalled();
    });

    it('should allow event owner to update payment status', async () => {
      const organizerUser = {
        id: organizerId,
        role: 'organizer',
        email: 'organizer@example.com',
      };

      // Mock event with matching creator
      mockEventEntityGet.mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: {
            eventId,
            creatorId: organizerId,
            title: 'Test Event',
          },
        }),
      });

      const event = createMockEvent(validReservationId, validRequestBody, 'PATCH', organizerUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.data.paymentStatus).toBe(true);

      expect(mockEventEntityGet).toHaveBeenCalledWith({ eventId });
    });

    it('should reject organizer who does not own the event', async () => {
      const otherOrganizerId = 'other-organizer';
      const organizerUser = {
        id: otherOrganizerId,
        role: 'organizer',
        email: 'other@example.com',
      };

      // Mock event with different creator
      mockEventEntityGet.mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: {
            eventId,
            creatorId: organizerId, // Different from the requesting user
            title: 'Test Event',
          },
        }),
      });

      const event = createMockEvent(validReservationId, validRequestBody, 'PATCH', organizerUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(403);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Access denied. You can only update payment status for registrations in events you created.');
      expect(responseBody.error.details.eventId).toBe(eventId);
      expect(responseBody.error.details.userId).toBe(otherOrganizerId);
      expect(responseBody.error.details.eventCreatorId).toBe(organizerId);
    });

    it('should handle event not found during authorization', async () => {
      const organizerUser = {
        id: organizerId,
        role: 'organizer',
        email: 'organizer@example.com',
      };

      // Mock event not found
      mockEventEntityGet.mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: null }),
      });

      const event = createMockEvent(validReservationId, validRequestBody, 'PATCH', organizerUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(404);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain(`Event with ID ${eventId} not found`);
    });

    it('should handle registration not found during authorization', async () => {
      const organizerUser = {
        id: organizerId,
        role: 'organizer',
        email: 'organizer@example.com',
      };

      // Mock registration not found
      mockPaymentStatusService.getRegistrationByReservationId.mockResolvedValue(null);

      const event = createMockEvent(validReservationId, validRequestBody, 'PATCH', organizerUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(404);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Registration not found');
      expect(responseBody.error.details.reservationId).toBe(validReservationId);
    });

    it('should handle database errors during event access validation', async () => {
      const organizerUser = {
        id: organizerId,
        role: 'organizer',
        email: 'organizer@example.com',
      };

      // Mock database error
      mockEventEntityGet.mockReturnValue({
        go: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      });

      const event = createMockEvent(validReservationId, validRequestBody, 'PATCH', organizerUser);
      const result = await callHandler(event);

      expect(result.statusCode).toBe(500);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Failed to validate event access');
    });
  });

  describe('edge cases', () => {
    it('should handle missing pathParameters', async () => {
      const requestBody = { paymentStatus: true };
      const event = createMockEvent('', requestBody);
      event.pathParameters = undefined;

      const result = await callHandler(event);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Missing reservationId parameter');
    });

    it('should handle empty pathParameters object', async () => {
      const requestBody = { paymentStatus: true };
      const event = createMockEvent('', requestBody);
      event.pathParameters = {};

      const result = await callHandler(event);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Missing reservationId parameter');
    });

    it('should handle whitespace-only reservationId', async () => {
      const requestBody = { paymentStatus: true };
      const event = createMockEvent('   ', requestBody);

      const result = await callHandler(event);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toContain('Missing reservationId parameter');
    });

    it('should handle array as request body', async () => {
      const validReservationId = generateReservationId();
      const event = createMockEvent(validReservationId, []);

      const result = await callHandler(event);

      expect(result.statusCode).toBe(422);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Request body must be a valid JSON object');
    });

    it('should handle null as request body object', async () => {
      const validReservationId = generateReservationId();
      const event = createMockEvent(validReservationId, null);

      const result = await callHandler(event);

      expect(result.statusCode).toBe(422);

      const responseBody = JSON.parse(result.body!);
      expect(responseBody.error.message).toBe('Request body must be a valid JSON object');
    });
  });
});
