import { ClerkUser } from '../../../../shared/auth/clerk';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../../shared/errors';
import { generateULID } from '../../../../shared/utils/ulid';
import { EventEntity } from '../../models/event.model';
import { generateUniqueSlug } from '../../utils/slug.utils';
import { EventService } from '../event.service';
import { organizerService } from '../organizer.service';

// Mock dependencies
jest.mock('../../models/event.model');
jest.mock('../../utils/slug.utils');
jest.mock('../../../../shared/utils/ulid');
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
          id: 'test-event-id',
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

    it('should prevent slug modification', async () => {
      const updateData = { title: 'Updated Title', slug: 'new-slug' };

      await expect(
        eventService.updateEvent('test-event-id', updateData, mockUser)
      ).rejects.toThrow(BadRequestError);
      await expect(
        eventService.updateEvent('test-event-id', updateData, mockUser)
      ).rejects.toThrow('Event slug cannot be modified after creation');
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
});
