import { BadRequestError, ConflictError, NotFoundError, ValidationError } from '../../../shared/errors';
import { generateParticipantId } from '../../../shared/utils/ulid';
import { isValidULID } from '../../../shared/utils/ulid';
import { EventEntity } from '../../events/models/event.model';
import { CreateParticipantData, ParticipantEntity } from '../models/participant.model';
import { CreateRegistrationData, RegistrationEntity } from '../models/registration.model';
import { reservationIdService } from './reservation-id.service';

export abstract class BaseRegistrationService {
  /**
   * Validates that the event ID is in valid ULID format
   * @param eventId - The event ID to validate
   * @throws BadRequestError if ULID format is invalid
   */
  protected validateEventIdFormat(eventId: string): void {
    if (!isValidULID(eventId)) {
      throw new BadRequestError('Invalid event ID format. Must be a valid ULID.', { eventId });
    }
  }

  /**
   * Validates email format using regex
   * @param email - The email to validate
   * @param fieldName - The name of the field for error reporting (default: 'email')
   * @throws ValidationError if email format is invalid
   */
  protected validateEmailFormat(email: string, fieldName: string = 'email'): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError(`Invalid ${fieldName} format`, { [fieldName]: email });
    }
  }

  /**
   * Validates that required fields are present and not empty
   * @param data - The data object to validate
   * @param requiredFields - Array of required field names
   * @throws ValidationError if any required fields are missing
   */
  protected validateRequiredFields(data: Record<string, any>, requiredFields: string[]): void {
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      const value = data[field];
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
  }

  /**
   * Validates that the event exists and is available for registration
   * @param eventId - The event ID to validate
   * @param expectedRegistrationType - The expected registration type ('individual' or 'team')
   * @returns Promise<Event> - The event data
   * @throws NotFoundError if event doesn't exist
   * @throws ConflictError if event is not available for registration or registration type mismatch
   */
  protected async validateEventAvailability(eventId: string, expectedRegistrationType?: 'individual' | 'team') {
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

      // Validate registration type matches event configuration
      if (expectedRegistrationType) {
        const isEventTeamType = event.isTeamEvent;
        const isExpectedTeamType = expectedRegistrationType === 'team';

        if (isEventTeamType !== isExpectedTeamType) {
          const eventType = isEventTeamType ? 'team' : 'individual';
          throw new ConflictError(
            `Registration type mismatch. This event is configured for ${eventType} registration only.`,
            {
              eventId,
              eventRegistrationType: eventType,
              attemptedRegistrationType: expectedRegistrationType,
            }
          );
        }
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
   * Updates the event's current participant count
   * @param eventId - The event ID
   * @param incrementBy - Number to increment the participant count by
   */
  protected async updateEventParticipantCount(eventId: string, incrementBy: number): Promise<void> {
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
   * Validates waiver acceptance
   * @param waiver - The waiver acceptance boolean
   * @throws ValidationError if waiver is not accepted
   */
  protected validateWaiverAcceptance(waiver: boolean): void {
    if (!waiver) {
      throw new ValidationError('Waiver must be accepted to complete registration', { waiver });
    }
  }

  /**
   * Validates participant data common to both individual and team registrations
   * @param participantData - The participant data to validate
   * @param participantIndex - Optional index for team validation error reporting
   */
  protected validateParticipantData(participantData: any, participantIndex?: number): string[] {
    const errors: string[] = [];
    const prefix = participantIndex !== undefined ? `Participant ${participantIndex + 1}: ` : '';

    // Validate required fields
    const requiredFields = ['email', 'firstName', 'lastName', 'waiver', 'newsletter'];
    for (const field of requiredFields) {
      const value = participantData[field];
      if (value === undefined || value === null || value === '') {
        errors.push(`${prefix}Missing required field: ${field}`);
      }
    }

    // Validate email format
    if (participantData.email) {
      try {
        this.validateEmailFormat(participantData.email);
      } catch (error) {
        errors.push(`${prefix}Invalid email format`);
      }
    }

    // Validate waiver acceptance
    if (participantData.waiver !== undefined && !participantData.waiver) {
      errors.push(`${prefix}Waiver must be accepted to complete registration`);
    }

    // Validate optional emergency email if provided
    if (participantData.emergencyEmail) {
      try {
        this.validateEmailFormat(participantData.emergencyEmail, 'emergencyEmail');
      } catch (error) {
        errors.push(`${prefix}Invalid emergency contact email format`);
      }
    }

    return errors;
  }

  /**
   * Validates single participant input data
   * @param eventId - The event ID (must be valid ULID)
   * @param participantData - The participant registration data
   * @throws ValidationError if data is invalid
   * @throws BadRequestError if ULID format is invalid
   */
  protected validateSingleParticipantInput(eventId: string, participantData: any): void {
    // Validate event ID format
    this.validateEventIdFormat(eventId);

    // Validate required fields
    const requiredFields = ['email', 'firstName', 'lastName', 'waiver', 'newsletter'];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      const value = participantData[field];
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
    this.validateEmailFormat(participantData.email);

    // Validate waiver acceptance
    this.validateWaiverAcceptance(participantData.waiver);

    // Validate optional emergency email if provided
    if (participantData.emergencyEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(participantData.emergencyEmail)) {
        throw new ValidationError('Invalid emergency contact email format', { emergencyEmail: participantData.emergencyEmail });
      }
    }
  }

  /**
   * Creates a participant entity in the database
   * @param participantData - The participant data
   * @param reservationId - The reservation ID
   * @param eventId - The event ID
   * @param timestamp - The timestamp for creation
   * @returns Promise<string> - The generated participant ID
   */
  protected async createParticipantEntity(
    participantData: any,
    reservationId: string,
    eventId: string,
    timestamp: string
  ): Promise<string> {
    const participantId = generateParticipantId();

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
      role: participantData.role,
    };

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

    return participantId;
  }

  /**
   * Creates a registration entity in the database
   * @param reservationId - The reservation ID
   * @param eventId - The event ID
   * @param registrationType - The registration type ('individual' or 'team')
   * @param totalParticipants - Total number of participants
   * @param registrationFee - The registration fee
   * @param timestamp - The timestamp for creation
   */
  protected async createRegistrationEntity(
    reservationId: string,
    eventId: string,
    registrationType: 'individual' | 'team',
    totalParticipants: number,
    registrationFee: number,
    timestamp: string
  ): Promise<void> {
    const registrationData: CreateRegistrationData = {
      reservationId,
      eventId,
      registrationType,
      totalParticipants,
      registrationFee,
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
  }

  /**
   * Generates a reservation ID and timestamp
   * @returns Object with reservationId and timestamp
   */
  protected generateReservationData(): { reservationId: string; timestamp: string } {
    const reservationIdResult = reservationIdService.generateReservationId();
    return {
      reservationId: reservationIdResult.reservationId,
      timestamp: reservationIdResult.timestamp,
    };
  }
}