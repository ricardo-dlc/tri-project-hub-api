import { BadRequestError, ConflictError, NotFoundError, ValidationError } from '../../../shared/errors';
import { generateParticipantId, isValidULID } from '../../../shared/utils/ulid';
import { EventEntity } from '../../events/models/event.model';
import { CreateParticipantData, ParticipantEntity } from '../models/participant.model';
import { CreateRegistrationData, RegistrationEntity } from '../models/registration.model';
import { capacityValidationService } from './capacity-validation.service';
import { emailValidationService } from './email-validation.service';
import { reservationIdService } from './reservation-id.service';

export interface IndividualRegistrationData {
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

export interface IndividualRegistrationResult {
  reservationId: string;
  participantId: string;
  eventId: string;
  email: string;
  paymentStatus: boolean;
  registrationFee: number;
  createdAt: string;
}

export class IndividualRegistrationService {
  /**
   * Validates the input data for individual registration
   * @param eventId - The event ID (must be valid ULID)
   * @param participantData - The participant registration data
   * @throws ValidationError if data is invalid
   * @throws BadRequestError if ULID format is invalid
   */
  private validateInputData(eventId: string, participantData: IndividualRegistrationData): void {
    // Validate event ID format
    if (!isValidULID(eventId)) {
      throw new BadRequestError('Invalid event ID format. Must be a valid ULID.', { eventId });
    }

    // Validate required fields
    const requiredFields = ['email', 'firstName', 'lastName', 'waiver', 'newsletter'];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      const value = participantData[field as keyof IndividualRegistrationData];
      if (value === undefined || value === null || value === '') {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      throw new ValidationError(
        `Missing required fields: ${missingFields.join(', ')}`,
        { missingFields }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(participantData.email)) {
      throw new ValidationError('Invalid email format', { email: participantData.email });
    }

    // Validate waiver acceptance
    if (!participantData.waiver) {
      throw new ValidationError('Waiver must be accepted to complete registration', { waiver: participantData.waiver });
    }

    // Validate optional email fields if provided
    if (participantData.emergencyEmail && !emailRegex.test(participantData.emergencyEmail)) {
      throw new ValidationError('Invalid emergency contact email format', { emergencyEmail: participantData.emergencyEmail });
    }
  }

  /**
   * Validates that the event exists and is available for registration
   * @param eventId - The event ID to validate
   * @returns Promise<Event> - The event data
   * @throws NotFoundError if event doesn't exist
   * @throws ConflictError if event is not available for registration
   */
  private async validateEventAvailability(eventId: string) {
    try {
      const eventResult = await EventEntity.get({ id: eventId }).go();

      if (!eventResult.data) {
        throw new NotFoundError(`Event with ID ${eventId} not found`);
      }

      const event = eventResult.data;

      // Check if event is enabled
      if (!event.isEnabled) {
        throw new ConflictError('Event is currently disabled and not accepting registrations', { eventId });
      }

      // Check if registration deadline has passed
      const now = new Date();
      const registrationDeadline = new Date(event.registrationDeadline);

      if (now > registrationDeadline) {
        throw new ConflictError('Registration deadline has passed for this event', {
          eventId,
          registrationDeadline: event.registrationDeadline,
          currentTime: now.toISOString(),
        });
      }

      return event;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new Error(`Failed to validate event availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates the registration and participant entities in the database
   * @param eventId - The event ID
   * @param participantData - The participant data
   * @param event - The event data (for registration fee)
   * @returns Promise<IndividualRegistrationResult>
   */
  private async createRegistrationEntities(
    eventId: string,
    participantData: IndividualRegistrationData,
    event: any
  ): Promise<IndividualRegistrationResult> {
    const reservationIdResult = reservationIdService.generateReservationId();
    const reservationId = reservationIdResult.reservationId;
    const participantId = generateParticipantId();
    const timestamp = reservationIdResult.timestamp;

    try {
      // Create registration data
      const registrationData: CreateRegistrationData = {
        reservationId,
        eventId,
        registrationType: 'individual',
        totalParticipants: 1,
        registrationFee: event.registrationFee,
      };

      // Create participant data
      const participantCreateData: CreateParticipantData = {
        participantId,
        reservationId,
        eventId,
        email: participantData.email,
        firstName: participantData.firstName,
        lastName: participantData.lastName,
        waiver: participantData.waiver,
        newsletter: participantData.newsletter,
        // Optional fields
        phone: participantData.phone,
        dateOfBirth: participantData.dateOfBirth,
        gender: participantData.gender,
        address: participantData.address,
        city: participantData.city,
        state: participantData.state,
        zipCode: participantData.zipCode,
        country: participantData.country,
        emergencyName: participantData.emergencyName,
        emergencyRelationship: participantData.emergencyRelationship,
        emergencyPhone: participantData.emergencyPhone,
        emergencyEmail: participantData.emergencyEmail,
        shirtSize: participantData.shirtSize,
        dietaryRestrictions: participantData.dietaryRestrictions,
        medicalConditions: participantData.medicalConditions,
        medications: participantData.medications,
        allergies: participantData.allergies,
      };

      // Create registration entity
      await RegistrationEntity.create({
        ...registrationData,
        paymentStatus: false, // Default to unpaid
        createdAt: timestamp,
        updatedAt: timestamp,
        // GSI attributes are computed automatically by ElectroDB watch functions
        eventRegistrationId: eventId,
        registrationDate: timestamp,
        eventPaymentStatus: `${eventId}#false`,
        paymentDate: timestamp,
      }).go();

      // Create participant entity
      await ParticipantEntity.create({
        ...participantCreateData,
        createdAt: timestamp,
        updatedAt: timestamp,
        // GSI attributes are computed automatically by ElectroDB watch functions
        eventParticipantId: eventId,
        participantEmail: participantData.email,
        reservationParticipantId: reservationId,
        participantSequence: participantId,
      }).go();

      return {
        reservationId,
        participantId,
        eventId,
        email: participantData.email,
        paymentStatus: false,
        registrationFee: event.registrationFee,
        createdAt: timestamp,
      };
    } catch (error) {
      // If either entity creation fails, we should attempt to clean up
      // In a production system, this would be handled by a transaction or saga pattern
      throw new Error(`Failed to create registration entities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Updates the event's current participant count
   * @param eventId - The event ID
   * @param incrementBy - Number to increment the participant count by (default: 1)
   */
  private async updateEventParticipantCount(eventId: string, incrementBy: number = 1): Promise<void> {
    try {
      // Get current event data
      const eventResult = await EventEntity.get({ id: eventId }).go();

      if (!eventResult.data) {
        throw new NotFoundError(`Event with ID ${eventId} not found`);
      }

      const currentCount = eventResult.data.currentParticipants;
      const newCount = currentCount + incrementBy;

      // Update the participant count
      await EventEntity.update({ id: eventId })
        .set({
          currentParticipants: newCount,
          updatedAt: new Date().toISOString(),
        })
        .go();
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to update event participant count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Processes an individual registration for an event
   * @param eventId - The event ID (must be valid ULID)
   * @param participantData - The participant registration data
   * @returns Promise<IndividualRegistrationResult>
   * @throws ValidationError for invalid input data
   * @throws BadRequestError for invalid ULID format
   * @throws NotFoundError if event doesn't exist
   * @throws ConflictError for business rule violations (capacity, email duplicates, etc.)
   */
  async registerIndividual(
    eventId: string,
    participantData: IndividualRegistrationData
  ): Promise<IndividualRegistrationResult> {
    // Step 1: Validate input data and ULID format
    this.validateInputData(eventId, participantData);

    // Step 2: Validate event exists and is available for registration
    const event = await this.validateEventAvailability(eventId);

    // Step 3: Validate email uniqueness for this event
    await emailValidationService.validateIndividualRegistration(eventId, participantData.email);

    // Step 4: Validate event capacity
    await capacityValidationService.validateIndividualRegistration(eventId);

    // Step 5: Create registration and participant entities
    const result = await this.createRegistrationEntities(eventId, participantData, event);

    // Step 6: Update event participant count
    await this.updateEventParticipantCount(eventId, 1);

    return result;
  }

  /**
   * Validates individual registration without creating entities
   * Useful for pre-validation before payment processing
   * @param eventId - The event ID (must be valid ULID)
   * @param participantData - The participant registration data
   * @returns Promise<boolean> - true if registration would be valid
   * @throws Same errors as registerIndividual but without creating entities
   */
  async validateIndividualRegistration(
    eventId: string,
    participantData: IndividualRegistrationData
  ): Promise<boolean> {
    // Perform all validation steps without creating entities
    this.validateInputData(eventId, participantData);
    await this.validateEventAvailability(eventId);
    await emailValidationService.validateIndividualRegistration(eventId, participantData.email);
    await capacityValidationService.validateIndividualRegistration(eventId);

    return true;
  }
}

// Export a singleton instance for use across the application
export const individualRegistrationService = new IndividualRegistrationService();
