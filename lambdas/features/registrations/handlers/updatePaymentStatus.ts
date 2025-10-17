import { EventEntity } from '@/features/events/models/event.model';
import { paymentStatusService, PaymentStatusUpdateResult } from '@/features/registrations/services/payment-status.service';
import { AuthenticatedEvent, withAuth } from '@/shared/auth/middleware';
import { BadRequestError, ForbiddenError, NotFoundError, ValidationError } from '@/shared/errors';
import { createFeatureLogger } from '@/shared/logger';
import { isValidReservationId } from '@/shared/utils/ulid';
import { withMiddleware } from '@/shared/wrapper';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';

const logger = createFeatureLogger('registrations');

/**
 * Request body interface for payment status update
 */
interface UpdatePaymentStatusRequest {
  paymentStatus: boolean;
  paymentDate?: string;
}

/**
 * Response interface for successful payment status update
 */
interface UpdatePaymentStatusResponse {
  reservationId: string;
  paymentStatus: boolean;
  paymentDate: string;
  totalParticipants: number;
  message: string;
}

/**
 * Validates the request body structure and required fields
 * @param body - The parsed request body
 * @throws ValidationError if validation fails
 */
const validateRequestBody = (body: any): UpdatePaymentStatusRequest => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a valid JSON object');
  }

  // Check for required fields
  if (body.paymentStatus === undefined) {
    throw new ValidationError('Missing required field: paymentStatus');
  }

  // Validate field types
  if (typeof body.paymentStatus !== 'boolean') {
    throw new ValidationError('Payment status must be a boolean');
  }

  // Validate optional paymentDate if provided
  if (body.paymentDate !== undefined) {
    if (typeof body.paymentDate !== 'string') {
      throw new ValidationError('Payment date must be a string if provided');
    }

    // Validate ISO date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!dateRegex.test(body.paymentDate)) {
      throw new ValidationError('Payment date must be in ISO 8601 format (e.g., 2024-01-01T12:00:00.000Z)');
    }

    // Validate that the date is parseable
    const parsedDate = new Date(body.paymentDate);
    if (isNaN(parsedDate.getTime())) {
      throw new ValidationError('Payment date must be a valid date');
    }
  }

  return {
    paymentStatus: body.paymentStatus,
    paymentDate: body.paymentDate,
  };
};

/**
 * Parses and validates the request body
 * @param event - The API Gateway event
 * @returns Parsed and validated request body
 * @throws BadRequestError if body is missing or invalid JSON
 * @throws ValidationError if validation fails
 */
const parseRequestBody = (event: APIGatewayProxyEventV2): UpdatePaymentStatusRequest => {
  if (!event.body) {
    throw new BadRequestError('Request body is required');
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(event.body);
  } catch (error) {
    throw new BadRequestError('Invalid JSON in request body');
  }

  return validateRequestBody(parsedBody);
};

/**
 * Validates payment status transitions
 * @param currentStatus - Current payment status
 * @param newStatus - New payment status
 * @throws ValidationError if transition is invalid
 */
const validatePaymentStatusTransition = (currentStatus: boolean, newStatus: boolean): void => {
  // Allow any transition for now, but log warnings for unusual patterns
  if (currentStatus === newStatus) {
    logger.warn({ currentStatus, newStatus }, 'Payment status unchanged');
  }

  // Business rule: Allow both paid -> unpaid and unpaid -> paid transitions
  // This allows for refunds and payment corrections
  logger.info({ currentStatus, newStatus }, 'Payment status transition validated');
};

/**
 * Validates that the user has permission to update payment status for this registration
 * @param reservationId - The reservation ID
 * @param userId - The authenticated user ID
 * @param userRole - The authenticated user role
 * @throws ForbiddenError if user doesn't have permission
 */
const validatePaymentUpdatePermission = async (
  reservationId: string,
  userId: string,
  userRole?: 'organizer' | 'admin'
): Promise<void> => {
  // Admins can update any payment status
  if (userRole === 'admin') {
    logger.debug({ userId, userRole, reservationId }, 'Admin access granted for payment update');
    return;
  }

  // For organizers, check if they own the event
  if (userRole === 'organizer') {
    // Get the registration to find the eventId
    const registration = await paymentStatusService.getRegistrationByReservationId(reservationId);

    if (!registration) {
      throw new NotFoundError('Registration not found', { reservationId });
    }

    // Get the event to check ownership
    try {
      const eventResult = await EventEntity.get({ eventId: registration.eventId }).go();

      if (!eventResult.data) {
        throw new NotFoundError(`Event with ID ${registration.eventId} not found`);
      }

      const event = eventResult.data;

      // Check if the organizer is the creator of this event
      if (event.creatorId !== userId) {
        throw new ForbiddenError('Access denied. You can only update payment status for registrations in events you created.', {
          eventId: registration.eventId,
          userId,
          eventCreatorId: event.creatorId,
        });
      }

      logger.debug({ userId, eventId: registration.eventId, reservationId }, 'Event owner access granted for payment update');
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ForbiddenError) {
        throw error;
      }
      throw new Error(`Failed to validate event access: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    // No valid role
    throw new ForbiddenError('Access denied. Only organizers and admins can update payment status.');
  }
};

/**
 * Lambda handler for updating payment status
 * PATCH /registrations/{reservationId}/payment
 */
const updatePaymentStatusHandler = async (event: AuthenticatedEvent) => {
  // Extract and validate reservationId from path parameters
  const { reservationId } = event.pathParameters ?? {};

  if (!reservationId || reservationId.trim() === '') {
    throw new BadRequestError('Missing reservationId parameter in path');
  }

  // Validate reservationId format (must be valid ULID)
  if (!isValidReservationId(reservationId)) {
    throw new BadRequestError('Invalid reservationId format. Must be a valid ULID.', { reservationId });
  }

  // Parse and validate request body
  const updateData = parseRequestBody(event);

  logger.info({
    reservationId,
    paymentStatus: updateData.paymentStatus,
    paymentDate: updateData.paymentDate,
    userId: event.user.id,
    userRole: event.user.role
  }, 'Processing payment status update');

  // Validate user permission to update payment status
  await validatePaymentUpdatePermission(reservationId, event.user.id, event.user.role);

  // Check if registration exists and get current status for validation
  const currentRegistration = await paymentStatusService.getRegistrationByReservationId(reservationId);

  if (!currentRegistration) {
    throw new NotFoundError('Registration not found', { reservationId });
  }

  // Validate payment status transition
  validatePaymentStatusTransition(currentRegistration.paymentStatus, updateData.paymentStatus);

  // Update payment status using the service
  const result: PaymentStatusUpdateResult = await paymentStatusService.updatePaymentStatus({
    reservationId,
    paymentStatus: updateData.paymentStatus,
    paymentDate: updateData.paymentDate,
  });

  logger.info({
    reservationId: result.reservationId,
    paymentStatus: result.paymentStatus,
    totalParticipants: result.totalParticipants
  }, 'Payment status updated successfully');

  // Format the response
  const response: UpdatePaymentStatusResponse = {
    reservationId: result.reservationId,
    paymentStatus: result.paymentStatus,
    paymentDate: result.paymentDate,
    totalParticipants: result.totalParticipants,
    message: `Payment status updated to ${result.paymentStatus ? 'paid' : 'unpaid'} successfully`,
  };

  return {
    statusCode: 200,
    data: response,
  };
};

// Export wrapped handler with authentication
export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(updatePaymentStatusHandler, {
    requiredRoles: ['organizer', 'admin'],
  }),
  {
    cors: {
      origin: '*',
      methods: ['PATCH', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
      credentials: false,
    },
    errorLogging: true,
  }
);