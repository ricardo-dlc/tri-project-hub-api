import { EventEntity } from '@/features/events/models/event.model';
import { ParticipantEntity, ParticipantItem } from '@/features/registrations/models/participant.model';
import { RegistrationEntity } from '@/features/registrations/models/registration.model';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/shared/errors';
import { createFeatureLogger } from '@/shared/logger';
import { ddbDocClient } from '@/shared/utils/dynamo';
import { isValidULID } from '@/shared/utils/ulid';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

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

export interface RegistrationWithParticipants {
  registration: {
    reservationId: string;
    eventId: string;
    registrationType: 'individual' | 'team';
    paymentStatus: boolean;
    totalParticipants: number;
    registrationFee: number;
    createdAt: string;
    updatedAt: string;
  };
  participants: ParticipantItem[];
  event: {
    eventId: string;
    title: string;
    creatorId: string;
  };
}

export interface DeletionResult {
  success: boolean;
  reservationId: string;
  deletedParticipantCount: number;
  eventId: string;
  message: string;
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

  /**
   * Validates that the reservation ID is in valid ULID format
   * @param reservationId - The reservation ID to validate
   * @throws BadRequestError if ULID format is invalid
   */
  private validateReservationIdFormat(reservationId: string): void {
    if (!isValidULID(reservationId)) {
      throw new BadRequestError('Invalid reservation ID format. Must be a valid ULID.', { reservationId });
    }
  }

  /**
   * Retrieves a specific registration with all its participants by reservation ID
   * Includes authorization validation to ensure organizer owns the associated event
   * @param reservationId - The reservation ID to retrieve
   * @param organizerId - The organizer ID requesting the data (for access control)
   * @returns Promise<RegistrationWithParticipants> - Registration with participants and event data
   * @throws NotFoundError if registration or event doesn't exist
   * @throws ForbiddenError if organizer doesn't have access to the registration
   * @throws BadRequestError if reservation ID format is invalid
   */
  async getRegistrationWithParticipants(reservationId: string, organizerId: string): Promise<RegistrationWithParticipants> {
    logger.info({
      reservationId,
      organizerId,
      operation: 'getRegistrationWithParticipants'
    }, 'Retrieving registration with participants');

    try {
      // Validate reservation ID format
      this.validateReservationIdFormat(reservationId);

      logger.debug({ reservationId }, 'Reservation ID format validated');

      // Get registration using ElectroDB entity
      const registrationResult = await RegistrationEntity.get({ reservationId }).go();
      if (!registrationResult.data) {
        logger.warn({ reservationId, organizerId }, 'Registration not found');
        throw new NotFoundError('Registration not found');
      }
      const registration = registrationResult.data;

      logger.debug({
        reservationId,
        eventId: registration.eventId,
        registrationType: registration.registrationType,
        totalParticipants: registration.totalParticipants,
        paymentStatus: registration.paymentStatus
      }, 'Registration found');

      // Get event using ElectroDB entity to check creator
      const eventResult = await EventEntity.get({ eventId: registration.eventId }).go();
      if (!eventResult.data) {
        logger.error({
          reservationId,
          eventId: registration.eventId,
          organizerId
        }, 'Associated event not found');
        throw new NotFoundError('Associated event not found');
      }

      if (eventResult.data.creatorId !== organizerId) {
        logger.warn({
          reservationId,
          eventId: registration.eventId,
          organizerId,
          eventCreatorId: eventResult.data.creatorId
        }, 'Unauthorized access attempt to registration');
        throw new ForbiddenError('Unauthorized access to registration');
      }

      const event = eventResult.data;

      logger.debug({
        reservationId,
        eventId: registration.eventId,
        organizerId,
        eventCreatorId: event.creatorId
      }, 'Authorization validated');

      // Get participants using ElectroDB ReservationParticipantIndex
      const participantsResult = await ParticipantEntity.query
        .ReservationParticipantIndex({ reservationParticipantId: reservationId })
        .go();
      const participants = participantsResult.data || [];

      logger.info({
        reservationId,
        eventId: registration.eventId,
        participantCount: participants.length,
        organizerId,
        registrationType: registration.registrationType,
        paymentStatus: registration.paymentStatus
      }, 'Successfully retrieved registration with participants');

      return {
        registration: {
          reservationId: registration.reservationId,
          eventId: registration.eventId,
          registrationType: registration.registrationType as 'individual' | 'team',
          paymentStatus: registration.paymentStatus,
          totalParticipants: registration.totalParticipants,
          registrationFee: registration.registrationFee,
          createdAt: registration.createdAt,
          updatedAt: registration.updatedAt,
        },
        participants,
        event: {
          eventId: event.eventId,
          title: event.title,
          creatorId: event.creatorId,
        },
      };
    } catch (error) {
      logger.error({
        reservationId,
        organizerId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 'Error retrieving registration with participants');
      throw error;
    }
  }

  /**
   * Deletes a registration and all associated participants atomically using ElectroDB
   * Includes authorization validation to ensure organizer owns the associated event
   * Updates event participant count using atomic transaction operations
   * @param reservationId - The reservation ID to delete
   * @param organizerId - The organizer ID requesting the deletion (for access control)
   * @returns Promise<DeletionResult> - Result of the deletion operation
   * @throws ValidationError if reservation ID format is invalid
   * @throws NotFoundError if registration or event doesn't exist
   * @throws ForbiddenError if organizer doesn't have access to the registration
   */
  async deleteRegistrationByReservationId(reservationId: string, organizerId: string): Promise<DeletionResult> {
    logger.info({
      reservationId,
      organizerId,
      operation: 'deleteRegistrationByReservationId'
    }, 'Starting registration deletion process');

    try {
      // Step 1: Validate reservation ID format
      this.validateReservationIdFormat(reservationId);

      logger.debug({ reservationId }, 'Reservation ID format validated');

      // Step 2: Get registration using ElectroDB entity
      const registrationResult = await RegistrationEntity.get({ reservationId }).go();
      if (!registrationResult.data) {
        logger.warn({ reservationId, organizerId }, 'Registration not found for deletion');
        throw new NotFoundError('Registration not found');
      }
      const registration = registrationResult.data;

      logger.debug({
        reservationId,
        eventId: registration.eventId,
        registrationType: registration.registrationType,
        totalParticipants: registration.totalParticipants,
        paymentStatus: registration.paymentStatus
      }, 'Registration found for deletion');

      // Step 3: Get event using ElectroDB entity to check creator authorization
      const eventResult = await EventEntity.get({ eventId: registration.eventId }).go();
      if (!eventResult.data) {
        logger.error({
          reservationId,
          eventId: registration.eventId,
          organizerId
        }, 'Associated event not found for deletion');
        throw new NotFoundError('Associated event not found');
      }

      if (eventResult.data.creatorId !== organizerId) {
        logger.warn({
          reservationId,
          eventId: registration.eventId,
          organizerId,
          eventCreatorId: eventResult.data.creatorId
        }, 'Unauthorized deletion attempt');
        throw new ForbiddenError('Unauthorized access to registration');
      }

      const event = eventResult.data;

      logger.debug({
        reservationId,
        eventId: registration.eventId,
        organizerId,
        eventCreatorId: event.creatorId
      }, 'Authorization validated for deletion');

      // Step 4: Get all participants using ElectroDB ReservationParticipantIndex
      const participantsResult = await ParticipantEntity.query
        .ReservationParticipantIndex({ reservationParticipantId: reservationId })
        .go();
      const participants = participantsResult.data || [];

      logger.info({
        reservationId,
        eventId: registration.eventId,
        participantCount: participants.length,
        participantIds: participants.map(p => p.participantId)
      }, 'Preparing atomic deletion transaction');

      // Step 5: Perform atomic deletion using DynamoDB transaction
      const transactionItems = [];

      // Add participant deletions using ElectroDB delete operations
      for (const participant of participants) {
        const deleteParams = ParticipantEntity.delete({ participantId: participant.participantId }).params();
        transactionItems.push({
          Delete: {
            TableName: deleteParams.TableName,
            Key: deleteParams.Key,
            ...(deleteParams.ConditionExpression && {
              ConditionExpression: deleteParams.ConditionExpression,
              ExpressionAttributeNames: deleteParams.ExpressionAttributeNames,
              ExpressionAttributeValues: deleteParams.ExpressionAttributeValues
            })
          }
        });
      }

      // Add registration deletion using ElectroDB delete operation
      const registrationDeleteParams = RegistrationEntity.delete({ reservationId }).params();
      transactionItems.push({
        Delete: {
          TableName: registrationDeleteParams.TableName,
          Key: registrationDeleteParams.Key,
          ...(registrationDeleteParams.ConditionExpression && {
            ConditionExpression: registrationDeleteParams.ConditionExpression,
            ExpressionAttributeNames: registrationDeleteParams.ExpressionAttributeNames,
            ExpressionAttributeValues: registrationDeleteParams.ExpressionAttributeValues
          })
        }
      });

      // Add event count update using ElectroDB update operation
      const eventUpdateParams = EventEntity.update({ eventId: registration.eventId })
        .add({ currentParticipants: -participants.length })
        .set({ updatedAt: new Date().toISOString() })
        .params();
      transactionItems.push({
        Update: {
          TableName: eventUpdateParams.TableName,
          Key: eventUpdateParams.Key,
          UpdateExpression: eventUpdateParams.UpdateExpression,
          ...(eventUpdateParams.ExpressionAttributeNames && {
            ExpressionAttributeNames: eventUpdateParams.ExpressionAttributeNames
          }),
          ...(eventUpdateParams.ExpressionAttributeValues && {
            ExpressionAttributeValues: eventUpdateParams.ExpressionAttributeValues
          }),
          ...(eventUpdateParams.ConditionExpression && {
            ConditionExpression: eventUpdateParams.ConditionExpression
          })
        }
      });

      logger.debug({
        reservationId,
        transactionItemCount: transactionItems.length,
        participantCountDecrement: -participants.length
      }, 'Executing atomic deletion transaction');

      // Execute transaction using DynamoDB client
      await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactionItems }));

      logger.info({
        reservationId,
        eventId: registration.eventId,
        deletedParticipantCount: participants.length,
        organizerId
      }, 'Registration deletion completed successfully');

      return {
        success: true,
        reservationId,
        deletedParticipantCount: participants.length,
        eventId: registration.eventId,
        message: 'Registration and all participants deleted successfully'
      };

    } catch (error) {
      logger.error({
        reservationId,
        organizerId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 'Error during registration deletion');
      throw error;
    }
  }
}

// Export singleton instance
export const participantQueryService = new ParticipantQueryService();
