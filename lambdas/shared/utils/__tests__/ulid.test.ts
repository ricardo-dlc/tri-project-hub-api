import {
  generateParticipantId,
  generateReservationId,
  generateULID,
  isValidEventId,
  isValidParticipantId,
  isValidReservationId,
  isValidULID
} from '../ulid';

describe('ULID Utilities', () => {
  describe('generateULID', () => {
    it('should generate a valid ULID', () => {
      const ulid = generateULID();
      expect(typeof ulid).toBe('string');
      expect(ulid).toHaveLength(26);
      expect(isValidULID(ulid)).toBe(true);
    });

    it('should generate unique ULIDs', () => {
      const ulid1 = generateULID();
      const ulid2 = generateULID();
      expect(ulid1).not.toBe(ulid2);
    });

    it('should generate ULIDs that are sortable by time', async () => {
      const ulid1 = generateULID();
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      const ulid2 = generateULID();

      // ULIDs should be lexicographically sortable
      expect(ulid1 <= ulid2).toBe(true);
    });
  });

  describe('isValidULID', () => {
    it('should validate correct ULID format', () => {
      const validULIDs = [
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        '01BX5ZZKBKACTAV9WEVGEMMVRZ',
        '01CQRJPQZQJQJQJQJQJQJQJQJQ',
        generateULID(),
        generateULID()
      ];

      validULIDs.forEach(ulid => {
        expect(isValidULID(ulid)).toBe(true);
      });
    });

    it('should reject invalid ULID formats', () => {
      const invalidULIDs = [
        '', // empty
        '123', // too short
        '01ARZ3NDEKTSV4RRFFQ69G5FAV123', // too long
        '01arz3ndektsv4rrffq69g5fav', // lowercase
        '01ARZ3NDEKTSV4RRFFQ69G5FA!', // invalid character
        '01ARZ3NDEKTSV4RRFFQ69G5FIL', // contains 'I' (invalid in Crockford's Base32)
        '01ARZ3NDEKTSV4RRFFQ69G5FOO', // contains 'O' (invalid in Crockford's Base32)
        'invalid-id-format',
        'uuid-like-but-not-ulid-format',
        null as any,
        undefined as any,
        123 as any
      ];

      invalidULIDs.forEach(invalidId => {
        expect(isValidULID(invalidId)).toBe(false);
      });
    });
  });

  describe('generateReservationId', () => {
    it('should generate a valid reservation ID', () => {
      const reservationId = generateReservationId();
      expect(isValidReservationId(reservationId)).toBe(true);
      expect(isValidULID(reservationId)).toBe(true);
    });

    it('should generate unique reservation IDs', () => {
      const id1 = generateReservationId();
      const id2 = generateReservationId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateParticipantId', () => {
    it('should generate a valid participant ID', () => {
      const participantId = generateParticipantId();
      expect(isValidParticipantId(participantId)).toBe(true);
      expect(isValidULID(participantId)).toBe(true);
    });

    it('should generate unique participant IDs', () => {
      const id1 = generateParticipantId();
      const id2 = generateParticipantId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('ID validation functions', () => {
    const validULID = generateULID();
    const invalidId = 'invalid-id';

    it('should validate reservation IDs', () => {
      expect(isValidReservationId(validULID)).toBe(true);
      expect(isValidReservationId(invalidId)).toBe(false);
    });

    it('should validate participant IDs', () => {
      expect(isValidParticipantId(validULID)).toBe(true);
      expect(isValidParticipantId(invalidId)).toBe(false);
    });

    it('should validate event IDs', () => {
      expect(isValidEventId(validULID)).toBe(true);
      expect(isValidEventId(invalidId)).toBe(false);
    });
  });

  describe('ULID format specification', () => {
    it('should only contain valid Crockford Base32 characters', () => {
      const ulid = generateULID();
      const validChars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

      for (const char of ulid) {
        expect(validChars.includes(char)).toBe(true);
      }
    });

    it('should be exactly 26 characters long', () => {
      const ulid = generateULID();
      expect(ulid).toHaveLength(26);
    });

    it('should not contain ambiguous characters (I, L, O, U)', () => {
      const ulid = generateULID();
      const ambiguousChars = ['I', 'L', 'O', 'U'];

      for (const char of ambiguousChars) {
        expect(ulid.includes(char)).toBe(false);
      }
    });
  });
});
