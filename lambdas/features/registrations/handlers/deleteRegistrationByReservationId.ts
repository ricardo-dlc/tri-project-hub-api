import { participantQueryService, DeletionResult } from '@/features/registrations/services/participant-query.service';
import { AuthenticatedEvent, withAuth } from '@/shared/auth/middleware';
import { BadRequestError } from '@/shared/errors';
import { createFeatureLogger } from '@/shared/logger';
import { isValidULID } from '@/shared/utils/ulid';
import { withMiddleware } from '@/shared/wrapper';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

const logger = createFeatureLogger('registrations');

/**
 * Response interface for RSVP deletion
 */
interface RSVPDeletionResponse {
  success: boolean;
  reservationId: string;
  deletedParticipantCount: number;
  eventId: string;
  message: string;
}

/**
 * Transforms the service response to the API response format
 * @param deletionResult - The deletion result from the service
 * @returns RSVPDeletionResponse - Formatted response for the API
 */
const transformToApiResponse = (deletionResult: DeletionResult): RSVPDeletionResponse => {
  return {
    success: deletionResult.success,
    reservationId: deletionResult.reservationId,
    deletedParticipantCount: deletionResult.deletedParticipantCount,
    eventId: deletionResult.eventId,
    message: deletionResult.message,
  };
};

/**
 * Lambda handler for deleting RSVP by reservation ID
 * DELETE /registrations/{reservationId}
 */
const deleteRegistrationByReservationIdHandler = async (event: AuthenticatedEvent) => {
  const { reservationId } = event.pathParameters ?? {};

  // Validate reservation ID parameter
  if (!reservationId || reservationId.trim() === '') {
    logger.warn('Missing reservationId in path parameters');
    throw new BadRequestError('Missing reservationId parameter in path');
  }

  // Validate reservation ID format (must be valid ULID)
  if (!isValidULID(reservationId)) {
    logger.warn({ reservationId }, 'Invalid reservationId format');
    throw new BadRequestError('Invalid reservationId format. Must be a valid ULID.', { reservationId });
  }

  const organizerId = event.user.id;
  logger.info({ reservationId, organizerId }, 'Delete registration request received');

  try {
    // Execute atomic deletion operation using the service
    const deletionResult = await participantQueryService.deleteRegistrationByReservationId(reservationId, organizerId);

    logger.info({
      reservationId,
      eventId: deletionResult.eventId,
      deletedParticipantCount: deletionResult.deletedParticipantCount,
      organizerId,
      success: deletionResult.success
    }, 'Registration deleted successfully');

    // Transform to API response format
    const response = transformToApiResponse(deletionResult);

    return {
      statusCode: 200,
      data: response,
    };
  } catch (error) {
    logger.error({
      reservationId,
      organizerId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Error deleting registration by reservation ID');
    throw error;
  }
};

// Export wrapped handler with authentication and middleware
export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(deleteRegistrationByReservationIdHandler, {
    requiredRoles: ['organizer', 'admin'],
  }),
  {
    cors: {
      origin: '*',
      methods: ['DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
      credentials: false,
    },
    errorLogging: true,
  }
);