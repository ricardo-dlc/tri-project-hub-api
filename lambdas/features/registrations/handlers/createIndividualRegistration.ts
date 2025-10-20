import { eventService } from '@/features/events/services/event.service';
import { buildIndividualRegistrationMessage, formatEventDateTime, formatRegistrationFee } from '@/features/notifications/utils';
import { IndividualRegistrationData, IndividualRegistrationResult, individualRegistrationService } from '@/features/registrations/services/individual-registration.service';
import { BadRequestError, ValidationError } from '@/shared/errors';
import { createFeatureLogger } from '@/shared/logger';
import { sqsService } from '@/shared/services';
import { isValidULID } from '@/shared/utils/ulid';
import { withMiddleware } from '@/shared/wrapper';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';

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
 * Publishes a registration notification message to SQS
 * @param eventId - The event ID
 * @param registrationResult - The registration result from the service
 * @param registrationData - The original registration data
 */
const publishRegistrationNotification = async (
  eventId: string,
  registrationResult: IndividualRegistrationResult,
  registrationData: CreateIndividualRegistrationRequest
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

    // Build the notification message
    const notificationMessage = buildIndividualRegistrationMessage(
      eventId,
      registrationResult.reservationId,
      {
        email: registrationResult.email,
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        participantId: registrationResult.participantId,
      },
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
      }, 'Registration notification published to SQS');
    } else {
      logger.warn({
        eventId,
        reservationId: registrationResult.reservationId,
      }, 'Failed to publish registration notification to SQS');
    }
  } catch (error) {
    // Log the error but don't fail the registration
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      eventId,
      reservationId: registrationResult.reservationId,
    }, 'Error publishing registration notification to SQS');
  }
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

  // Publish email notification message to SQS (non-blocking)
  await publishRegistrationNotification(eventId, result, registrationData);

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
