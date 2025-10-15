import { BadRequestError, NotFoundError } from '@/shared/errors';
import { createFeatureLogger } from '@/shared/logger';
import { isValidULID } from '@/shared/utils/ulid';
import { EventEntity } from '@/features/events/models/event.model';
import { ParticipantEntity, ParticipantItem } from '@/features/registrations/models/participant.model';
import { RegistrationEntity } from '@/features/registrations/models/registration.model';

const logger = createFeatureLogger('registrations');

export interface ParticipantWithRegistration {
  participantId: string;
  reservationId: string;
  eventId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  emergencyEmail?: string;
  shirtSize?: string;
  dietaryRestrictions?: string;
  medicalConditions?: string;
  medications?: string;
  allergies?: string;
  waiver: boolean;
  newsletter: boolean;
  role?: string;
  createdAt: string;
  updatedAt: string;
  // Registration information
  registrationType: 'individual' | 'team';
  paymentStatus: boolean;
  totalParticipants: number;
  registrationFee: number;
  registrationCreatedAt: string;
}

export interface ParticipantQueryResult {
  participants: ParticipantWithRegistration[];
  totalCount: number;
  registrationSummary: {
    totalRegistrations: number;
    paidRegistrations: number;
    unpaidRegistrations: number;
    individualRegistrations: number;
    teamRegistrations: number;
  };
}

export class ParticipantQueryService {
  /**
   * Validates that the event ID is in valid ULID format
   * @param eventId - The event ID to validate
   * @throws BadRequestError if ULID format is invalid
   */
  private validateEventIdFormat(eventId: string): void {
    if (!isValidULID(eventId)) {
      throw new BadRequestError('Invalid event ID format. Must be a valid ULID.', { eventId });
    }
  }

  /**
   * Validates that the event exists and the organizer has access to it
   * @param eventId - The event ID to validate
   * @param organizerId - The organizer ID requesting access
   * @throws NotFoundError if event doesn't exist
   * @throws BadRequestError if organizer doesn't have access
   */
  private async validateEventAccess(eventId: string, organizerId: string): Promise<void> {
    try {
      const eventResult = await EventEntity.get({ eventId }).go();

      if (!eventResult.data) {
        throw new NotFoundError(`Event with ID ${eventId} not found`);
      }

      const event = eventResult.data;

      // Check if the organizer is the creator of this event
      if (event.creatorId !== organizerId) {
        throw new BadRequestError('Access denied. You can only view participants for events you created.', {
          eventId,
          organizerId,
          eventCreatorId: event.creatorId,
        });
      }
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
        throw error;
      }
      throw new Error(`Failed to validate event access: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieves all participants for an event using the EventParticipantIndex
   * @param eventId - The event ID to query participants for
   * @returns Promise<ParticipantItem[]> - Array of participants
   */
  private async getParticipantsByEventId(eventId: string): Promise<ParticipantItem[]> {
    try {
      const result = await ParticipantEntity.query
        .EventParticipantIndex({ eventParticipantId: eventId })
        .go();

      return result.data || [];
    } catch (error) {
      throw new Error(`Failed to query participants: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieves registration information for multiple reservation IDs
   * @param reservationIds - Array of reservation IDs to fetch
   * @returns Promise<Map<string, any>> - Map of reservationId to registration data
   */
  private async getRegistrationsByReservationIds(reservationIds: string[]): Promise<Map<string, any>> {
    const registrationMap = new Map<string, any>();

    if (reservationIds.length === 0) {
      return registrationMap;
    }

    try {
      // Use batch get to retrieve all registrations efficiently
      const batchResults = await Promise.all(
        reservationIds.map(async (reservationId) => {
          try {
            const result = await RegistrationEntity.get({ reservationId }).go();
            return result.data;
          } catch (error) {
            // Log error but don't fail the entire operation
            logger.warn({ reservationId, error }, 'Failed to fetch registration');
            return null;
          }
        })
      );

      // Build the map from successful results
      batchResults.forEach((registration, index) => {
        if (registration) {
          registrationMap.set(reservationIds[index], registration);
        }
      });

      return registrationMap;
    } catch (error) {
      throw new Error(`Failed to fetch registration data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Combines participant data with registration information
   * @param participants - Array of participant data
   * @param registrations - Map of reservation ID to registration data
   * @returns ParticipantWithRegistration[] - Combined participant and registration data
   */
  private combineParticipantWithRegistration(
    participants: ParticipantItem[],
    registrations: Map<string, any>
  ): ParticipantWithRegistration[] {
    return participants.map((participant) => {
      const registration = registrations.get(participant.reservationId);

      if (!registration) {
        // This should not happen in normal operation, but we'll handle it gracefully
        logger.warn(
          { participantId: participant.participantId, reservationId: participant.reservationId },
          'No registration found for participant'
        );

        // Return participant data with default registration values
        return {
          ...participant,
          registrationType: 'individual' as const,
          paymentStatus: false,
          totalParticipants: 1,
          registrationFee: 0,
          registrationCreatedAt: participant.createdAt,
        };
      }

      return {
        ...participant,
        registrationType: registration.registrationType as 'individual' | 'team',
        paymentStatus: registration.paymentStatus,
        totalParticipants: registration.totalParticipants,
        registrationFee: registration.registrationFee,
        registrationCreatedAt: registration.createdAt,
      };
    });
  }

  /**
   * Calculates registration summary statistics
   * @param participantsWithRegistration - Array of participants with registration data
   * @returns Registration summary statistics
   */
  private calculateRegistrationSummary(participantsWithRegistration: ParticipantWithRegistration[]) {
    const uniqueReservations = new Map<string, ParticipantWithRegistration>();

    // Get unique registrations (one per reservation ID)
    participantsWithRegistration.forEach((participant) => {
      if (!uniqueReservations.has(participant.reservationId)) {
        uniqueReservations.set(participant.reservationId, participant);
      }
    });

    const registrations = Array.from(uniqueReservations.values());

    return {
      totalRegistrations: registrations.length,
      paidRegistrations: registrations.filter((r) => r.paymentStatus).length,
      unpaidRegistrations: registrations.filter((r) => !r.paymentStatus).length,
      individualRegistrations: registrations.filter((r) => r.registrationType === 'individual').length,
      teamRegistrations: registrations.filter((r) => r.registrationType === 'team').length,
    };
  }

  /**
   * Retrieves all participants for an event with registration and payment status information
   * @param eventId - The event ID to query participants for
   * @param organizerId - The organizer ID requesting the data (for access control)
   * @returns Promise<ParticipantQueryResult> - Participants with registration data and summary
   */
  async getParticipantsByEvent(eventId: string, organizerId: string): Promise<ParticipantQueryResult> {
    // Validate input
    this.validateEventIdFormat(eventId);

    // Validate event access
    await this.validateEventAccess(eventId, organizerId);

    // Get all participants for the event
    const participants = await this.getParticipantsByEventId(eventId);

    if (participants.length === 0) {
      return {
        participants: [],
        totalCount: 0,
        registrationSummary: {
          totalRegistrations: 0,
          paidRegistrations: 0,
          unpaidRegistrations: 0,
          individualRegistrations: 0,
          teamRegistrations: 0,
        },
      };
    }

    // Get unique reservation IDs
    const reservationIds = [...new Set(participants.map((p) => p.reservationId))];

    // Fetch registration data for all reservations
    const registrations = await this.getRegistrationsByReservationIds(reservationIds);

    // Combine participant and registration data
    const participantsWithRegistration = this.combineParticipantWithRegistration(participants, registrations);

    // Sort participants by reservation ID and then by creation date for consistent ordering
    participantsWithRegistration.sort((a, b) => {
      if (a.reservationId !== b.reservationId) {
        return a.reservationId.localeCompare(b.reservationId);
      }
      return a.createdAt.localeCompare(b.createdAt);
    });

    // Calculate summary statistics
    const registrationSummary = this.calculateRegistrationSummary(participantsWithRegistration);

    return {
      participants: participantsWithRegistration,
      totalCount: participants.length,
      registrationSummary,
    };
  }

  /**
   * Retrieves participants grouped by reservation ID for easier management
   * @param eventId - The event ID to query participants for
   * @param organizerId - The organizer ID requesting the data (for access control)
   * @returns Promise<Map<string, ParticipantWithRegistration[]>> - Participants grouped by reservation ID
   */
  async getParticipantsGroupedByReservation(
    eventId: string,
    organizerId: string
  ): Promise<Map<string, ParticipantWithRegistration[]>> {
    const result = await this.getParticipantsByEvent(eventId, organizerId);
    const groupedParticipants = new Map<string, ParticipantWithRegistration[]>();

    result.participants.forEach((participant) => {
      const reservationId = participant.reservationId;
      if (!groupedParticipants.has(reservationId)) {
        groupedParticipants.set(reservationId, []);
      }
      groupedParticipants.get(reservationId)!.push(participant);
    });

    return groupedParticipants;
  }
}

// Export singleton instance
export const participantQueryService = new ParticipantQueryService();
