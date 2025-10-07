import { ClerkUser } from '../../../../shared/auth/clerk';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../shared/errors';
import { generateOrganizerId } from '../../../../shared/utils/ulid';
import { EventEntity } from '../../models/event.model';
import { OrganizerEntity } from '../../models/organizer.model';
import { CreateOrganizerData, OrganizerItem, UpdateOrganizerData } from '../../types/organizer.types';
import { OrganizerService } from '../organizer.service';

// Mock all dependencies
jest.mock('../../models/organizer.model');
jest.mock('../../models/event.model');
jest.mock('../../../../shared/utils/ulid');

describe('OrganizerService', () => {
  let service: OrganizerService;
  let mockOrganizerEntity: jest.Mocked<typeof OrganizerEntity>;
  let mockEventEntity: jest.Mocked<typeof EventEntity>;
  let mockGenerateOrganizerId: jest.MockedFunction<typeof generateOrganizerId>;

  const validOrganizerId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  const validClerkId = 'user_2NiWoBO5HDIKVXegEXPqNkqZwHu';
  const mockTimestamp = '2024-01-01T00:00:00.000Z';

  const mockUser: ClerkUser = {
    id: validClerkId,
    role: 'organizer',
    email: 'test@example.com',
  };

  const mockAdminUser: ClerkUser = {
    id: 'admin_user_id',
    role: 'admin',
    email: 'admin@example.com',
  };

  const validCreateData: CreateOrganizerData = {
    name: 'Test Organizer',
    contact: 'test@example.com',
    website: 'https://example.com',
    description: 'Test description',
  };

  const mockOrganizerItem: OrganizerItem = {
    organizerId: validOrganizerId,
    clerkId: validClerkId,
    name: 'Test Organizer',
    contact: 'test@example.com',
    website: 'https://example.com',
    description: 'Test description',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  beforeEach(() => {
    service = new OrganizerService();
    mockOrganizerEntity = OrganizerEntity as jest.Mocked<typeof OrganizerEntity>;
    mockEventEntity = EventEntity as jest.Mocked<typeof EventEntity>;
    mockGenerateOrganizerId = generateOrganizerId as jest.MockedFunction<typeof generateOrganizerId>;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockGenerateOrganizerId.mockReturnValue(validOrganizerId);
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockTimestamp);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createOrganizer', () => {
    it('should create a new organizer successfully', async () => {
      // Mock that organizer doesn't exist
      mockOrganizerEntity.query = {
        CreatorIndex: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: [] }),
        }),
      } as any;

      // Mock successful creation
      mockOrganizerEntity.create = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: {
            organizerId: validOrganizerId,
            clerkId: validClerkId,
            name: 'Test Organizer',
            contact: 'test@example.com',
            website: 'https://example.com',
            description: 'Test description',
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        }),
      });

      const result = await service.createOrganizer(validCreateData, mockUser);

      expect(result).toEqual(mockOrganizerItem);
      expect(mockOrganizerEntity.create).toHaveBeenCalledWith({
        organizerId: validOrganizerId,
        clerkId: validClerkId,
        name: 'Test Organizer',
        contact: 'test@example.com',
        website: 'https://example.com',
        description: 'Test description',
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      });
    });

    it('should return existing organizer if one already exists for the Clerk ID', async () => {
      // Mock that organizer already exists
      mockOrganizerEntity.query = {
        CreatorIndex: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: [mockOrganizerItem],
          }),
        }),
      } as any;

      const result = await service.createOrganizer(validCreateData, mockUser);

      expect(result).toEqual(mockOrganizerItem);
      expect(mockOrganizerEntity.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid data', async () => {
      const invalidData: CreateOrganizerData = {
        name: '', // Invalid empty name
        contact: 'test@example.com',
      };

      await expect(service.createOrganizer(invalidData, mockUser)).rejects.toThrow(ValidationError);
    });

    it('should throw BadRequestError for invalid Clerk ID', async () => {
      const userWithInvalidClerkId: ClerkUser = {
        id: '', // Invalid empty Clerk ID
        role: 'organizer',
        email: 'test@example.com',
      };

      await expect(service.createOrganizer(validCreateData, userWithInvalidClerkId)).rejects.toThrow(BadRequestError);
    });
  });

  describe('getOrganizer', () => {
    it('should return organizer by ID successfully', async () => {
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockOrganizerItem,
        }),
      });

      const result = await service.getOrganizer(validOrganizerId);

      expect(result).toEqual(mockOrganizerItem);
      expect(mockOrganizerEntity.get).toHaveBeenCalledWith({ organizerId: validOrganizerId });
    });

    it('should throw NotFoundError if organizer does not exist', async () => {
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: null }),
      });

      await expect(service.getOrganizer(validOrganizerId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getOrganizerByClerkId', () => {
    it('should return organizer by Clerk ID successfully', async () => {
      mockOrganizerEntity.query = {
        CreatorIndex: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: [mockOrganizerItem],
          }),
        }),
      } as any;

      const result = await service.getOrganizerByClerkId(validClerkId);

      expect(result).toEqual(mockOrganizerItem);
    });

    it('should throw NotFoundError if organizer does not exist', async () => {
      mockOrganizerEntity.query = {
        CreatorIndex: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: [] }),
        }),
      } as any;

      await expect(service.getOrganizerByClerkId(validClerkId)).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError for invalid Clerk ID', async () => {
      await expect(service.getOrganizerByClerkId('')).rejects.toThrow(BadRequestError);
    });
  });

  describe('updateOrganizer', () => {
    const updateData: UpdateOrganizerData = {
      name: 'Updated Organizer',
      contact: 'updated@example.com',
    };

    it('should update organizer successfully', async () => {
      // Mock get organizer
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockOrganizerItem,
        }),
      });

      // Mock update
      mockOrganizerEntity.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: {
              ...mockOrganizerItem,
              name: 'Updated Organizer',
              contact: 'updated@example.com',
              updatedAt: mockTimestamp,
            },
          }),
        }),
      });

      const result = await service.updateOrganizer(validOrganizerId, updateData, mockUser);

      expect(result.name).toBe('Updated Organizer');
      expect(result.contact).toBe('updated@example.com');
    });

    it('should throw ForbiddenError if user does not own the organizer', async () => {
      const otherUser: ClerkUser = {
        id: 'other_user_id',
        role: 'organizer',
        email: 'other@example.com',
      };

      // Mock get organizer
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockOrganizerItem,
        }),
      });

      await expect(service.updateOrganizer(validOrganizerId, updateData, otherUser)).rejects.toThrow(ForbiddenError);
    });

    it('should allow admin to update any organizer', async () => {
      // Mock get organizer
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockOrganizerItem,
        }),
      });

      // Mock update
      mockOrganizerEntity.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: {
              ...mockOrganizerItem,
              name: 'Updated Organizer',
              updatedAt: mockTimestamp,
            },
          }),
        }),
      });

      const result = await service.updateOrganizer(validOrganizerId, updateData, mockAdminUser);

      expect(result.name).toBe('Updated Organizer');
    });
  });

  describe('deleteOrganizer', () => {
    it('should delete organizer successfully', async () => {
      // Mock get organizer
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockOrganizerItem,
        }),
      });

      // Mock event query to return no events
      mockEventEntity.query = {
        OrganizerIndex: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: [],
          }),
        }),
      } as any;

      // Mock delete
      mockOrganizerEntity.delete = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({}),
      });

      await expect(service.deleteOrganizer(validOrganizerId, mockUser)).resolves.not.toThrow();
      expect(mockOrganizerEntity.delete).toHaveBeenCalledWith({ organizerId: validOrganizerId });
    });

    it('should throw ForbiddenError if user does not own the organizer', async () => {
      const otherUser: ClerkUser = {
        id: 'other_user_id',
        role: 'organizer',
        email: 'other@example.com',
      };

      // Mock get organizer
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockOrganizerItem,
        }),
      });

      await expect(service.deleteOrganizer(validOrganizerId, otherUser)).rejects.toThrow(ForbiddenError);
    });

    it('should allow admin to delete any organizer', async () => {
      // Mock get organizer
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockOrganizerItem,
        }),
      });

      // Mock event query to return no events
      mockEventEntity.query = {
        OrganizerIndex: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: [],
          }),
        }),
      } as any;

      // Mock delete
      mockOrganizerEntity.delete = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({}),
      });

      await expect(service.deleteOrganizer(validOrganizerId, mockAdminUser)).resolves.not.toThrow();
    });

    it('should throw ConflictError if organizer has associated events', async () => {
      // Mock get organizer
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockOrganizerItem,
        }),
      });

      // Mock event query to return events associated with organizer
      mockEventEntity.query = {
        OrganizerIndex: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: [
              {
                eventId: 'event1',
                title: 'Test Event 1',
                organizerId: validOrganizerId,
              },
              {
                eventId: 'event2',
                title: 'Test Event 2',
                organizerId: validOrganizerId,
              },
            ],
          }),
        }),
      } as any;

      await expect(service.deleteOrganizer(validOrganizerId, mockUser)).rejects.toThrow(ConflictError);
      await expect(service.deleteOrganizer(validOrganizerId, mockUser)).rejects.toThrow(
        'Cannot delete organizer. 2 event(s) are associated with this organizer'
      );
    });

    it('should allow deletion if organizer has no associated events', async () => {
      // Mock get organizer
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockOrganizerItem,
        }),
      });

      // Mock event query to return no events
      mockEventEntity.query = {
        OrganizerIndex: jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({
            data: [],
          }),
        }),
      } as any;

      // Mock delete
      mockOrganizerEntity.delete = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({}),
      });

      await expect(service.deleteOrganizer(validOrganizerId, mockUser)).resolves.not.toThrow();
      expect(mockOrganizerEntity.delete).toHaveBeenCalledWith({ organizerId: validOrganizerId });
    });
  });

  describe('validateOrganizerExists', () => {
    it('should return organizer if it exists and user has access', async () => {
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockOrganizerItem,
        }),
      });

      const result = await service.validateOrganizerExists(validOrganizerId, mockUser);

      expect(result).toEqual(mockOrganizerItem);
      expect(mockOrganizerEntity.get).toHaveBeenCalledWith({ organizerId: validOrganizerId });
    });

    it('should return organizer if it exists and no user is provided', async () => {
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockOrganizerItem,
        }),
      });

      const result = await service.validateOrganizerExists(validOrganizerId);

      expect(result).toEqual(mockOrganizerItem);
      expect(mockOrganizerEntity.get).toHaveBeenCalledWith({ organizerId: validOrganizerId });
    });

    it('should allow admin to access any organizer', async () => {
      const organizerOwnedByOther = {
        ...mockOrganizerItem,
        clerkId: 'other_user_id',
      };

      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: organizerOwnedByOther,
        }),
      });

      const result = await service.validateOrganizerExists(validOrganizerId, mockAdminUser);

      expect(result).toEqual(organizerOwnedByOther);
    });

    it('should throw NotFoundError if organizer does not exist', async () => {
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: null }),
      });

      await expect(service.validateOrganizerExists(validOrganizerId, mockUser)).rejects.toThrow(NotFoundError);
      await expect(service.validateOrganizerExists(validOrganizerId, mockUser)).rejects.toThrow(
        `Organizer with ID ${validOrganizerId} not found`
      );
    });

    it('should throw NotFoundError if user does not have access to organizer', async () => {
      const organizerOwnedByOther = {
        ...mockOrganizerItem,
        clerkId: 'other_user_id',
      };

      const otherUser: ClerkUser = {
        id: 'different_user_id',
        role: 'organizer',
        email: 'other@example.com',
      };

      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: organizerOwnedByOther,
        }),
      });

      // Should throw NotFoundError to not reveal existence to unauthorized users
      await expect(service.validateOrganizerExists(validOrganizerId, otherUser)).rejects.toThrow(NotFoundError);
      await expect(service.validateOrganizerExists(validOrganizerId, otherUser)).rejects.toThrow(
        `Organizer with ID ${validOrganizerId} not found`
      );
    });

    it('should allow owner to access their own organizer', async () => {
      mockOrganizerEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({
          data: mockOrganizerItem,
        }),
      });

      const result = await service.validateOrganizerExists(validOrganizerId, mockUser);

      expect(result).toEqual(mockOrganizerItem);
    });
  });
});
