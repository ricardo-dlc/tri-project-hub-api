import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { BadRequestError, ValidationError } from '../../../shared/errors';
import { createFeatureLogger } from '../../../shared/logger';
import { isValidULID } from '../../../shared/utils/ulid';
import { withMiddleware } from '../../../shared/wrapper';
import { TeamParticipantData, TeamRegistrationData, teamRegistrationService } from '../services/team-registration.service';

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
