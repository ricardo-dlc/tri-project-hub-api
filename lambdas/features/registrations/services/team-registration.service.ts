import { ValidationError } from '../../../shared/errors';
import { createFeatureLogger } from '../../../shared/logger';
import { BaseRegistrationService } from './base-registration.service';
import { capacityValidationService } from './capacity-validation.service';
import { emailValidationService } from './email-validation.service';

const logger = createFeatureLogger('registrations');

export interface TeamParticipantData {
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

  // Team-specific
  role?: string;
}

export interface TeamRegistrationData {
  participants: TeamParticipantData[];
}

export interface TeamRegistrationResult {
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
}

export class TeamRegistrationService extends BaseRegistrationService {
  /**
   * Validates the input data for team registration
   * @param eventId - The event ID (must be valid ULID)
   * @param teamData - The team registration data
   * @throws ValidationError if data is invalid
   * @throws BadRequestError if ULID format is invalid
   */
  private validateInputData(eventId: string, teamData: TeamRegistrationData): void {
    // Validate event ID format
    this.validateEventIdFormat(eventId);

    // Validate team has participants
    if (!teamData.participants || teamData.participants.length === 0) {
      throw new ValidationError('Team registration must include at least one participant', { participantCount: 0 });
    }

    // Validate each participant using base class method
    const participantErrors: Array<{ index: number; errors: string[] }> = [];

    teamData.participants.forEach((participant, index) => {
      const errors = this.validateParticipantData(participant, index);
      if (errors.length > 0) {
        participantErrors.push({ index, errors });
      }
    });

    if (participantErrors.length > 0) {
      throw new ValidationError('Team registration contains invalid participant data', { participantErrors });
    }
  }



  /**
   * Creates the registration and participant entities in the database
   * @param eventId - The event ID
   * @param teamData - The team registration data
   * @param event - The event data (for registration fee)
   * @returns Promise<TeamRegistrationResult>
   */
  private async createRegistrationEntities(
    eventId: string,
    teamData: TeamRegistrationData,
    event: any
  ): Promise<TeamRegistrationResult> {
    const { reservationId, timestamp } = this.generateReservationData();
    const totalParticipants = teamData.participants.length;

    try {
      // Create registration entity
      await this.createRegistrationEntity(
        reservationId,
        eventId,
        'team',
        totalParticipants,
        event.registrationFee * totalParticipants,
        timestamp
      );

      // Create participant entities for each team member
      const participantResults: Array<{
        participantId: string;
        email: string;
        firstName: string;
        lastName: string;
        role?: string;
      }> = [];

      for (const participantData of teamData.participants) {
        const participantId = await this.createParticipantEntity(
          participantData,
          reservationId,
          eventId,
          timestamp
        );

        participantResults.push({
          participantId,
          email: participantData.email,
          firstName: participantData.firstName,
          lastName: participantData.lastName,
          role: participantData.role,
        });
      }

      return {
        reservationId,
        eventId,
        participants: participantResults,
        paymentStatus: false,
        registrationFee: event.registrationFee * totalParticipants,
        totalParticipants,
        createdAt: timestamp,
      };
    } catch (error) {
      // If any entity creation fails, we should attempt to clean up
      // In a production system, this would be handled by a transaction or saga pattern
      throw new Error(`Failed to create team registration entities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



  /**
   * Processes a team registration for an event
   * @param eventId - The event ID (must be valid ULID)
   * @param teamData - The team registration data
   * @returns Promise<TeamRegistrationResult>
   * @throws ValidationError for invalid input data
   * @throws BadRequestError for invalid ULID format
   * @throws NotFoundError if event doesn't exist
   * @throws ConflictError for business rule violations (capacity, email duplicates, etc.)
   */
  async registerTeam(
    eventId: string,
    teamData: TeamRegistrationData
  ): Promise<TeamRegistrationResult> {
    const teamSize = teamData.participants.length;
    logger.debug({ eventId, teamSize }, 'Starting team registration');

    // Step 1: Validate input data and ULID format
    this.validateInputData(eventId, teamData);

    // Step 2: Validate event exists and is available for team registration
    const event = await this.validateEventAvailability(eventId, 'team');
    logger.debug({ eventId, eventTitle: event.title, registrationFee: event.registrationFee, teamSize }, 'Event validated for team');

    // Step 3: Extract emails for validation
    const emails = teamData.participants.map(p => p.email);

    // Step 4: Validate email uniqueness (both within team and against existing participants)
    await emailValidationService.validateTeamRegistration(eventId, emails);
    logger.debug({ eventId, teamSize }, 'Email validation passed for team');

    // Step 5: Validate event capacity for the entire team
    await capacityValidationService.validateTeamRegistration(eventId, teamData.participants.length);
    logger.debug({ eventId, teamSize, currentParticipants: event.currentParticipants, maxParticipants: event.maxParticipants }, 'Capacity validation passed for team');

    // Step 6: Create registration and participant entities
    const result = await this.createRegistrationEntities(eventId, teamData, event);
    logger.debug({ eventId, reservationId: result.reservationId, teamSize }, 'Team registration entities created');

    // Step 7: Update event participant count
    await this.updateEventParticipantCount(eventId, teamData.participants.length);
    logger.debug({ eventId, newCount: event.currentParticipants + teamSize }, 'Event participant count updated for team');

    return result;
  }

  /**
   * Validates team registration without creating entities
   * Useful for pre-validation before payment processing
   * @param eventId - The event ID (must be valid ULID)
   * @param teamData - The team registration data
   * @returns Promise<boolean> - true if registration would be valid
   * @throws Same errors as registerTeam but without creating entities
   */
  async validateTeamRegistration(
    eventId: string,
    teamData: TeamRegistrationData
  ): Promise<boolean> {
    // Perform all validation steps without creating entities
    this.validateInputData(eventId, teamData);
    await this.validateEventAvailability(eventId, 'team');

    const emails = teamData.participants.map(p => p.email);
    await emailValidationService.validateTeamRegistration(eventId, emails);
    await capacityValidationService.validateTeamRegistration(eventId, teamData.participants.length);

    return true;
  }
}

// Export a singleton instance for use across the application
export const teamRegistrationService = new TeamRegistrationService();
