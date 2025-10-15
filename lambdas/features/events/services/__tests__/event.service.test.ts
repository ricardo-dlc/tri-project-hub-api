import { ClerkUser } from '@/shared/auth/clerk';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/shared/errors';
import { generateULID } from '@/shared/utils/ulid';
import { EventEntity } from '@/features/events/models/event.model';
import { generateUniqueSlug } from '../../utils/slug.utils';
import { EventService } from '../event.service';
import { organizerService } from '../organizer.service';

// Mock dependencies
jest.mock('@/features/events/models/event.model');
jest.mock('../../utils/slug.utils');
jest.mock('@/shared/utils/ulid');
jest.mock('../organizer.service');

const mockEventEntity = EventEntity as jest.Mocked<typeof EventEntity>;
const mockGenerateUniqueSlug = generateUniqueSlug as jest.MockedFunction<typeof generateUniqueSlug>;
const mockGenerateULID = generateULID as jest.MockedFunction<typeof generateULID>;
const mockOrganizerService = organizerService as jest.Mocked<typeof organizerService>;

describe('EventService', () => {
  let eventService: EventService;

  beforeEach(() => {
    eventService = new EventService();
    jest.clearAllMocks();
  });

  describe('createEvent', () => {
    const mockCreateEventData = {
      organizerId: 'test-organizer-id',
      title: 'Test Event',
      type: 'running',
      date: '2024-12-01T10:00:00Z',
      isTeamEvent: false,
      requiredParticipants: 1,
      maxParticipants: 100,
      location: 'Test Location',
      description: 'Test event description',
      distance: '5km',
      registrationFee: 25.00,
      registrationDeadline: '2024-11-25T23:59:59Z',
      image: 'https://example.com/image.jpg',
      difficulty: 'beginner',
      tags: ['running', 'fitness'],
    };

    const mockUser: ClerkUser = {
      id: 'test-creator-id',
      role: 'organizer',
      email: 'test@example.com',
    };

    const mockAdminUser: ClerkUser = {
      id: 'admin-user-id',
      role: 'admin',
      email: 'admin@example.com',
    };

    const mockCreatedEvent = {
      id: 'test-event-id',
      eventId: 'test-event-id',
      creatorId: 'test-creator-id',
      organizerId: 'test-organizer-id',
      title: 'Test Event',
      slug: 'test-event',
      type: 'running',
      date: '2024-12-01T10:00:00Z',
      isFeatured: false,
      isTeamEvent: false,
      requiredParticipants: 1,
      maxParticipants: 100,
      currentParticipants: 0,
      location: 'Test Location',
      description: 'Test event description',
      distance: '5km',
      registrationFee: 25.00,
      registrationDeadline: '2024-11-25T23:59:59Z',
      image: 'https://example.com/image.jpg',
      difficulty: 'beginner',
      tags: ['running', 'fitness'],
      isEnabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    beforeEach(() => {
      mockGenerateULID.mockReturnValue('test-event-id');
      mockGenerateUniqueSlug.mockResolvedValue('test-event');
      mockEventEntity.create = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: mockCreatedEvent }),
      } as any);

      // Mock organizer service methods
      mockOrganizerService.getOrganizer = jest.fn().mockResolvedValue({
        organizerId: 'test-organizer-id',
        clerkId: 'test-creator-id',
        name: 'Test Organizer',
        contact: 'test@example.com',
      });
      mockOrganizerService.getOrganizerByClerkId = jest.fn().mockResolvedValue({
        organizerId: 'test-organizer-id',
        clerkId: 'test-creator-id',
        name: 'Test Organizer',
        contact: 'test@example.com',
      });
      mockOrganizerService.validateOrganizerExists = jest.fn().mockResolvedValue({
        organizerId: 'test-organizer-id',
        clerkId: 'test-creator-id',
        name: 'Test Organizer',
        contact: 'test@example.com',
      });
    });

    it('should create event with generated slug', async () => {
      const result = await eventService.createEvent(mockCreateEventData, 'test-creator-id', mockUser);

      expect(mockOrganizerService.validateOrganizerExists).toHaveBeenCalledWith('test-organizer-id', mockUser);
      expect(mockGenerateUniqueSlug).toHaveBeenCalledWith('Test Event');
      expect(mockGenerateULID).toHaveBeenCalled();
      expect(mockEventEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'test-event-id',
          creatorId: 'test-creator-id',
          organizerId: 'test-organizer-id',
          title: 'Test Event',
          slug: 'test-event',
          isFeatured: false,
          currentParticipants: 0,
          isEnabled: true,
        })
      );
      expect(result).toEqual(mockCreatedEvent);
    });

    it('should always set isFeatured to false by default', async () => {
      const result = await eventService.createEvent(mockCreateEventData, 'test-creator-id', mockUser);

      expect(mockEventEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isFeatured: false,
        })
      );
      expect(result).toEqual(mockCreatedEvent);
    });

    it('should ignore isFeatured field in creation data and set to false', async () => {
      const dataWithFeatured = { ...mockCreateEventData, isFeatured: true };
      const result = await eventService.createEvent(dataWithFeatured, 'test-creator-id', mockUser);

      // Should ignore the isFeatured: true and set to false
      expect(mockEventEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isFeatured: false,
        })
      );
      expect(result).toEqual(mockCreatedEvent);
    });

    it('should ignore isFeatured field even for admin users during creation', async () => {
      const dataWithFeatured = { ...mockCreateEventData, isFeatured: true };
      const result = await eventService.createEvent(dataWithFeatured, 'admin-user-id', mockAdminUser);

      // Should ignore the isFeatured: true and set to false even for admins
      expect(mockEventEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isFeatured: false,
        })
      );
      expect(result).toEqual(mockCreatedEvent);
    });

    it('should set default values correctly', async () => {
      await eventService.createEvent(mockCreateEventData, 'test-creator-id', mockUser);

      expect(mockEventEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isFeatured: false,
          currentParticipants: 0,
          isEnabled: true,
          isRelay: undefined, // Should be undefined when not provided
        })
      );
    });

    it('should handle isRelay when provided', async () => {
      const dataWithRelay = { ...mockCreateEventData, isRelay: true };
      await eventService.createEvent(dataWithRelay, 'test-creator-id', mockUser);

      expect(mockEventEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isRelay: true,
        })
      );
    });

    it('should validate team event capacity during creation', async () => {
      const invalidTeamEventData = {
        ...mockCreateEventData,
        isTeamEvent: true,
        requiredParticipants: 3,
        maxParticipants: 10, // Not divisible by 3
      };

      await expect(
        eventService.createEvent(invalidTeamEventData, 'test-creator-id', mockUser)
      ).rejects.toThrow(BadRequestError);
      await expect(
        eventService.createEvent(invalidTeamEventData, 'test-creator-id', mockUser)
      ).rejects.toThrow('maxParticipants (10) must be a multiple of requiredParticipants (3)');
    });

    it('should allow valid team event capacity during creation', async () => {
      const validTeamEventData = {
        ...mockCreateEventData,
        isTeamEvent: true,
        requiredParticipants: 4,
        maxParticipants: 20, // Divisible by 4
      };

      const result = await eventService.createEvent(validTeamEventData, 'test-creator-id', mockUser);

      expect(mockEventEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isTeamEvent: true,
          requiredParticipants: 4,
          maxParticipants: 20,
        })
      );
      expect(result).toEqual(mockCreatedEvent);
    });

    describe('event-organizer relationship validation', () => {
      it('should validate organizer exists when organizerId is provided', async () => {
        const result = await eventService.createEvent(mockCreateEventData, 'test-creator-id', mockUser);

        expect(mockOrganizerService.validateOrganizerExists).toHaveBeenCalledWith('test-organizer-id', mockUser);
        expect(result).toEqual(mockCreatedEvent);
      });

      it('should allow admin to use any valid organizerId', async () => {
        const result = await eventService.createEvent(mockCreateEventData, 'admin-user-id', mockAdminUser);

        expect(mockOrganizerService.getOrganizer).toHaveBeenCalledWith('test-organizer-id');
        expect(result).toEqual(mockCreatedEvent);
      });

      it('should auto-inject organizerId when not provided', async () => {
        const dataWithoutOrganizer = { ...mockCreateEventData };
        delete (dataWithoutOrganizer as any).organizerId;

        const result = await eventService.createEvent(dataWithoutOrganizer, 'test-creator-id', mockUser);

        expect(mockOrganizerService.getOrganizerByClerkId).toHaveBeenCalledWith('test-creator-id');
        expect(mockEventEntity.create).toHaveBeenCalledWith(
          expect.objectContaining({
            organizerId: 'test-organizer-id',
          })
        );
        expect(result).toEqual(mockCreatedEvent);
      });

      it('should throw error when auto-injecting organizerId but user has no organizer profile', async () => {
        const dataWithoutOrganizer = { ...mockCreateEventData };
        delete (dataWithoutOrganizer as any).organizerId;

        mockOrganizerService.getOrganizerByClerkId = jest.fn().mockRejectedValue(
          new NotFoundError('Organizer not found')
        );

        await expect(
          eventService.createEvent(dataWithoutOrganizer, 'test-creator-id', mockUser)
        ).rejects.toThrow(BadRequestError);
        await expect(
          eventService.createEvent(dataWithoutOrganizer, 'test-creator-id', mockUser)
        ).rejects.toThrow('No organizer profile found for user');
      });

      it('should throw error when provided organizerId does not exist', async () => {
        mockOrganizerService.validateOrganizerExists = jest.fn().mockRejectedValue(
          new NotFoundError('Organizer not found')
        );

        await expect(
          eventService.createEvent(mockCreateEventData, 'test-creator-id', mockUser)
        ).rejects.toThrow(NotFoundError);
      });

      it('should throw error when user does not have access to provided organizerId', async () => {
        mockOrganizerService.validateOrganizerExists = jest.fn().mockRejectedValue(
          new NotFoundError('Organizer not found')
        );

        await expect(
          eventService.createEvent(mockCreateEventData, 'test-creator-id', mockUser)
        ).rejects.toThrow(NotFoundError);
      });
    });

    describe('team event capacity validation', () => {
      it('should validate team event capacity with various invalid combinations', async () => {
        const testCases = [
          { requiredParticipants: 3, maxParticipants: 10 }, // 10 % 3 !== 0
          { requiredParticipants: 4, maxParticipants: 15 }, // 15 % 4 !== 0
          { requiredParticipants: 5, maxParticipants: 23 }, // 23 % 5 !== 0
        ];

        for (const testCase of testCases) {
          const invalidTeamEventData = {
            ...mockCreateEventData,
            isTeamEvent: true,
            requiredParticipants: testCase.requiredParticipants,
            maxParticipants: testCase.maxParticipants,
          };

          await expect(
            eventService.createEvent(invalidTeamEventData, 'test-creator-id', mockUser)
          ).rejects.toThrow(BadRequestError);
          await expect(
            eventService.createEvent(invalidTeamEventData, 'test-creator-id', mockUser)
          ).rejects.toThrow(`maxParticipants (${testCase.maxParticipants}) must be a multiple of requiredParticipants (${testCase.requiredParticipants})`);
        }
      });

      it('should allow valid team event capacity combinations', async () => {
        const testCases = [
          { requiredParticipants: 2, maxParticipants: 20 }, // 20 % 2 === 0
          { requiredParticipants: 3, maxParticipants: 15 }, // 15 % 3 === 0
          { requiredParticipants: 4, maxParticipants: 16 }, // 16 % 4 === 0
          { requiredParticipants: 5, maxParticipants: 25 }, // 25 % 5 === 0
        ];

        for (const testCase of testCases) {
          const validTeamEventData = {
            ...mockCreateEventData,
            isTeamEvent: true,
            requiredParticipants: testCase.requiredParticipants,
            maxParticipants: testCase.maxParticipants,
          };

          const result = await eventService.createEvent(validTeamEventData, 'test-creator-id', mockUser);

          expect(mockEventEntity.create).toHaveBeenCalledWith(
            expect.objectContaining({
              isTeamEvent: true,
              requiredParticipants: testCase.requiredParticipants,
              maxParticipants: testCase.maxParticipants,
            })
          );
          expect(result).toEqual(mockCreatedEvent);
        }
      });

      it('should not validate team capacity for non-team events', async () => {
        const nonTeamEventData = {
          ...mockCreateEventData,
          isTeamEvent: false,
          requiredParticipants: 3,
          maxParticipants: 10, // Would be invalid for team event, but should be allowed for non-team
        };

        const result = await eventService.createEvent(nonTeamEventData, 'test-creator-id', mockUser);

        expect(mockEventEntity.create).toHaveBeenCalledWith(
          expect.objectContaining({
            isTeamEvent: false,
            requiredParticipants: 3,
            maxParticipants: 10,
          })
        );
        expect(result).toEqual(mockCreatedEvent);
      });
    });
  });

  describe('updateEvent', () => {
    const mockExistingEvent = {
      id: 'test-event-id',
      eventId: 'test-event-id',
      creatorId: 'test-creator-id',
      organizerId: 'test-organizer-id',
      title: 'Test Event',
      slug: 'test-event',
      type: 'running',
      date: '2024-12-01T10:00:00Z',
      isFeatured: false,
      isTeamEvent: false,
      requiredParticipants: 1,
      maxParticipants: 100,
      currentParticipants: 0,
      location: 'Test Location',
      description: 'Test event description',
      distance: '5km',
      registrationFee: 25.00,
      registrationDeadline: '2024-11-25T23:59:59Z',
      image: 'https://example.com/image.jpg',
      difficulty: 'beginner',
      tags: ['running', 'fitness'],
      isEnabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const mockUser: ClerkUser = {
      id: 'test-creator-id',
      role: 'organizer',
      email: 'test@example.com',
    };

    const mockAdminUser: ClerkUser = {
      id: 'admin-user-id',
      role: 'admin',
      email: 'admin@example.com',
    };

    const mockDifferentUser: ClerkUser = {
      id: 'different-user-id',
      role: 'organizer',
      email: 'different@example.com',
    };

    beforeEach(() => {
      mockEventEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: mockExistingEvent }),
      } as any);
      mockEventEntity.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: mockExistingEvent }),
        }),
      } as any);
    });

    it('should silently ignore slug modification', async () => {
      const updateData = { title: 'Updated Title', slug: 'new-slug' };

      const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

      // Should succeed and only update the title, ignoring the slug
      expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
      expect(result).toEqual(mockExistingEvent);
    });

    it('should silently ignore isFeatured field for non-admin users', async () => {
      const updateData = { title: 'Updated Title', isFeatured: true };

      const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

      // Should succeed and remove isFeatured from the update payload
      expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
      expect(result).toEqual(mockExistingEvent);
    });

    it('should allow admin to modify isFeatured', async () => {
      const updateData = { title: 'Updated Title', isFeatured: true };

      const result = await eventService.updateEvent('test-event-id', updateData, mockAdminUser);

      expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
      expect(result).toEqual(mockExistingEvent);
    });

    it('should validate ownership for non-admin users', async () => {
      const updateData = { title: 'Updated Title' };

      await expect(
        eventService.updateEvent('test-event-id', updateData, mockDifferentUser)
      ).rejects.toThrow(ForbiddenError);
      await expect(
        eventService.updateEvent('test-event-id', updateData, mockDifferentUser)
      ).rejects.toThrow('You can only update events you created');
    });

    it('should allow admin to update any event', async () => {
      const updateData = { title: 'Updated Title', description: 'Updated description' };

      const result = await eventService.updateEvent('test-event-id', updateData, mockAdminUser);

      expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
      expect(result).toEqual(mockExistingEvent);
    });

    it('should update event successfully when valid', async () => {
      const updateData = { title: 'Updated Title', description: 'Updated description' };

      const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

      expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
      expect(result).toEqual(mockExistingEvent);
    });

    it('should validate team event capacity during updates', async () => {
      const updateData = { maxParticipants: 15 }; // Not divisible by existing requiredParticipants (1)
      const teamEvent = { ...mockExistingEvent, isTeamEvent: true, requiredParticipants: 4 };

      mockEventEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: teamEvent }),
      } as any);

      await expect(
        eventService.updateEvent('test-event-id', updateData, mockUser)
      ).rejects.toThrow(BadRequestError);
      await expect(
        eventService.updateEvent('test-event-id', updateData, mockUser)
      ).rejects.toThrow('maxParticipants (15) must be a multiple of requiredParticipants (4)');
    });

    it('should allow valid team event capacity updates', async () => {
      const updateData = { maxParticipants: 16 }; // Divisible by 4
      const teamEvent = { ...mockExistingEvent, isTeamEvent: true, requiredParticipants: 4 };

      mockEventEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: teamEvent }),
      } as any);

      const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

      expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
      expect(result).toEqual(mockExistingEvent);
    });

    it('should silently ignore isTeamEvent field in updates (immutable)', async () => {
      const updateData = {
        title: 'Updated Title',
        isTeamEvent: true // This should be ignored
      };

      const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

      // Should succeed and remove isTeamEvent from the update payload
      expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
      expect(result).toEqual(mockExistingEvent);
    });

    it('should validate team capacity using existing isTeamEvent value only', async () => {
      const updateData = {
        maxParticipants: 15, // Not divisible by 4
        isTeamEvent: false // This should be ignored, existing value (true) should be used
      };
      const teamEvent = { ...mockExistingEvent, isTeamEvent: true, requiredParticipants: 4 };

      mockEventEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: teamEvent }),
      } as any);

      // Should still validate as team event despite isTeamEvent: false in payload
      await expect(
        eventService.updateEvent('test-event-id', updateData, mockUser)
      ).rejects.toThrow(BadRequestError);
      await expect(
        eventService.updateEvent('test-event-id', updateData, mockUser)
      ).rejects.toThrow('maxParticipants (15) must be a multiple of requiredParticipants (4)');
    });

    it('should prevent reducing maxParticipants below current registrations', async () => {
      const updateData = { maxParticipants: 50 }; // Lower than current 75
      const eventWithRegistrations = {
        ...mockExistingEvent,
        currentParticipants: 75,
        maxParticipants: 100
      };

      mockEventEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: eventWithRegistrations }),
      } as any);

      await expect(
        eventService.updateEvent('test-event-id', updateData, mockUser)
      ).rejects.toThrow(BadRequestError);
      await expect(
        eventService.updateEvent('test-event-id', updateData, mockUser)
      ).rejects.toThrow('Cannot reduce maxParticipants (50) below current registrations (75)');
    });

    it('should allow increasing maxParticipants above current registrations', async () => {
      const updateData = { maxParticipants: 150 }; // Higher than current 75
      const eventWithRegistrations = {
        ...mockExistingEvent,
        currentParticipants: 75,
        maxParticipants: 100
      };

      mockEventEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: eventWithRegistrations }),
      } as any);

      const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

      expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
      expect(result).toEqual(mockExistingEvent);
    });

    it('should allow setting maxParticipants equal to current registrations', async () => {
      const updateData = { maxParticipants: 75 }; // Equal to current registrations
      const eventWithRegistrations = {
        ...mockExistingEvent,
        currentParticipants: 75,
        maxParticipants: 100
      };

      mockEventEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: eventWithRegistrations }),
      } as any);

      const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

      expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
      expect(result).toEqual(mockExistingEvent);
    });

    describe('ownership validation with new model structure', () => {
      it('should validate event ownership for regular users', async () => {
        const updateData = { title: 'Updated Title' };

        const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

        expect(mockEventEntity.get).toHaveBeenCalledWith({ eventId: 'test-event-id' });
        expect(result).toEqual(mockExistingEvent);
      });

      it('should reject updates from non-owner users', async () => {
        const updateData = { title: 'Updated Title' };

        await expect(
          eventService.updateEvent('test-event-id', updateData, mockDifferentUser)
        ).rejects.toThrow(ForbiddenError);
        await expect(
          eventService.updateEvent('test-event-id', updateData, mockDifferentUser)
        ).rejects.toThrow('You can only update events you created');
      });

      it('should allow admin to update any event regardless of ownership', async () => {
        const updateData = { title: 'Admin Updated Title', description: 'Admin updated description' };

        const result = await eventService.updateEvent('test-event-id', updateData, mockAdminUser);

        expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
        expect(result).toEqual(mockExistingEvent);
      });

      it('should validate ownership using creatorId field from event model', async () => {
        const eventWithDifferentCreator = {
          ...mockExistingEvent,
          creatorId: 'different-creator-id',
        };

        mockEventEntity.get = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: eventWithDifferentCreator }),
        } as any);

        const updateData = { title: 'Updated Title' };

        await expect(
          eventService.updateEvent('test-event-id', updateData, mockUser)
        ).rejects.toThrow(ForbiddenError);
        await expect(
          eventService.updateEvent('test-event-id', updateData, mockUser)
        ).rejects.toThrow('You can only update events you created');
      });

      it('should handle admin role validation correctly', async () => {
        const eventWithDifferentCreator = {
          ...mockExistingEvent,
          creatorId: 'different-creator-id',
        };

        mockEventEntity.get = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: eventWithDifferentCreator }),
        } as any);

        const updateData = { title: 'Admin Updated Title', isFeatured: true };

        // Admin should be able to update any event
        const result = await eventService.updateEvent('test-event-id', updateData, mockAdminUser);

        expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
        expect(result).toEqual(mockExistingEvent);
      });
    });

    describe('team event capacity validation in updates', () => {
      it('should validate team event capacity when updating maxParticipants', async () => {
        const teamEvent = {
          ...mockExistingEvent,
          isTeamEvent: true,
          requiredParticipants: 4,
          maxParticipants: 20
        };

        mockEventEntity.get = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: teamEvent }),
        } as any);

        const invalidUpdateData = { maxParticipants: 15 }; // Not divisible by 4

        await expect(
          eventService.updateEvent('test-event-id', invalidUpdateData, mockUser)
        ).rejects.toThrow(BadRequestError);
        await expect(
          eventService.updateEvent('test-event-id', invalidUpdateData, mockUser)
        ).rejects.toThrow('maxParticipants (15) must be a multiple of requiredParticipants (4)');
      });

      it('should validate team event capacity when updating requiredParticipants', async () => {
        const teamEvent = {
          ...mockExistingEvent,
          isTeamEvent: true,
          requiredParticipants: 4,
          maxParticipants: 20
        };

        mockEventEntity.get = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: teamEvent }),
        } as any);

        const invalidUpdateData = { requiredParticipants: 3 }; // 20 not divisible by 3

        await expect(
          eventService.updateEvent('test-event-id', invalidUpdateData, mockUser)
        ).rejects.toThrow(BadRequestError);
        await expect(
          eventService.updateEvent('test-event-id', invalidUpdateData, mockUser)
        ).rejects.toThrow('maxParticipants (20) must be a multiple of requiredParticipants (3)');
      });

      it('should validate team event capacity when updating both maxParticipants and requiredParticipants', async () => {
        const teamEvent = {
          ...mockExistingEvent,
          isTeamEvent: true,
          requiredParticipants: 4,
          maxParticipants: 20
        };

        mockEventEntity.get = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: teamEvent }),
        } as any);

        const invalidUpdateData = {
          maxParticipants: 25,
          requiredParticipants: 4
        }; // 25 not divisible by 4

        await expect(
          eventService.updateEvent('test-event-id', invalidUpdateData, mockUser)
        ).rejects.toThrow(BadRequestError);
        await expect(
          eventService.updateEvent('test-event-id', invalidUpdateData, mockUser)
        ).rejects.toThrow('maxParticipants (25) must be a multiple of requiredParticipants (4)');
      });

      it('should allow valid team event capacity updates', async () => {
        const teamEvent = {
          ...mockExistingEvent,
          isTeamEvent: true,
          requiredParticipants: 4,
          maxParticipants: 20
        };

        mockEventEntity.get = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: teamEvent }),
        } as any);

        const validUpdateData = { maxParticipants: 24 }; // Divisible by 4

        const result = await eventService.updateEvent('test-event-id', validUpdateData, mockUser);

        expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
        expect(result).toEqual(mockExistingEvent);
      });

      it('should not validate team capacity for non-team events during updates', async () => {
        const nonTeamEvent = {
          ...mockExistingEvent,
          isTeamEvent: false,
          requiredParticipants: 1,
          maxParticipants: 100
        };

        mockEventEntity.get = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: nonTeamEvent }),
        } as any);

        const updateData = {
          maxParticipants: 15,
          requiredParticipants: 4
        }; // Would be invalid for team event

        const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

        expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
        expect(result).toEqual(mockExistingEvent);
      });

      it('should use existing isTeamEvent value even when isTeamEvent is provided in update data', async () => {
        const teamEvent = {
          ...mockExistingEvent,
          isTeamEvent: true,
          requiredParticipants: 4,
          maxParticipants: 20
        };

        mockEventEntity.get = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: teamEvent }),
        } as any);

        const updateData = {
          maxParticipants: 15, // Not divisible by 4
          isTeamEvent: false // This should be ignored
        };

        // Should still validate as team event despite isTeamEvent: false in payload
        await expect(
          eventService.updateEvent('test-event-id', updateData, mockUser)
        ).rejects.toThrow(BadRequestError);
        await expect(
          eventService.updateEvent('test-event-id', updateData, mockUser)
        ).rejects.toThrow('maxParticipants (15) must be a multiple of requiredParticipants (4)');
      });
    });

    describe('silently ignored immutable fields', () => {
      it('should silently ignore system-managed immutable fields', async () => {
        const updateData = {
          title: 'Updated Title',
          eventId: 'different-event-id', // Should be ignored
          creatorId: 'different-creator-id', // Should be ignored
          createdAt: '2023-01-01T00:00:00Z', // Should be ignored
          currentParticipants: 999, // Should be ignored
        };

        const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

        // Should succeed and only update the title
        expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
        expect(result).toEqual(mockExistingEvent);
      });

      it('should silently ignore multiple immutable fields together', async () => {
        const updateData = {
          title: 'Updated Title',
          description: 'Updated description',
          eventId: 'hack-attempt-1',
          creatorId: 'hack-attempt-2',
          organizerId: 'different-organizer-id', // Should be ignored
          createdAt: '1970-01-01T00:00:00Z',
          currentParticipants: -1,
          isTeamEvent: true, // Also silently ignored
          slug: 'new-slug', // Also silently ignored
        };

        const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

        // Should succeed and only update title and description
        expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
        expect(result).toEqual(mockExistingEvent);
      });

      it('should silently ignore organizerId modification to maintain organizer relationship', async () => {
        const updateData = {
          title: 'Updated Title',
          organizerId: 'different-organizer-id', // Should be silently ignored
        };

        const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

        // Should succeed and only update the title, organizerId should be ignored
        expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
        expect(result).toEqual(mockExistingEvent);
      });

      it('should log when silently ignored fields are removed', async () => {
        const updateData = {
          title: 'Updated Title',
          eventId: 'should-be-ignored',
          currentParticipants: 123,
        };

        const result = await eventService.updateEvent('test-event-id', updateData, mockUser);

        // Should succeed
        expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: 'test-event-id' });
        expect(result).toEqual(mockExistingEvent);
      });
    });
  });

  describe('getEventBySlug', () => {
    const mockEvent = {
      id: 'test-event-id',
      eventId: 'test-event-id',
      slug: 'test-event',
      title: 'Test Event',
    };

    it('should get event by slug successfully', async () => {
      mockEventEntity.query = {
        SlugIndex: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: [mockEvent] }),
        }),
      } as any;

      const result = await eventService.getEventBySlug('test-event');

      expect(mockEventEntity.query.SlugIndex).toHaveBeenCalledWith({ slug: 'test-event' });
      expect(result).toEqual(mockEvent);
    });

    it('should throw NotFoundError when event not found', async () => {
      mockEventEntity.query = {
        SlugIndex: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: [] }),
        }),
      } as any;

      await expect(eventService.getEventBySlug('non-existent-slug')).rejects.toThrow(NotFoundError);
      await expect(eventService.getEventBySlug('non-existent-slug')).rejects.toThrow('Event not found');
    });
  });

  describe('listEventsByCreator', () => {
    const mockEvents = [
      { eventId: 'event-1', title: 'Event 1', creatorId: 'creator-1' },
      { eventId: 'event-2', title: 'Event 2', creatorId: 'creator-1' },
    ];

    it('should list events by creator successfully', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({
          data: mockEvents,
          cursor: null,
        }),
      };

      mockEventEntity.query = {
        CreatorIndex: jest.fn().mockReturnValue(mockQuery),
      } as any;

      const result = await eventService.listEventsByCreator('creator-1');

      expect(mockEventEntity.query.CreatorIndex).toHaveBeenCalledWith({ creatorId: 'creator-1' });
      expect(mockQuery.where).toHaveBeenCalled();
      expect(result.data).toEqual(mockEvents);
    });

    it('should handle pagination options', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({
          data: mockEvents,
          cursor: 'next-cursor',
        }),
      };

      mockEventEntity.query = {
        CreatorIndex: jest.fn().mockReturnValue(mockQuery),
      } as any;

      const paginationOptions = {
        limit: 10,
        nextToken: 'some-token',
        defaultLimit: 15,
      };

      await eventService.listEventsByCreator('creator-1', paginationOptions);

      expect(mockQuery.go).toHaveBeenCalledWith({
        limit: 11, // +1 for pagination check
        cursor: 'some-token',
      });
    });
  });

  describe('listEventsByOrganizer', () => {
    const mockEvents = [
      { eventId: 'event-1', title: 'Event 1', organizerId: 'organizer-1' },
      { eventId: 'event-2', title: 'Event 2', organizerId: 'organizer-1' },
    ];

    it('should list events by organizer successfully', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({
          data: mockEvents,
          cursor: null,
        }),
      };

      mockEventEntity.query = {
        OrganizerIndex: jest.fn().mockReturnValue(mockQuery),
      } as any;

      const result = await eventService.listEventsByOrganizer('organizer-1');

      expect(mockEventEntity.query.OrganizerIndex).toHaveBeenCalledWith({ organizerId: 'organizer-1' });
      expect(mockQuery.where).toHaveBeenCalled();
      expect(result.data).toEqual(mockEvents);
    });

    it('should handle pagination options', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({
          data: mockEvents,
          cursor: 'next-cursor',
        }),
      };

      mockEventEntity.query = {
        OrganizerIndex: jest.fn().mockReturnValue(mockQuery),
      } as any;

      const paginationOptions = {
        limit: 5,
        nextToken: 'organizer-token',
        defaultLimit: 25,
      };

      await eventService.listEventsByOrganizer('organizer-1', paginationOptions);

      expect(mockQuery.go).toHaveBeenCalledWith({
        limit: 6, // +1 for pagination check
        cursor: 'organizer-token',
      });
    });
  });
});
