import { ClerkUser } from '@/shared/auth/clerk';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/shared/errors';
import { generateOrganizerId, isValidOrganizerId } from '@/shared/utils/ulid';
import { CreateOrganizerData, OrganizerItem } from '../../types/organizer.types';
import {
  isValidClerkId,
  isValidOrganizerItem,
  sanitizeCreateOrganizerData,
  sanitizeOrganizerName,
  sanitizeOrganizerWebsite,
  validateOrganizerForEventOperation,
  validateOrganizerIdFormat,
  validateOrganizerOwnership
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
        expect(sanitizeOrganizerWebsite('')).toBe(''); // Empty string should be preserved for clearing
        expect(sanitizeOrganizerWebsite('   ')).toBe(''); // Whitespace-only should become empty string
        expect(sanitizeOrganizerWebsite(undefined)).toBeUndefined(); // Undefined should remain undefined
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

  describe('validateOrganizerOwnership', () => {
    const validOrganizer: OrganizerItem = {
      organizerId: generateOrganizerId(),
      clerkId: 'user_123',
      name: 'Test Organizer',
      contact: 'test@example.com',
      website: 'https://example.com',
      description: 'Test description',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const ownerUser: ClerkUser = {
      id: 'user_123',
      role: 'organizer',
      email: 'owner@example.com'
    };

    const otherUser: ClerkUser = {
      id: 'user_456',
      role: 'organizer',
      email: 'other@example.com'
    };

    const adminUser: ClerkUser = {
      id: 'admin_789',
      role: 'admin',
      email: 'admin@example.com'
    };

    it('should allow owner to access their organizer', () => {
      expect(() => validateOrganizerOwnership(validOrganizer, ownerUser)).not.toThrow();
    });

    it('should allow admin to access any organizer', () => {
      expect(() => validateOrganizerOwnership(validOrganizer, adminUser)).not.toThrow();
    });

    it('should throw ForbiddenError for non-owner, non-admin user', () => {
      expect(() => validateOrganizerOwnership(validOrganizer, otherUser)).toThrow(ForbiddenError);
      expect(() => validateOrganizerOwnership(validOrganizer, otherUser)).toThrow('You can only modify organizers you created');
    });

    it('should validate admin override logic', () => {
      // Admin should be able to access organizer they don't own
      const organizerOwnedByOther = {
        ...validOrganizer,
        clerkId: 'different_user'
      };

      expect(() => validateOrganizerOwnership(organizerOwnedByOther, adminUser)).not.toThrow();
    });
  });

  describe('validateOrganizerIdFormat', () => {
    it('should validate correct ULID format', () => {
      const validId = generateOrganizerId();
      expect(() => validateOrganizerIdFormat(validId)).not.toThrow();
    });

    it('should throw BadRequestError for empty or null values', () => {
      expect(() => validateOrganizerIdFormat('')).toThrow(BadRequestError);
      expect(() => validateOrganizerIdFormat('   ')).toThrow(BadRequestError);
      expect(() => validateOrganizerIdFormat('')).toThrow('Organizer ID is required');
    });

    it('should throw BadRequestError for invalid ULID format', () => {
      expect(() => validateOrganizerIdFormat('invalid-id')).toThrow(BadRequestError);
      expect(() => validateOrganizerIdFormat('01HKQM9X8Y7Z6W5V4U3T2S1R0')).toThrow(BadRequestError); // too short
      expect(() => validateOrganizerIdFormat('01HKQM9X8Y7Z6W5V4U3T2S1R0QP')).toThrow(BadRequestError); // too long
      expect(() => validateOrganizerIdFormat('invalid-id')).toThrow('Invalid organizer ID format');
    });
  });

  describe('validateOrganizerForEventOperation', () => {
    const validOrganizer: OrganizerItem = {
      organizerId: generateOrganizerId(),
      clerkId: 'user_123',
      name: 'Test Organizer',
      contact: 'test@example.com',
      website: 'https://example.com',
      description: 'Test description',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const ownerUser: ClerkUser = {
      id: 'user_123',
      role: 'organizer',
      email: 'owner@example.com'
    };

    const adminUser: ClerkUser = {
      id: 'admin_789',
      role: 'admin',
      email: 'admin@example.com'
    };

    const mockOrganizerService = {
      validateOrganizerExists: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should validate organizer format and existence for owner', async () => {
      mockOrganizerService.validateOrganizerExists.mockResolvedValue(validOrganizer);

      const result = await validateOrganizerForEventOperation(
        validOrganizer.organizerId,
        ownerUser,
        mockOrganizerService
      );

      expect(result).toEqual(validOrganizer);
      expect(mockOrganizerService.validateOrganizerExists).toHaveBeenCalledWith(
        validOrganizer.organizerId,
        ownerUser
      );
    });

    it('should validate organizer format and existence for admin', async () => {
      mockOrganizerService.validateOrganizerExists.mockResolvedValue(validOrganizer);

      const result = await validateOrganizerForEventOperation(
        validOrganizer.organizerId,
        adminUser,
        mockOrganizerService
      );

      expect(result).toEqual(validOrganizer);
      expect(mockOrganizerService.validateOrganizerExists).toHaveBeenCalledWith(
        validOrganizer.organizerId,
        adminUser
      );
    });

    it('should throw BadRequestError for invalid organizer ID format', async () => {
      await expect(
        validateOrganizerForEventOperation('invalid-id', ownerUser, mockOrganizerService)
      ).rejects.toThrow(BadRequestError);

      expect(mockOrganizerService.validateOrganizerExists).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundError from organizer service', async () => {
      const notFoundError = new NotFoundError('Organizer not found');
      mockOrganizerService.validateOrganizerExists.mockRejectedValue(notFoundError);

      await expect(
        validateOrganizerForEventOperation(validOrganizer.organizerId, ownerUser, mockOrganizerService)
      ).rejects.toThrow(NotFoundError);

      expect(mockOrganizerService.validateOrganizerExists).toHaveBeenCalledWith(
        validOrganizer.organizerId,
        ownerUser
      );
    });

    it('should throw BadRequestError for empty organizer ID', async () => {
      await expect(
        validateOrganizerForEventOperation('', ownerUser, mockOrganizerService)
      ).rejects.toThrow(BadRequestError);
      await expect(
        validateOrganizerForEventOperation('', ownerUser, mockOrganizerService)
      ).rejects.toThrow('Organizer ID is required');

      expect(mockOrganizerService.validateOrganizerExists).not.toHaveBeenCalled();
    });
  });
});
