import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { eventService } from '@/features/events/services/event.service';
import { buildTeamRegistrationMessage, formatEventDateTime, formatRegistrationFee } from '@/features/notifications/utils';
import { TeamParticipantData, TeamRegistrationData, TeamRegistrationResult, teamRegistrationService } from '@/features/registrations/services/team-registration.service';
import { BadRequestError, ValidationError } from '@/shared/errors';
import { createFeatureLogger } from '@/shared/logger';
import { sqsService } from '@/shared/services';
import { isValidULID } from '@/shared/utils/ulid';
import { withMiddleware } from '@/shared/wrapper';

const logger = createFeatureLogger('registrations');

/**
 * Request body interface for team registration
 */
interface CreateTeamRegistrationRequest {
  participants: TeamParticipantData[];
}

/**
 * Response interface for successful team registration
 */
interface CreateTeamRegistrationResponse {
  reservationId: string;
  eventId: string;
  participants: Array<{
    participantId: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: string;
  }>;
  paymentStatus: boolean;
  registrationFee: number;
  totalParticipants: number;
  createdAt: string;
  message: string;
}

/**
 * Validates a single participant's data structure and required fields
 * @param participant - The participant data to validate
 * @param index - The participant's index in the array (for error reporting)
 * @throws ValidationError if validation fails
 */
const validateParticipant = (participant: any, index: number): TeamParticipantData => {
  if (!participant || typeof participant !== 'object' || Array.isArray(participant)) {
    throw new ValidationError(`Participant at index ${index} must be a valid object`);
  }

  // Check for required fields
  const requiredFields = ['email', 'firstName', 'lastName', 'waiver', 'newsletter'];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = participant[field];
    // For boolean fields, only check if undefined
    if (field === 'waiver' || field === 'newsletter') {
      if (value === undefined) {
        missingFields.push(field);
      }
    } else {
      // For string fields, check for undefined, null, or empty string
      if (value === undefined || value === null || value === '') {
        missingFields.push(field);
      }
    }
  }

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Participant at index ${index} is missing required fields: ${missingFields.join(', ')}`,
      { participantIndex: index, missingFields }
    );
  }

  // Validate field types
  if (typeof participant.email !== 'string') {
    throw new ValidationError(`Participant at index ${index}: email must be a string`);
  }

  if (typeof participant.firstName !== 'string') {
    throw new ValidationError(`Participant at index ${index}: firstName must be a string`);
  }

  if (typeof participant.lastName !== 'string') {
    throw new ValidationError(`Participant at index ${index}: lastName must be a string`);
  }

  if (typeof participant.waiver !== 'boolean') {
    throw new ValidationError(`Participant at index ${index}: waiver must be a boolean`);
  }

  if (typeof participant.newsletter !== 'boolean') {
    throw new ValidationError(`Participant at index ${index}: newsletter must be a boolean`);
  }

  // Validate optional string fields if provided
  const optionalStringFields = [
    'phone', 'dateOfBirth', 'gender', 'address', 'city', 'state',
    'zipCode', 'country', 'emergencyName', 'emergencyRelationship',
    'emergencyPhone', 'emergencyEmail', 'shirtSize', 'dietaryRestrictions',
    'medicalConditions', 'medications', 'allergies', 'role'
  ];

  for (const field of optionalStringFields) {
    if (participant[field] !== undefined && typeof participant[field] !== 'string') {
      throw new ValidationError(`Participant at index ${index}: ${field} must be a string if provided`);
    }
  }

  return participant as TeamParticipantData;
};

/**
 * Validates the request body structure and required fields
 * @param body - The parsed request body
 * @throws ValidationError if validation fails
 */
const validateRequestBody = (body: any): CreateTeamRegistrationRequest => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a valid JSON object');
  }

  // Check for participants array
  if (!body.participants) {
    throw new ValidationError('Request body must include participants array');
  }

  if (!Array.isArray(body.participants)) {
    throw new ValidationError('Participants must be an array');
  }

  if (body.participants.length === 0) {
    throw new ValidationError('Team registration must include at least one participant');
  }

  // Validate each participant
  const validatedParticipants: TeamParticipantData[] = [];
  for (let i = 0; i < body.participants.length; i++) {
    const validatedParticipant = validateParticipant(body.participants[i], i);
    validatedParticipants.push(validatedParticipant);
  }

  // Check for duplicate emails within the team
  const emails = validatedParticipants.map(p => p.email.toLowerCase());
  const duplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index);

  if (duplicateEmails.length > 0) {
    throw new ValidationError(
      'Team registration contains duplicate email addresses',
      { duplicateEmails: [...new Set(duplicateEmails)] }
    );
  }

  return {
    participants: validatedParticipants
  };
};

/**
 * Parses and validates the request body
 * @param event - The API Gateway event
 * @returns Parsed and validated request body
 * @throws BadRequestError if body is missing or invalid JSON
 * @throws ValidationError if validation fails
 */
const parseRequestBody = (event: APIGatewayProxyEventV2): CreateTeamRegistrationRequest => {
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
 * Publishes a team registration notification message to SQS
 * @param eventId - The event ID
 * @param registrationResult - The registration result from the service
 * @param registrationData - The original registration data
 */
const publishTeamRegistrationNotification = async (
  eventId: string,
  registrationResult: TeamRegistrationResult,
  registrationData: CreateTeamRegistrationRequest
): Promise<void> => {
  try {
    // Get the email queue URL from environment variables
    const queueUrl = process.env.EMAIL_QUEUE_URL;
    if (!queueUrl) {
      logger.warn({ eventId, reservationId: registrationResult.reservationId }, 'EMAIL_QUEUE_URL not configured, skipping notification');
      return;
    }

    // Fetch event details for the notification
    const event = await eventService.getEvent(eventId);

    // Format event date and time
    const { date, time } = formatEventDateTime(event.date);

    // Find the team captain (first participant or one with captain role)
    const captain = registrationResult.participants[0]; // Use first participant as captain
    const captainData = registrationData.participants.find(p => p.email === captain.email);

    if (!captainData) {
      logger.warn({ eventId, reservationId: registrationResult.reservationId }, 'Could not find captain data for team registration notification');
      return;
    }

    // Build team data for the notification
    const teamData = {
      name: `Team ${captainData.firstName} ${captainData.lastName}`, // Generate team name from captain
      members: registrationResult.participants.map((participant, index) => {
        const participantData = registrationData.participants.find(p => p.email === participant.email);
        return {
          name: `${participant.firstName} ${participant.lastName}`,
          email: participant.email,
          role: participant.role || participantData?.role || 'Member',
          isCaptain: index === 0, // First participant is captain
        };
      }),
    };

    // Build the notification message
    const notificationMessage = buildTeamRegistrationMessage(
      eventId,
      registrationResult.reservationId,
      {
        email: captain.email,
        firstName: captainData.firstName,
        lastName: captainData.lastName,
      },
      teamData,
      {
        name: event.title,
        date,
        time,
        location: event.location,
        registrationFee: event.registrationFee,
      },
      {
        amount: formatRegistrationFee(registrationResult.registrationFee),
        bankAccount: 'TBD', // This should come from configuration
      }
    );

    // Publish the message to SQS (using safe method to not fail registration)
    const success = await sqsService.publishMessageSafe(queueUrl, notificationMessage);

    if (success) {
      logger.info({
        eventId,
        reservationId: registrationResult.reservationId,
        messageType: notificationMessage.type,
        teamSize: registrationResult.totalParticipants,
      }, 'Team registration notification published to SQS');
    } else {
      logger.warn({
        eventId,
        reservationId: registrationResult.reservationId,
      }, 'Failed to publish team registration notification to SQS');
    }
  } catch (error) {
    // Log the error but don't fail the registration
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      eventId,
      reservationId: registrationResult.reservationId,
    }, 'Error publishing team registration notification to SQS');
  }
};

/**
 * Lambda handler for creating team registrations
 * POST /events/{eventId}/registrations
 */
const createTeamRegistrationHandler = async (event: APIGatewayProxyEventV2) => {
  // Extract and validate eventId from path parameters
  const { eventId } = event.pathParameters ?? {};

  if (!eventId || eventId.trim() === '') {
    throw new BadRequestError('Missing eventId parameter in path');
  }

  // Validate eventId format (must be valid ULID)
  if (!isValidULID(eventId)) {
    throw new BadRequestError('Invalid eventId format. Must be a valid ULID.', { eventId });
  }

  // Parse and validate request body
  const registrationData = parseRequestBody(event);

  logger.info({ eventId, participantCount: registrationData.participants.length }, 'Processing team registration');

  // Convert request data to service interface
  const teamData: TeamRegistrationData = {
    participants: registrationData.participants
  };

  // Process the registration using the service
  const result = await teamRegistrationService.registerTeam(eventId, teamData);

  logger.info({ eventId, reservationId: result.reservationId, participantCount: result.totalParticipants }, 'Team registration created successfully');

  // Publish email notification message to SQS (non-blocking)
  await publishTeamRegistrationNotification(eventId, result, registrationData);

  // Format the response
  const response: CreateTeamRegistrationResponse = {
    reservationId: result.reservationId,
    eventId: result.eventId,
    participants: result.participants,
    paymentStatus: result.paymentStatus,
    registrationFee: result.registrationFee,
    totalParticipants: result.totalParticipants,
    createdAt: result.createdAt,
    message: 'Team registration created successfully',
  };

  return {
    statusCode: 201,
    data: response,
  };
};

// Export wrapped handler
export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  createTeamRegistrationHandler,
  {
    cors: {
      origin: '*',
      methods: ['POST', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
      credentials: false,
    },
    errorLogging: true,
  }
);
