import type {
  APIGatewayProxyHandlerV2
} from 'aws-lambda';
import pino from 'pino';
import { AuthenticatedEvent, withAuth } from '../../../shared/auth/middleware';
import { BadRequestError } from '../../../shared/errors';
import { isValidULID } from '../../../shared/utils/ulid';
import { withMiddleware } from '../../../shared/wrapper';
import { participantQueryService, ParticipantWithRegistration } from '../services/participant-query.service';

// Initialize Pino logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // No prettyPrint or transport needed for Lambda
});


/**
 * Response interface for participant list grouped by reservation
 */
interface ParticipantsByReservationResponse {
  eventId: string;
  totalParticipants: number;
  registrations: RegistrationGroup[];
  summary: {
    totalRegistrations: number;
    paidRegistrations: number;
    unpaidRegistrations: number;
    individualRegistrations: number;
    teamRegistrations: number;
  };
}

interface RegistrationGroup {
  reservationId: string;
  registrationType: 'individual' | 'team';
  paymentStatus: boolean;
  registrationFee: number;
  totalParticipants: number;
  registrationCreatedAt: string;
  participants: ParticipantInfo[];
}

interface ParticipantInfo {
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
  country?: string;
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  emergencyEmail?: string;
  shirtSize?: string;
  dietaryRestrictions?: string;
  medicalConditions?: string;
  medications?: string;
  allergies?: string;
  waiver: boolean;
  newsletter: boolean;
  role?: string;
  createdAt: string;
}

const transformParticipantInfo = (participant: ParticipantWithRegistration): ParticipantInfo => {
  const result: ParticipantInfo = {
    participantId: participant.participantId,
    email: participant.email,
    firstName: participant.firstName,
    lastName: participant.lastName,
    waiver: participant.waiver,
    newsletter: participant.newsletter,
    createdAt: participant.createdAt,
    phone: participant.phone,
    dateOfBirth: participant.dateOfBirth,
    gender: participant.gender,
    address: participant.address,
    city: participant.city,
    state: participant.state,
    zipCode: participant.zipCode,
    country: participant.country,
    emergencyName: participant.emergencyName,
    emergencyRelationship: participant.emergencyRelationship,
    emergencyPhone: participant.emergencyPhone,
    emergencyEmail: participant.emergencyEmail,
    shirtSize: participant.shirtSize,
    dietaryRestrictions: participant.dietaryRestrictions,
    medicalConditions: participant.medicalConditions,
    medications: participant.medications,
    allergies: participant.allergies,
    role: participant.role,
  };
  return result;
};

const groupParticipantsByReservation = (participants: ParticipantWithRegistration[]): RegistrationGroup[] => {
  const reservationMap = new Map<string, ParticipantWithRegistration[]>();

  participants.forEach((participant) => {
    const reservationId = participant.reservationId;
    if (!reservationMap.has(reservationId)) {
      reservationMap.set(reservationId, []);
    }
    reservationMap.get(reservationId)!.push(participant);
  });

  const registrationGroups: RegistrationGroup[] = [];

  reservationMap.forEach((participantGroup, reservationId) => {
    const firstParticipant = participantGroup[0];

    const registrationGroup: RegistrationGroup = {
      reservationId,
      registrationType: firstParticipant.registrationType,
      paymentStatus: firstParticipant.paymentStatus,
      registrationFee: firstParticipant.registrationFee,
      totalParticipants: firstParticipant.totalParticipants,
      registrationCreatedAt: firstParticipant.registrationCreatedAt,
      participants: participantGroup.map(transformParticipantInfo),
    };

    registrationGroups.push(registrationGroup);
  });

  registrationGroups.sort((a, b) => b.registrationCreatedAt.localeCompare(a.registrationCreatedAt));

  return registrationGroups;
};

const getParticipantsByEventHandler = async (event: AuthenticatedEvent) => {
  try {
    const { eventId } = event.pathParameters ?? {};

    if (!eventId || eventId.trim() === '') {
      logger.warn({ event }, 'Missing eventId in path parameters');
      throw new BadRequestError('Missing eventId parameter in path');
    }

    if (!isValidULID(eventId)) {
      logger.warn({ eventId }, 'Invalid eventId format');
      throw new BadRequestError('Invalid eventId format. Must be a valid ULID.', { eventId });
    }

    const organizerId = event.user.id;
    logger.info({ eventId, organizerId }, 'Fetching participants for event');

    const queryResult = await participantQueryService.getParticipantsByEvent(eventId, organizerId);

    logger.info(
      { eventId, totalFetched: queryResult.totalCount },
      'Participants fetched successfully'
    );

    const registrationGroups = groupParticipantsByReservation(queryResult.participants);

    const response: ParticipantsByReservationResponse = {
      eventId,
      totalParticipants: queryResult.totalCount,
      registrations: registrationGroups,
      summary: queryResult.registrationSummary,
    };

    return {
      statusCode: 200,
      data: response,
    };
  } catch (error) {
    logger.error({ error, event }, 'Error in getParticipantsByEventHandler');
    throw error;
  }
};

export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  withAuth(getParticipantsByEventHandler, {
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
