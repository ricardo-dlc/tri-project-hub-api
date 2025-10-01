import { ReservationIdService, reservationIdService } from '../reservation-id.service';

describe('ReservationIdService', () => {
  let service: ReservationIdService;

  beforeEach(() => {
    service = new ReservationIdService();
  });

  describe('generateReservationId', () => {
    it('should generate a valid ULID reservation ID', () => {
      const result = service.generateReservationId();

      expect(result.reservationId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(typeof result.reservationId).toBe('string');
      expect(typeof result.timestamp).toBe('string');

      // ULID format validation: 26 characters using Crockford's Base32
      const ulidRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i;
      expect(result.reservationId).toMatch(ulidRegex);

      // Timestamp should be a valid ISO string
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('should generate unique reservation IDs on multiple calls', () => {
      const results = Array.from({ length: 100 }, () => service.generateReservationId());
      const reservationIds = results.map(r => r.reservationId);
      const uniqueIds = new Set(reservationIds);

      expect(uniqueIds.size).toBe(100);
      expect(reservationIds.length).toBe(100);
    });

    it('should generate timestamps that are close to current time', () => {
      const beforeGeneration = new Date();
      const result = service.generateReservationId();
      const afterGeneration = new Date();

      const generatedTime = new Date(result.timestamp);

      expect(generatedTime.getTime()).toBeGreaterThanOrEqual(beforeGeneration.getTime());
      expect(generatedTime.getTime()).toBeLessThanOrEqual(afterGeneration.getTime());
    });
  });

  describe('generateReservationIdWithPrefix', () => {
    it('should generate a reservation ID with default prefix', () => {
      const result = service.generateReservationIdWithPrefix();

      expect(result.reservationId).toMatch(/^RES-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i);
      expect(result.timestamp).toBeDefined();
    });

    it('should generate a reservation ID with custom prefix', () => {
      const customPrefix = 'EVENT';
      const result = service.generateReservationIdWithPrefix(customPrefix);

      expect(result.reservationId).toMatch(/^EVENT-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i);
      expect(result.reservationId.startsWith(`${customPrefix}-`)).toBe(true);
    });

    it('should generate unique prefixed reservation IDs', () => {
      const results = Array.from({ length: 50 }, () => service.generateReservationIdWithPrefix('TEST'));
      const reservationIds = results.map(r => r.reservationId);
      const uniqueIds = new Set(reservationIds);

      expect(uniqueIds.size).toBe(50);
      results.forEach(result => {
        expect(result.reservationId.startsWith('TEST-')).toBe(true);
      });
    });
  });

  describe('validateReservationIdFormat', () => {
    it('should validate plain ULID format', () => {
      const result = service.generateReservationId();
      expect(service.validateReservationIdFormat(result.reservationId)).toBe(true);
    });

    it('should validate prefixed ULID format', () => {
      const result = service.generateReservationIdWithPrefix('RES');
      expect(service.validateReservationIdFormat(result.reservationId)).toBe(true);
    });

    it('should reject invalid ULID formats', () => {
      const invalidIds = [
        'invalid-ulid',
        '01ARZ3NDEKTSV4RRFFQ69G5FA', // Too short (25 chars instead of 26)
        'RES-invalid-ulid',
        '',
        'RES-01ARZ3NDEKTSV4RRFFQ69G5FA', // Too short
        '01ARZ3NDEKTSV4RRFFQ69G5FABC', // Too long (27 chars)
        '01ARZ3NDEKTSV4RRFFQ69G5FIL', // Contains invalid chars (I, L)
        '01ARZ3NDEKTSV4RRFFQ69G5FOU', // Contains invalid chars (O, U)
      ];

      invalidIds.forEach(id => {
        expect(service.validateReservationIdFormat(id)).toBe(false);
      });
    });

    it('should validate various valid ULID formats', () => {
      const validIds = [
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        'RES-01ARZ3NDEKTSV4RRFFQ69G5FAV',
        'EVENT-01BX5ZZKBKACTAV9WEVGEMMVRZ',
        'TEAM-01BX5ZZKBKACTAV9WEVGEMMVS0',
      ];

      validIds.forEach(id => {
        expect(service.validateReservationIdFormat(id)).toBe(true);
      });
    });
  });

  describe('extractUlid', () => {
    it('should extract ULID from prefixed reservation ID', () => {
      const ulid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const prefixedId = `RES-${ulid}`;

      const extracted = service.extractUlid(prefixedId);
      expect(extracted).toBe(ulid);
    });

    it('should return the same ULID if no prefix is present', () => {
      const ulid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

      const extracted = service.extractUlid(ulid);
      expect(extracted).toBe(ulid);
    });

    it('should handle various prefix formats', () => {
      const ulid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const testCases = [
        { input: `EVENT-${ulid}`, expected: ulid },
        { input: `TEAM-${ulid}`, expected: ulid },
        { input: `INDIVIDUAL-${ulid}`, expected: ulid },
        { input: ulid, expected: ulid },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(service.extractUlid(input)).toBe(expected);
      });
    });
  });

  describe('generateMultipleReservationIds', () => {
    it('should generate the requested number of reservation IDs', () => {
      const count = 5;
      const results = service.generateMultipleReservationIds(count);

      expect(results).toHaveLength(count);
      results.forEach(result => {
        expect(result.reservationId).toBeDefined();
        expect(result.timestamp).toBeDefined();
        expect(service.validateReservationIdFormat(result.reservationId)).toBe(true);
      });
    });

    it('should generate unique reservation IDs in batch', () => {
      const count = 10;
      const results = service.generateMultipleReservationIds(count);
      const reservationIds = results.map(r => r.reservationId);
      const uniqueIds = new Set(reservationIds);

      expect(uniqueIds.size).toBe(count);
    });

    it('should generate prefixed reservation IDs in batch', () => {
      const count = 3;
      const prefix = 'BATCH';
      const results = service.generateMultipleReservationIds(count, prefix);

      expect(results).toHaveLength(count);
      results.forEach(result => {
        expect(result.reservationId.startsWith(`${prefix}-`)).toBe(true);
        expect(service.validateReservationIdFormat(result.reservationId)).toBe(true);
      });
    });

    it('should return empty array for zero or negative count', () => {
      expect(service.generateMultipleReservationIds(0)).toEqual([]);
      expect(service.generateMultipleReservationIds(-1)).toEqual([]);
      expect(service.generateMultipleReservationIds(-5)).toEqual([]);
    });

    it('should handle large batch generation', () => {
      const count = 1000;
      const results = service.generateMultipleReservationIds(count);
      const reservationIds = results.map(r => r.reservationId);
      const uniqueIds = new Set(reservationIds);

      expect(results).toHaveLength(count);
      expect(uniqueIds.size).toBe(count); // All should be unique
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(reservationIdService).toBeInstanceOf(ReservationIdService);
    });

    it('should generate valid reservation IDs using singleton', () => {
      const result = reservationIdService.generateReservationId();
      expect(reservationIdService.validateReservationIdFormat(result.reservationId)).toBe(true);
    });
  });

  describe('uniqueness across system', () => {
    it('should generate globally unique IDs across multiple service instances', () => {
      const service1 = new ReservationIdService();
      const service2 = new ReservationIdService();

      const results1 = Array.from({ length: 50 }, () => service1.generateReservationId());
      const results2 = Array.from({ length: 50 }, () => service2.generateReservationId());

      const allIds = [...results1, ...results2].map(r => r.reservationId);
      const uniqueIds = new Set(allIds);

      expect(uniqueIds.size).toBe(100); // All 100 IDs should be unique
    });

    it('should maintain uniqueness under concurrent generation', async () => {
      const concurrentGenerations = Array.from({ length: 10 }, () =>
        Promise.resolve().then(() => service.generateMultipleReservationIds(10))
      );

      const results = await Promise.all(concurrentGenerations);
      const allIds = results.flat().map(r => r.reservationId);
      const uniqueIds = new Set(allIds);

      expect(uniqueIds.size).toBe(100); // All 100 IDs should be unique
    });
  });
});