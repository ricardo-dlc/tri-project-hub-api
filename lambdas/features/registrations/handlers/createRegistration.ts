import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { BadRequestError, ValidationError } from '../../../shared/errors';
import { isValidULID } from '../../../shared/utils/ulid';
import { withMiddleware } from '../../../shared/wrapper';
import {
  IndividualRegistrationData,
  individualRegistrationService
} from '../services/individual-registration.service';
import {
  TeamRegistrationData,
  TeamParticipantData,
  teamRegistrationService
} from '../services/team-registration.service';

/**
 * Request body interface for individual registration
 */
interface IndividualRegistrationRequest {
  // Required fields
  email: string;
  firstName: string;
  lastName: string;
  waiver: boolean;
  newsletter: boolean;

  // Optional personal information
  phone?: string;
  dateOfBirth?: string;
  gender?: string;

  // Optional address information
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;

  // Optional emergency contact
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  emergencyEmail?: string;

  // Optional preferences and medical
  shirtSize?: string;
  dietaryRestrictions?: string;
  medicalConditions?: string;
  medications?: string;
  allergies?: string;
}

/**
 * Request body interface for team registration
 */
interface TeamRegistrationRequest {
  participants: TeamParticipantData[];
}

/**
 * Union type for registration requests
 */
type RegistrationRequest = IndividualRegistrationRequest | TeamRegistrationRequest;

/**
 * Response interface for successful individual registration
 */
interface IndividualRegistrationResponse {
  reservationId: string;
  participantId: string;
  eventId: string;
  email: string;
  paymentStatus: boolean;
  registrationFee: number;
  createdAt: string;
  registrationType: 'individual';
  message: string;
}

/**
 * Response interface for successful team registration
 */
interface TeamRegistrationResponse {
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
  registrationType: 'team';
  message: string;
}

/**
 * Union type for registration responses
 */
type RegistrationResponse = IndividualRegistrationResponse | TeamRegistrationResponse;

/**
 * Determines if the request is for team registration based on the presence of participants field
 * @param body - The parsed request body
 * @returns true if this is a team registration request
 */
const isTeamRegistration = (body: any): body is TeamRegistrationRequest => {
  return body && typeof body === 'object' && body.hasOwnProperty('participants');
};

/**
 * Determines if the request is for individual registration based on the presence of individual fields
 * @param body - The parsed request body
 * @returns true if this is an individual registration request
 */
const isIndividualRegistration = (body: any): body is IndividualRegistrationRequest => {
  return body &&
    typeof body === 'object' &&
    !Array.isArray(body.participants) &&
    // Check if it has individual registration fields (even if invalid)
    (body.hasOwnProperty('email') ||
      body.hasOwnProperty('firstName') ||
      body.hasOwnProperty('lastName') ||
      body.hasOwnProperty('waiver') ||
      body.hasOwnProperty('newsletter'));
};

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
 * Validates team registration request body
 * @param body - The parsed request body
 * @throws ValidationError if validation fails
 */
const validateTeamRegistrationBody = (body: any): TeamRegistrationRequest => {
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
 * Validates individual registration request body
 * @param body - The parsed request body
 * @throws ValidationError if validation fails
 */
const validateIndividualRegistrationBody = (body: IndividualRegistrationRequest): IndividualRegistrationRequest => {
  // Check for required fields
  const requiredFields = ['email', 'firstName', 'lastName', 'waiver', 'newsletter'];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = (body as any)[field];
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
      `Missing required fields: ${missingFields.join(', ')}`,
      { missingFields }
    );
  }

  // Validate field types
  if (typeof body.email !== 'string') {
    throw new ValidationError('Email must be a string');
  }

  if (typeof body.firstName !== 'string') {
    throw new ValidationError('First name must be a string');
  }

  if (typeof body.lastName !== 'string') {
    throw new ValidationError('Last name must be a string');
  }

  if (typeof body.waiver !== 'boolean') {
    throw new ValidationError('Waiver must be a boolean');
  }

  if (typeof body.newsletter !== 'boolean') {
    throw new ValidationError('Newsletter must be a boolean');
  }

  // Validate optional string fields if provided
  const optionalStringFields = [
    'phone', 'dateOfBirth', 'gender', 'address', 'city', 'state',
    'zipCode', 'country', 'emergencyName', 'emergencyRelationship',
    'emergencyPhone', 'emergencyEmail', 'shirtSize', 'dietaryRestrictions',
    'medicalConditions', 'medications', 'allergies'
  ];

  for (const field of optionalStringFields) {
    if ((body as any)[field] !== undefined && typeof (body as any)[field] !== 'string') {
      throw new ValidationError(`${field} must be a string if provided`);
    }
  }

  return body;
};

/**
 * Parses and validates the request body, determining registration type automatically
 * @param event - The API Gateway event
 * @returns Parsed and validated request body with registration type
 * @throws BadRequestError if body is missing or invalid JSON
 * @throws ValidationError if validation fails
 */
const parseRequestBody = (event: APIGatewayProxyEventV2): RegistrationRequest => {
  if (!event.body) {
    throw new BadRequestError('Request body is required');
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(event.body);
  } catch (error) {
    throw new BadRequestError('Invalid JSON in request body');
  }

  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    throw new ValidationError('Request body must be a valid JSON object');
  }

  // Determine registration type and validate accordingly
  if (isTeamRegistration(parsedBody)) {
    return validateTeamRegistrationBody(parsedBody);
  } else if (isIndividualRegistration(parsedBody)) {
    return validateIndividualRegistrationBody(parsedBody);
  } else {
    throw new ValidationError(
      'Invalid registration format. Must be either individual registration (with email, firstName, lastName) or team registration (with participants array)'
    );
  }
};

/**
 * Processes individual registration
 * @param eventId - The event ID
 * @param registrationData - The individual registration data
 * @returns Promise<IndividualRegistrationResponse>
 */
const processIndividualRegistration = async (
  eventId: string,
  registrationData: IndividualRegistrationRequest
): Promise<IndividualRegistrationResponse> => {
  // Convert request data to service interface
  const participantData: IndividualRegistrationData = {
    email: registrationData.email,
    firstName: registrationData.firstName,
    lastName: registrationData.lastName,
    waiver: registrationData.waiver,
    newsletter: registrationData.newsletter,
    // Optional fields
    phone: registrationData.phone,
    dateOfBirth: registrationData.dateOfBirth,
    gender: registrationData.gender,
    address: registrationData.address,
    city: registrationData.city,
    state: registrationData.state,
    zipCode: registrationData.zipCode,
    country: registrationData.country,
    emergencyName: registrationData.emergencyName,
    emergencyRelationship: registrationData.emergencyRelationship,
    emergencyPhone: registrationData.emergencyPhone,
    emergencyEmail: registrationData.emergencyEmail,
    shirtSize: registrationData.shirtSize,
    dietaryRestrictions: registrationData.dietaryRestrictions,
    medicalConditions: registrationData.medicalConditions,
    medications: registrationData.medications,
    allergies: registrationData.allergies,
  };

  // Process the registration using the service
  const result = await individualRegistrationService.registerIndividual(eventId, participantData);

  // Format the response
  return {
    reservationId: result.reservationId,
    participantId: result.participantId,
    eventId: result.eventId,
    email: result.email,
    paymentStatus: result.paymentStatus,
    registrationFee: result.registrationFee,
    createdAt: result.createdAt,
    registrationType: 'individual',
    message: 'Individual registration created successfully',
  };
};

/**
 * Processes team registration
 * @param eventId - The event ID
 * @param registrationData - The team registration data
 * @returns Promise<TeamRegistrationResponse>
 */
const processTeamRegistration = async (
  eventId: string,
  registrationData: TeamRegistrationRequest
): Promise<TeamRegistrationResponse> => {
  // Convert request data to service interface
  const teamData: TeamRegistrationData = {
    participants: registrationData.participants
  };

  // Process the registration using the service
  const result = await teamRegistrationService.registerTeam(eventId, teamData);

  // Format the response
  return {
    reservationId: result.reservationId,
    eventId: result.eventId,
    participants: result.participants,
    paymentStatus: result.paymentStatus,
    registrationFee: result.registrationFee,
    totalParticipants: result.totalParticipants,
    createdAt: result.createdAt,
    registrationType: 'team',
    message: 'Team registration created successfully',
  };
};

/**
 * Lambda handler for creating registrations (both individual and team)
 * POST /events/{eventId}/registrations
 */
const createRegistrationHandler = async (event: APIGatewayProxyEventV2) => {
  // Extract and validate eventId from path parameters
  const { eventId } = event.pathParameters ?? {};

  if (!eventId || eventId.trim() === '') {
    throw new BadRequestError('Missing eventId parameter in path');
  }

  // Validate eventId format (must be valid ULID)
  if (!isValidULID(eventId)) {
    throw new BadRequestError('Invalid eventId format. Must be a valid ULID.', { eventId });
  }

  // Parse and validate request body, determining registration type automatically
  const registrationData = parseRequestBody(event);

  let response: RegistrationResponse;

  // Process registration based on detected type
  if (isTeamRegistration(registrationData)) {
    response = await processTeamRegistration(eventId, registrationData);
  } else {
    response = await processIndividualRegistration(eventId, registrationData as IndividualRegistrationRequest);
  }

  return {
    statusCode: 201,
    data: response,
  };
};

// Export wrapped handler
export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  createRegistrationHandler,
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