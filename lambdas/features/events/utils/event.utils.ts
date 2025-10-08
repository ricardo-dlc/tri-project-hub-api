import { ClerkUser } from '../../../shared/auth/clerk';
import { BadRequestError, ForbiddenError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';
import { isValidULID } from '../../../shared/utils/ulid';
import { EventItem } from '../types/event.types';

/**
 * Validates ownership of an event with admin override logic
 * @param event - The event to validate ownership for
 * @param user - The authenticated user
 * @throws ForbiddenError if user doesn't own the event and is not an admin
 */
export const validateEventOwnership = (event: EventItem, user: ClerkUser): void => {
  logger.debug({
    eventId: event.eventId,
    eventCreatorId: event.creatorId,
    userId: user.id,
    userRole: user.role
  }, 'Validating event ownership');

  // Admin users can modify any event
  if (user.role === 'admin') {
    logger.debug({ userId: user.id, eventId: event.eventId }, 'Admin user - ownership validation bypassed');
    return;
  }

  // Regular users can only modify events they created
  if (event.creatorId !== user.id) {
    logger.warn({
      eventId: event.eventId,
      eventCreatorId: event.creatorId,
      userId: user.id
    }, 'User attempted to modify event they do not own');

    throw new ForbiddenError('You can only update events you created');
  }

  logger.debug({ userId: user.id, eventId: event.eventId }, 'Event ownership validation passed');
};

/**
 * Validates that an event ID is provided and has valid ULID format
 * @param eventId - The event ID to validate
 * @throws BadRequestError if event ID is invalid
 */
export const validateEventIdFormat = (eventId: string): void => {
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    throw new BadRequestError('Event ID is required');
  }

  if (!isValidULID(eventId)) {
    throw new BadRequestError('Invalid event ID format - must be a valid ULID');
  }
};

/**
 * Validates team event capacity requirements
 * @param isTeamEvent - Whether the event is a team event
 * @param maxParticipants - Maximum number of participants
 * @param requiredParticipants - Required participants per team
 * @throws BadRequestError if validation fails
 */
export const validateTeamEventCapacity = (isTeamEvent: boolean, maxParticipants: number, requiredParticipants: number): void => {
  if (isTeamEvent && maxParticipants % requiredParticipants !== 0) {
    const suggestedMax = Math.floor(maxParticipants / requiredParticipants) * requiredParticipants;
    const nextValidMax = suggestedMax + requiredParticipants;

    throw new BadRequestError(
      `For team events, maxParticipants (${maxParticipants}) must be a multiple of requiredParticipants (${requiredParticipants}). ` +
      `Suggested values: ${suggestedMax} or ${nextValidMax}`,
      {
        maxParticipants,
        requiredParticipants,
        suggestedValues: [suggestedMax, nextValidMax],
        availableTeamSlots: Math.floor(maxParticipants / requiredParticipants)
      }
    );
  }
};

/**
 * Validates that maxParticipants is not reduced below current registrations
 * @param newMaxParticipants - The new maximum participants value
 * @param currentParticipants - The current number of registered participants
 * @throws BadRequestError if validation fails
 */
export const validateMaxParticipantsReduction = (newMaxParticipants: number, currentParticipants: number): void => {
  if (newMaxParticipants < currentParticipants) {
    throw new BadRequestError(
      `Cannot reduce maxParticipants (${newMaxParticipants}) below current registrations (${currentParticipants}). ` +
      `Minimum allowed value: ${currentParticipants}`,
      {
        requestedMaxParticipants: newMaxParticipants,
        currentParticipants,
        minimumAllowed: currentParticipants
      }
    );
  }
};

/**
 * Validates that certain fields cannot be modified after event creation
 * @param updateData - The update data to validate
 * @param immutableFields - Array of field names that cannot be updated
 * @throws BadRequestError if any immutable fields are present in update data
 */
export const validateImmutableFields = (updateData: Record<string, any>, immutableFields: string[]): void => {
  const attemptedImmutableUpdates = immutableFields.filter(field => field in updateData);

  if (attemptedImmutableUpdates.length > 0) {
    throw new BadRequestError(
      `The following fields cannot be modified after creation: ${attemptedImmutableUpdates.join(', ')}`,
      { attemptedFields: attemptedImmutableUpdates }
    );
  }
};

/**
 * Validates admin-only field updates for non-admin users
 * @param updateData - The update data to validate
 * @param user - The authenticated user
 * @param adminOnlyFields - Array of field names that only admins can update
 * @returns Sanitized update data with admin-only fields removed for non-admin users
 */
export const validateAndSanitizeAdminOnlyFields = (
  updateData: Record<string, any>,
  user: ClerkUser,
  adminOnlyFields: string[]
): Record<string, any> => {
  if (user.role === 'admin') {
    // Admin can update all fields
    return updateData;
  }

  // For non-admin users, remove admin-only fields and log the action
  const sanitizedData = { ...updateData };
  const removedFields: string[] = [];

  adminOnlyFields.forEach(field => {
    if (field in sanitizedData) {
      delete sanitizedData[field];
      removedFields.push(field);
    }
  });

  if (removedFields.length > 0) {
    logger.debug({
      userId: user.id,
      userRole: user.role,
      removedFields
    }, 'Removed admin-only fields from update data for non-admin user');
  }

  return sanitizedData;
};