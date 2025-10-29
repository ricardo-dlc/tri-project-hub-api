import { participantQueryService, RegistrationWithParticipants } from '@/features/registrations/services/participant-query.service';
import { AuthenticatedEvent, withAuth } from '@/shared/auth/middleware';
import { BadRequestError } from '@/shared/errors';
import { createFeatureLogger } from '@/shared/logger';
import { isValidULID } from '@/shared/utils/ulid';
import { withMiddleware } from '@/shared/wrapper';
import type {
  APIGatewayProxyHandlerV2
} from 'aws-lambda';

const logger = createFeatureLogger('registrations');

/**
 * Response interface for RSVP retrieval
 */
interface RSVPRetrievalResponse {
  reservationId: string;
  eventId: string;
  registrationType: 'individual' | 'team';
  paymentStatus: boolean;
  totalParticipants: number;
  registrationFee: number;
  createdAt: string;
  updatedAt: string;
  participants: Array<{
    participantId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    emergencyName?: string;
    emergencyRelationship?: string;
    emergencyPhone?: string;
    dietaryRestrictions?: string;
    medicalConditions?: string;
    medications?: string;
    allergies?: string;
    waiver: boolean;
    newsletter: boolean;
    role?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  event: {
    eventId: string;
    title: string;
    creatorId: string;
  };
}

/**
 * Transforms the service response to the API response format
 * @param registrationData - The registration data from the service
 * @returns RSVPRetrievalResponse - Formatted response for the API
 */
const transformToApiResponse = (registrationData: RegistrationWithParticipants): RSVPRetrievalResponse => {
  return {
    reservationId: registrationData.registration.reservationId,
    eventId: registrationData.registration.eventId,
    registrationType: registrationData.registration.registrationType,
    paymentStatus: registrationData.registration.paymentStatus,
    totalParticipants: registrationData.registration.totalParticipants,
    registrationFee: registrationData.registration.registrationFee,
    createdAt: registrationData.registration.createdAt,
    updatedAt: registrationData.registration.updatedAt,
    participants: registrationData.participants.map(participant => ({
      participantId: participant.participantId,
      email: participant.email,
      firstName: participant.firstName,
      lastName: participant.lastName,
      phone: participant.phone,
      dateOfBirth: participant.dateOfBirth,
      gender: participant.gender,
      address: participant.address,
      city: participant.city,
      state: participant.state,
      zipCode: participant.zipCode,
      emergencyName: participant.emergencyName,
      emergencyRelationship: participant.emergencyRelationship,
      emergencyPhone: participant.emergencyPhone,
      dietaryRestrictions: participant.dietaryRestrictions,
      medicalConditions: participant.medicalConditions,
      medications: participant.medications,
      allergies: participant.allergies,
      waiver: participant.waiver,
      newsletter: participant.newsletter,
      role: participant.role,
      createdAt: participant.createdAt,
      updatedAt: participant.updatedAt,
    })),
    event: registrationData.event,
  };
};

/**
 * Lambda handler for retrieving RSVP by reservation ID
 * GET /registrations/{reservationId}
 */
const getRegistrationByReservationIdHandler = async (event: AuthenticatedEvent) => {
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
  logger.info({ reservationId, organizerId }, 'Retrieving registration by reservation ID');

  try {
    // Retrieve registration with participants using the service
    const registrationData = await participantQueryService.getRegistrationWithParticipants(reservationId, organizerId);

    logger.info({
      reservationId,
      eventId: registrationData.registration.eventId,
      participantCount: registrationData.participants.length,
      registrationType: registrationData.registration.registrationType,
      paymentStatus: registrationData.registration.paymentStatus,
      organizerId
    }, 'Registration retrieved successfully');

    // Transform to API response format
    const response = transformToApiResponse(registrationData);

    return {
      statusCode: 200,
      data: response,
    };
  } catch (error) {
    logger.error({
      reservationId,
      organizerId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Error retrieving registration by reservation ID');
    throw error;
  }
};

// Export wrapped handler with authentication and middleware
export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(getRegistrationByReservationIdHandler, {
    requiredRoles: ['organizer', 'admin'],
  }),
  {
    cors: {
      origin: '*',
      methods: ['GET', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
      credentials: false,
    },
    errorLogging: true,
  }
);