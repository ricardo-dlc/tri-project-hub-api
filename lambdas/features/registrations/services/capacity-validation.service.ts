import { ConflictError, NotFoundError } from '../../../shared/errors';
import { EventEntity } from '../../events/models/event.model';

export interface CapacityValidationResult {
  isValid: boolean;
  maxParticipants: number;
  currentParticipants: number;
  requestedParticipants: number;
  availableSpots: number;
}

export class CapacityValidationService {
  /**
   * Validates if an event has sufficient capacity for new participants
   * @param eventId - The event ID to check capacity for
   * @param requestedParticipants - Number of participants to register
   * @returns Promise<CapacityValidationResult>
   */
  async validateCapacity(eventId: string, requestedParticipants: number): Promise<CapacityValidationResult> {
    if (requestedParticipants <= 0) {
      throw new Error('Requested participants must be greater than 0');
    }

    try {
      // Fetch the event to get current capacity information
      const eventResult = await EventEntity.get({ id: eventId }).go();

      if (!eventResult.data) {
        throw new NotFoundError(`Event with ID ${eventId} not found`);
      }

      const event = eventResult.data;
      const maxParticipants = event.maxParticipants;
      const currentParticipants = event.currentParticipants;
      const availableSpots = maxParticipants - currentParticipants;
      const isValid = availableSpots >= requestedParticipants;

      return {
        isValid,
        maxParticipants,
        currentParticipants,
        requestedParticipants,
        availableSpots,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to validate event capacity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates capacity for individual registration
   * @param eventId - The event ID to check capacity for
   * @throws ConflictError if event is at capacity
   * @throws NotFoundError if event doesn't exist
   */
  async validateIndividualRegistration(eventId: string): Promise<void> {
    const result = await this.validateCapacity(eventId, 1);

    if (!result.isValid) {
      throw new ConflictError(
        `Event is at maximum capacity. Available spots: ${result.availableSpots}, requested: ${result.requestedParticipants}`,
        {
          eventId,
          maxParticipants: result.maxParticipants,
          currentParticipants: result.currentParticipants,
          requestedParticipants: result.requestedParticipants,
          availableSpots: result.availableSpots,
        }
      );
    }
  }

  /**
   * Validates capacity for team registration
   * @param eventId - The event ID to check capacity for
   * @param teamSize - Number of team members to register
   * @throws ConflictError if event doesn't have sufficient capacity or team size doesn't match required participants
   * @throws NotFoundError if event doesn't exist
   */
  async validateTeamRegistration(eventId: string, teamSize: number): Promise<void> {
    const result = await this.validateCapacity(eventId, teamSize);

    // Fetch event to check required participants
    const eventResult = await EventEntity.get({ id: eventId }).go();
    if (!eventResult.data) {
      throw new NotFoundError(`Event with ID ${eventId} not found`);
    }

    const event = eventResult.data;

    // Validate team size matches required participants
    if (event.requiredParticipants && teamSize !== event.requiredParticipants) {
      throw new ConflictError(
        `Team size must be exactly ${event.requiredParticipants} participants. Received: ${teamSize}`,
        {
          eventId,
          requiredParticipants: event.requiredParticipants,
          providedParticipants: teamSize,
        }
      );
    }

    // Validate capacity
    if (!result.isValid) {
      throw new ConflictError(
        `Event does not have sufficient capacity for team registration. Available spots: ${result.availableSpots}, team size: ${result.requestedParticipants}`,
        {
          eventId,
          maxParticipants: result.maxParticipants,
          currentParticipants: result.currentParticipants,
          requestedParticipants: result.requestedParticipants,
          availableSpots: result.availableSpots,
          teamSize,
        }
      );
    }
  }

  /**
   * Checks if an event exists and is enabled for registration
   * @param eventId - The event ID to check
   * @returns Promise<boolean> - true if event exists and is enabled
   * @throws NotFoundError if event doesn't exist
   */
  async isEventAvailableForRegistration(eventId: string): Promise<boolean> {
    try {
      const eventResult = await EventEntity.get({ id: eventId }).go();

      if (!eventResult.data) {
        throw new NotFoundError(`Event with ID ${eventId} not found`);
      }

      const event = eventResult.data;

      // Check if event is enabled
      if (!event.isEnabled) {
        return false;
      }

      // Check if registration deadline has passed
      const now = new Date();
      const registrationDeadline = new Date(event.registrationDeadline);

      if (now > registrationDeadline) {
        return false;
      }

      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to check event availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export a singleton instance for use across the application
export const capacityValidationService = new CapacityValidationService();
