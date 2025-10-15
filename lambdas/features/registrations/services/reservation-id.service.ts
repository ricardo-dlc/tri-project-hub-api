import { generateReservationId as generateReservationULID, isValidReservationId, generateULID } from '@/shared/utils/ulid';

export interface ReservationIdResult {
  reservationId: string;
  timestamp: string;
}

export class ReservationIdService {
  /**
   * Generates a unique reservation ID using ULID
   * @returns ReservationIdResult containing the reservation ID and timestamp
   */
  generateReservationId(): ReservationIdResult {
    const reservationId = generateReservationULID();
    const timestamp = new Date().toISOString();

    return {
      reservationId,
      timestamp,
    };
  }

  /**
   * Generates a reservation ID with a custom prefix for easier identification
   * @param prefix - Optional prefix for the reservation ID (default: 'RES')
   * @returns ReservationIdResult containing the prefixed reservation ID and timestamp
   */
  generateReservationIdWithPrefix(prefix: string = 'RES'): ReservationIdResult {
    const ulidId = generateULID();
    const reservationId = `${prefix}-${ulidId}`;
    const timestamp = new Date().toISOString();

    return {
      reservationId,
      timestamp,
    };
  }

  /**
   * Validates that a reservation ID follows the expected format
   * @param reservationId - The reservation ID to validate
   * @returns boolean indicating if the format is valid
   */
  validateReservationIdFormat(reservationId: string): boolean {
    // Check if it's a plain ULID
    if (isValidReservationId(reservationId)) {
      return true;
    }

    // Check if it's a prefixed ULID (PREFIX-ULID format)
    const prefixedUlidRegex = /^[A-Z]+-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i;
    return prefixedUlidRegex.test(reservationId);
  }

  /**
   * Extracts the ULID portion from a prefixed reservation ID
   * @param reservationId - The reservation ID (prefixed or plain ULID)
   * @returns string containing just the ULID portion
   */
  extractUlid(reservationId: string): string {
    if (reservationId.includes('-')) {
      // This is a prefixed ULID, extract everything after the first dash
      const dashIndex = reservationId.indexOf('-');
      return reservationId.substring(dashIndex + 1);
    }

    // This is already a plain ULID
    return reservationId;
  }

  /**
   * Generates multiple unique reservation IDs
   * Useful for batch operations or testing
   * @param count - Number of reservation IDs to generate
   * @param prefix - Optional prefix for the reservation IDs
   * @returns Array of ReservationIdResult objects
   */
  generateMultipleReservationIds(count: number, prefix?: string): ReservationIdResult[] {
    if (count <= 0) {
      return [];
    }

    const results: ReservationIdResult[] = [];

    for (let i = 0; i < count; i++) {
      const result = prefix
        ? this.generateReservationIdWithPrefix(prefix)
        : this.generateReservationId();
      results.push(result);
    }

    return results;
  }
}

// Export a singleton instance for use across the application
export const reservationIdService = new ReservationIdService();
