import { generateOrganizerId, isValidOrganizerId } from '../../../../shared/utils/ulid';
import { CreateOrganizerData, OrganizerItem } from '../../types/organizer.types';
import {
  isValidClerkId,
  isValidOrganizerItem,
  sanitizeCreateOrganizerData,
  sanitizeOrganizerName,
  sanitizeOrganizerWebsite
} from '../organizer.utils';

describe('Organizer Utilities', () => {
  describe('generateOrganizerId', () => {
    it('should generate a valid ULID', () => {
      const id = generateOrganizerId();
      expect(typeof id).toBe('string');
      expect(id).toHaveLength(26);
      expect(isValidOrganizerId(id)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const id1 = generateOrganizerId();
      const id2 = generateOrganizerId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('isValidOrganizerId', () => {
    it('should validate correct ULID format', () => {
      const validId = generateOrganizerId(); // Use a real generated ULID
      expect(isValidOrganizerId(validId)).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidOrganizerId('')).toBe(false);
      expect(isValidOrganizerId('invalid')).toBe(false);
      expect(isValidOrganizerId('01HKQM9X8Y7Z6W5V4U3T2S1R0')).toBe(false); // too short
      expect(isValidOrganizerId('01HKQM9X8Y7Z6W5V4U3T2S1R0QP')).toBe(false); // too long
    });
  });

  describe('isValidClerkId', () => {
    it('should validate non-empty strings', () => {
      expect(isValidClerkId('user_123')).toBe(true);
      expect(isValidClerkId('clerk-id-456')).toBe(true);
    });

    it('should reject empty or invalid values', () => {
      expect(isValidClerkId('')).toBe(false);
      expect(isValidClerkId('   ')).toBe(false);
    });
  });

  describe('sanitization functions', () => {
    describe('sanitizeOrganizerName', () => {
      it('should trim and normalize whitespace', () => {
        expect(sanitizeOrganizerName('  Test  Name  ')).toBe('Test Name');
        expect(sanitizeOrganizerName('Multiple   Spaces')).toBe('Multiple Spaces');
      });
    });

    describe('sanitizeOrganizerWebsite', () => {
      it('should add https protocol if missing', () => {
        expect(sanitizeOrganizerWebsite('example.com')).toBe('https://example.com');
        expect(sanitizeOrganizerWebsite('www.example.com')).toBe('https://www.example.com');
      });

      it('should preserve existing protocol', () => {
        expect(sanitizeOrganizerWebsite('http://example.com')).toBe('http://example.com');
        expect(sanitizeOrganizerWebsite('https://example.com')).toBe('https://example.com');
      });

      it('should handle empty values', () => {
        expect(sanitizeOrganizerWebsite('')).toBeUndefined();
        expect(sanitizeOrganizerWebsite('   ')).toBeUndefined();
        expect(sanitizeOrganizerWebsite(undefined)).toBeUndefined();
      });
    });
  });

  describe('sanitizeCreateOrganizerData', () => {
    it('should sanitize all fields', () => {
      const input: CreateOrganizerData = {
        name: '  Test  Organizer  ',
        contact: '  test@example.com  ',
        website: 'example.com',
        description: '  Test description  '
      };

      const result = sanitizeCreateOrganizerData(input);

      expect(result.name).toBe('Test Organizer');
      expect(result.contact).toBe('test@example.com');
      expect(result.website).toBe('https://example.com');
      expect(result.description).toBe('Test description');
    });
  });

  describe('isValidOrganizerItem', () => {
    const validOrganizer: OrganizerItem = {
      organizerId: generateOrganizerId(), // Use a real generated ULID
      clerkId: 'user_123',
      name: 'Test Organizer',
      contact: 'test@example.com',
      website: 'https://example.com',
      description: 'Test description',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    it('should validate complete organizer item', () => {
      expect(isValidOrganizerItem(validOrganizer)).toBe(true);
    });

    it('should validate organizer without optional fields', () => {
      const minimalOrganizer = {
        ...validOrganizer,
        website: undefined,
        description: undefined
      };
      expect(isValidOrganizerItem(minimalOrganizer)).toBe(true);
    });

    it('should reject invalid organizer items', () => {
      expect(isValidOrganizerItem(null)).toBe(false);
      expect(isValidOrganizerItem({})).toBe(false);
      expect(isValidOrganizerItem({ ...validOrganizer, organizerId: 'invalid-id' })).toBe(false);
      expect(isValidOrganizerItem({ ...validOrganizer, name: '' })).toBe(false);
    });
  });
});
