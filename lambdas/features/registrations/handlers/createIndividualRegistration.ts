import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { BadRequestError, ValidationError } from '../../../shared/errors';
import { createFeatureLogger } from '../../../shared/logger';
import { isValidULID } from '../../../shared/utils/ulid';
import { withMiddleware } from '../../../shared/wrapper';
import { IndividualRegistrationData, individualRegistrationService } from '../services/individual-registration.service';

const logger = createFeatureLogger('registrations');

/**
 * Request body interface for individual registration
 */
interface CreateIndividualRegistrationRequest {
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
 * Response interface for successful individual registration
 */
interface CreateIndividualRegistrationResponse {
  reservationId: string;
  participantId: string;
  eventId: string;
  email: string;
  paymentStatus: boolean;
  registrationFee: number;
  createdAt: string;
  message: string;
}

/**
 * Validates the request body structure and required fields
 * @param body - The parsed request body
 * @throws ValidationError if validation fails
 */
const validateRequestBody = (body: any): CreateIndividualRegistrationRequest => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a valid JSON object');
  }

  // Check for required fields
  const requiredFields = ['email', 'firstName', 'lastName', 'waiver', 'newsletter'];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = body[field];
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
    if (body[field] !== undefined && typeof body[field] !== 'string') {
      throw new ValidationError(`${field} must be a string if provided`);
    }
  }

  return body as CreateIndividualRegistrationRequest;
};

/**
 * Parses and validates the request body
 * @param event - The API Gateway event
 * @returns Parsed and validated request body
 * @throws BadRequestError if body is missing or invalid JSON
 * @throws ValidationError if validation fails
 */
const parseRequestBody = (event: APIGatewayProxyEventV2): CreateIndividualRegistrationRequest => {
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
 * Lambda handler for creating individual registrations
 * POST /events/{eventId}/registrations
 */
const createIndividualRegistrationHandler = async (event: APIGatewayProxyEventV2) => {
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

  logger.info({ eventId, email: registrationData.email }, 'Processing individual registration');

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

  logger.info({ eventId, reservationId: result.reservationId, participantId: result.participantId }, 'Individual registration created successfully');

  // Format the response
  const response: CreateIndividualRegistrationResponse = {
    reservationId: result.reservationId,
    participantId: result.participantId,
    eventId: result.eventId,
    email: result.email,
    paymentStatus: result.paymentStatus,
    registrationFee: result.registrationFee,
    createdAt: result.createdAt,
    message: 'Individual registration created successfully',
  };

  return {
    statusCode: 201,
    data: response,
  };
};

// Export wrapped handler
export const handler: APIGatewayProxyHandlerV2 = withMiddleware(
  createIndividualRegistrationHandler,
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
