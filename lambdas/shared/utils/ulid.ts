import { ulid } from 'ulid';

/**
 * ULID utility functions for consistent ID generation and validation
 * across the registration system
 */

/**
 * Generate a new ULID
 * @returns A new ULID string (26 characters)
 */
export const generateULID = (): string => {
  return ulid();
};

/**
 * Validate if a string is a valid ULID format
 * @param id The string to validate
 * @returns True if the string is a valid ULID format
 */
export const isValidULID = (id: string): boolean => {
  // ULID format: 26 characters using Crockford's Base32 encoding
  // Characters: 0123456789ABCDEFGHJKMNPQRSTVWXYZ
  return /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/.test(id);
};

/**
 * Generate a reservation ID (ULID format)
 * @returns A new ULID for reservation tracking
 */
export const generateReservationId = (): string => {
  return generateULID();
};

/**
 * Generate a participant ID (ULID format)
 * @returns A new ULID for participant identification
 */
export const generateParticipantId = (): string => {
  return generateULID();
};

/**
 * Validate reservation ID format
 * @param reservationId The reservation ID to validate
 * @returns True if valid ULID format
 */
export const isValidReservationId = (reservationId: string): boolean => {
  return isValidULID(reservationId);
};

/**
 * Validate participant ID format
 * @param participantId The participant ID to validate
 * @returns True if valid ULID format
 */
export const isValidParticipantId = (participantId: string): boolean => {
  return isValidULID(participantId);
};

/**
 * Validate event ID format (assuming events also use ULID)
 * @param eventId The event ID to validate
 * @returns True if valid ULID format
 */
export const isValidEventId = (eventId: string): boolean => {
  return isValidULID(eventId);
};

/**
 * Generate an organizer ID (ULID format)
 * @returns A new ULID for organizer identification
 */
export const generateOrganizerId = (): string => {
  return generateULID();
};

/**
 * Validate organizer ID format
 * @param organizerId The organizer ID to validate
 * @returns True if valid ULID format
 */
export const isValidOrganizerId = (organizerId: string): boolean => {
  return isValidULID(organizerId);
};
