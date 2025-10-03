import { BaseRegistrationService } from './base-registration.service';
import { capacityValidationService } from './capacity-validation.service';
import { emailValidationService } from './email-validation.service';

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

export class IndividualRegistrationService extends BaseRegistrationService {
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
    const { reservationId, timestamp } = this.generateReservationData();

    try {
      // Create registration entity
      await this.createRegistrationEntity(
        reservationId,
        eventId,
        'individual',
        1,
        event.registrationFee,
        timestamp
      );

      // Create participant entity
      const participantId = await this.createParticipantEntity(
        participantData,
        reservationId,
        eventId,
        timestamp
      );

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
    this.validateSingleParticipantInput(eventId, participantData);

    // Step 2: Validate event exists and is available for individual registration
    const event = await this.validateEventAvailability(eventId, 'individual');

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
    this.validateSingleParticipantInput(eventId, participantData);
    await this.validateEventAvailability(eventId, 'individual');
    await emailValidationService.validateIndividualRegistration(eventId, participantData.email);
    await capacityValidationService.validateIndividualRegistration(eventId);

    return true;
  }
}

// Export a singleton instance for use across the application
export const individualRegistrationService = new IndividualRegistrationService();
