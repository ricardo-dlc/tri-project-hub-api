import { ClerkUser } from '../../../../shared/auth/clerk';
import { BadRequestError, ForbiddenError } from '../../../../shared/errors';
import { EventItem } from '../../types/event.types';
import {
  validateAndSanitizeAdminOnlyFields,
  validateEventIdFormat,
  validateEventOwnership,
  validateImmutableFields,
  validateMaxParticipantsReduction,
  validateTeamEventCapacity
} from '../event.utils';

// Mock logger to avoid console output during tests
jest.mock('../../../../shared/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Event Validation Utilities', () => {
  const mockEvent: EventItem = {
    eventId: '01HKQJZX8RNPQ2K3M4N5P6Q7R8',
    creatorId: 'user_123',
    organizerId: '01HKQJZX8RNPQ2K3M4N5P6Q7R9',
    title: 'Test Event',
    slug: 'test-event',
    type: 'running',
    date: '2024-12-01',
    isFeatured: false,
    isTeamEvent: false,
    requiredParticipants: 1,
    maxParticipants: 50,
    currentParticipants: 10,
    location: 'Test Location',
    description: 'Test Description',
    distance: '5K',
    registrationFee: 25,
    registrationDeadline: '2024-11-25',
    image: 'test-image.jpg',
    difficulty: 'beginner',
    tags: ['running', 'fitness'],
    isEnabled: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockAdminUser: ClerkUser = {
    id: 'admin_123',
    role: 'admin',
    email: 'admin@test.com',
  };

  const mockRegularUser: ClerkUser = {
    id: 'user_123',
    role: 'organizer',
    email: 'user@test.com',
  };

  const mockOtherUser: ClerkUser = {
    id: 'other_user_123',
    role: 'organizer',
    email: 'other@test.com',
  };

  describe('validateEventOwnership', () => {
    it('should allow admin users to access any event', () => {
      expect(() => {
        validateEventOwnership(mockEvent, mockAdminUser);
      }).not.toThrow();
    });

    it('should allow event creator to access their own event', () => {
      expect(() => {
        validateEventOwnership(mockEvent, mockRegularUser);
      }).not.toThrow();
    });

    it('should throw ForbiddenError when non-admin user tries to access event they did not create', () => {
      expect(() => {
        validateEventOwnership(mockEvent, mockOtherUser);
      }).toThrow(ForbiddenError);

      expect(() => {
        validateEventOwnership(mockEvent, mockOtherUser);
      }).toThrow('You can only update events you created');
    });
  });

  describe('validateEventIdFormat', () => {
    it('should accept valid ULID format', () => {
      expect(() => {
        validateEventIdFormat('01HKQJZX8RNPQ2K3M4N5P6Q7R8');
      }).not.toThrow();
    });

    it('should throw BadRequestError for empty event ID', () => {
      expect(() => {
        validateEventIdFormat('');
      }).toThrow(BadRequestError);

      expect(() => {
        validateEventIdFormat('');
      }).toThrow('Event ID is required');
    });

    it('should throw BadRequestError for null/undefined event ID', () => {
      expect(() => {
        validateEventIdFormat(null as any);
      }).toThrow(BadRequestError);

      expect(() => {
        validateEventIdFormat(undefined as any);
      }).toThrow(BadRequestError);
    });

    it('should throw BadRequestError for invalid ULID format', () => {
      expect(() => {
        validateEventIdFormat('invalid-id');
      }).toThrow(BadRequestError);

      expect(() => {
        validateEventIdFormat('invalid-id');
      }).toThrow('Invalid event ID format - must be a valid ULID');
    });
  });

  describe('validateTeamEventCapacity', () => {
    it('should pass validation for non-team events', () => {
      expect(() => {
        validateTeamEventCapacity(false, 50, 3);
      }).not.toThrow();
    });

    it('should pass validation when maxParticipants is multiple of requiredParticipants', () => {
      expect(() => {
        validateTeamEventCapacity(true, 30, 3); // 30 / 3 = 10 teams
      }).not.toThrow();

      expect(() => {
        validateTeamEventCapacity(true, 20, 4); // 20 / 4 = 5 teams
      }).not.toThrow();
    });

    it('should throw BadRequestError when maxParticipants is not multiple of requiredParticipants', () => {
      expect(() => {
        validateTeamEventCapacity(true, 25, 3); // 25 / 3 = 8.33 teams
      }).toThrow(BadRequestError);

      const error = () => validateTeamEventCapacity(true, 25, 3);
      expect(error).toThrow('For team events, maxParticipants (25) must be a multiple of requiredParticipants (3)');
    });

    it('should provide suggested values in error message', () => {
      try {
        validateTeamEventCapacity(true, 25, 3);
      } catch (error: any) {
        expect(error.details.suggestedValues).toEqual([24, 27]);
        expect(error.details.availableTeamSlots).toBe(8);
      }
    });
  });

  describe('validateMaxParticipantsReduction', () => {
    it('should allow increasing maxParticipants', () => {
      expect(() => {
        validateMaxParticipantsReduction(100, 50);
      }).not.toThrow();
    });

    it('should allow keeping maxParticipants the same', () => {
      expect(() => {
        validateMaxParticipantsReduction(50, 50);
      }).not.toThrow();
    });

    it('should throw BadRequestError when reducing maxParticipants below current registrations', () => {
      expect(() => {
        validateMaxParticipantsReduction(30, 50);
      }).toThrow(BadRequestError);

      expect(() => {
        validateMaxParticipantsReduction(30, 50);
      }).toThrow('Cannot reduce maxParticipants (30) below current registrations (50)');
    });

    it('should provide detailed error information', () => {
      try {
        validateMaxParticipantsReduction(30, 50);
      } catch (error: any) {
        expect(error.details.requestedMaxParticipants).toBe(30);
        expect(error.details.currentParticipants).toBe(50);
        expect(error.details.minimumAllowed).toBe(50);
      }
    });
  });

  describe('validateImmutableFields', () => {
    it('should pass when no immutable fields are in update data', () => {
      const updateData = { title: 'New Title', description: 'New Description' };
      const immutableFields = ['slug', 'eventId', 'creatorId'];

      expect(() => {
        validateImmutableFields(updateData, immutableFields);
      }).not.toThrow();
    });

    it('should throw BadRequestError when immutable fields are present', () => {
      const updateData = { title: 'New Title', slug: 'new-slug', eventId: 'new-id' };
      const immutableFields = ['slug', 'eventId', 'creatorId'];

      expect(() => {
        validateImmutableFields(updateData, immutableFields);
      }).toThrow(BadRequestError);

      expect(() => {
        validateImmutableFields(updateData, immutableFields);
      }).toThrow('The following fields cannot be modified after creation: slug, eventId');
    });

    it('should provide list of attempted immutable fields in error details', () => {
      const updateData = { slug: 'new-slug', creatorId: 'new-creator' };
      const immutableFields = ['slug', 'eventId', 'creatorId'];

      try {
        validateImmutableFields(updateData, immutableFields);
      } catch (error: any) {
        expect(error.details.attemptedFields).toEqual(['slug', 'creatorId']);
      }
    });
  });

  describe('validateAndSanitizeAdminOnlyFields', () => {
    it('should allow admin users to update admin-only fields', () => {
      const updateData = { title: 'New Title', isFeatured: true };
      const adminOnlyFields = ['isFeatured'];

      const result = validateAndSanitizeAdminOnlyFields(updateData, mockAdminUser, adminOnlyFields);

      expect(result).toEqual({ title: 'New Title', isFeatured: true });
    });

    it('should remove admin-only fields for non-admin users', () => {
      const updateData = { title: 'New Title', isFeatured: true };
      const adminOnlyFields = ['isFeatured'];

      const result = validateAndSanitizeAdminOnlyFields(updateData, mockRegularUser, adminOnlyFields);

      expect(result).toEqual({ title: 'New Title' });
      expect(result.isFeatured).toBeUndefined();
    });

    it('should handle multiple admin-only fields', () => {
      const updateData = {
        title: 'New Title',
        isFeatured: true,
        isEnabled: false,
        description: 'New Description'
      };
      const adminOnlyFields = ['isFeatured', 'isEnabled'];

      const result = validateAndSanitizeAdminOnlyFields(updateData, mockRegularUser, adminOnlyFields);

      expect(result).toEqual({
        title: 'New Title',
        description: 'New Description'
      });
      expect(result.isFeatured).toBeUndefined();
      expect(result.isEnabled).toBeUndefined();
    });

    it('should not modify original update data object', () => {
      const updateData = { title: 'New Title', isFeatured: true };
      const adminOnlyFields = ['isFeatured'];

      const result = validateAndSanitizeAdminOnlyFields(updateData, mockRegularUser, adminOnlyFields);

      // Original object should remain unchanged
      expect(updateData.isFeatured).toBe(true);
      // Result should be sanitized
      expect(result.isFeatured).toBeUndefined();
    });

    it('should handle empty admin-only fields array', () => {
      const updateData = { title: 'New Title', isFeatured: true };
      const adminOnlyFields: string[] = [];

      const result = validateAndSanitizeAdminOnlyFields(updateData, mockRegularUser, adminOnlyFields);

      expect(result).toEqual(updateData);
    });
  });
});