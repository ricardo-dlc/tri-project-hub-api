import { generateULID, isValidULID } from '../../../../shared/utils/ulid';
import { CreateEventData, EventItem } from '../../types/event.types';
import { EventEntity } from '../event.model';

// Mock the DynamoDB client
jest.mock('../../../../shared/utils/dynamo', () => ({
  ddbDocClient: {
    send: jest.fn(),
  },
}));

describe('EventEntity', () => {
  const mockEventData: CreateEventData = {
    organizerId: generateULID(),
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Entity Configuration', () => {
    it('should have correct entity configuration', () => {
      expect(EventEntity.schema.model.entity).toBe('event');
      expect(EventEntity.schema.model.version).toBe('1');
      expect(EventEntity.schema.model.service).toBe('events');
    });
  });

  describe('Required Field Validation', () => {
    it('should validate eventId as required', () => {
      const attributes = EventEntity.schema.attributes;
      expect(attributes.eventId.required).toBe(true);
      expect(attributes.eventId.type).toBe('string');
    });

    it('should validate organizerId as required', () => {
      const attributes = EventEntity.schema.attributes;
      expect(attributes.organizerId.required).toBe(true);
      expect(attributes.organizerId.type).toBe('string');
    });

    it('should validate creatorId as required', () => {
      const attributes = EventEntity.schema.attributes;
      expect(attributes.creatorId.required).toBe(true);
      expect(attributes.creatorId.type).toBe('string');
    });

    it('should validate title as required', () => {
      const attributes = EventEntity.schema.attributes;
      expect(attributes.title.required).toBe(true);
      expect(attributes.title.type).toBe('string');
    });

    it('should validate slug as required', () => {
      const attributes = EventEntity.schema.attributes;
      expect(attributes.slug.required).toBe(true);
      expect(attributes.slug.type).toBe('string');
    });

    it('should validate other required fields', () => {
      const attributes = EventEntity.schema.attributes;
      const requiredFields = [
        'type', 'date', 'isFeatured', 'isTeamEvent', 'requiredParticipants',
        'location', 'description', 'distance', 'maxParticipants', 'currentParticipants',
        'registrationFee', 'registrationDeadline', 'image', 'difficulty', 'isEnabled',
        'createdAt', 'updatedAt'
      ];

      requiredFields.forEach(field => {
        expect((attributes as any)[field].required).toBe(true);
      });
    });
  });

  describe('ULID Validation for eventId', () => {
    it('should validate eventId as ULID format', () => {
      const eventIdAttr = EventEntity.schema.attributes.eventId;
      const validULID = generateULID();

      expect(() => eventIdAttr.validate(validULID)).not.toThrow();
      expect(() => eventIdAttr.validate('invalid-id')).toThrow('eventId must be a valid ULID format');
      expect(() => eventIdAttr.validate('event_123')).toThrow('eventId must be a valid ULID format');
      expect(() => eventIdAttr.validate('')).toThrow('eventId must be a valid ULID format');
      expect(() => eventIdAttr.validate('01arz3ndektsv4rrffq69g5fav')).toThrow('eventId must be a valid ULID format'); // lowercase
    });

    it('should accept valid ULID formats for eventId', () => {
      const eventIdAttr = EventEntity.schema.attributes.eventId;
      const validULIDs = [
        generateULID(),
        generateULID(),
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        '01BX5ZZKBKACTAV9WEVGEMMVRZ'
      ];

      validULIDs.forEach(ulid => {
        expect(() => eventIdAttr.validate(ulid)).not.toThrow();
        expect(isValidULID(ulid)).toBe(true);
      });
    });

    it('should reject invalid ULID formats for eventId', () => {
      const eventIdAttr = EventEntity.schema.attributes.eventId;
      const invalidULIDs = [
        'invalid-id',
        '123',
        '',
        'too-short',
        '01ARZ3NDEKTSV4RRFFQ69G5FAV-too-long',
        '01arz3ndektsv4rrffq69g5fav', // lowercase
        '01ARZ3NDEKTSV4RRFFQ69G5FA!', // invalid character
        'event_123',
        'evt_456'
      ];

      invalidULIDs.forEach(invalidId => {
        expect(() => eventIdAttr.validate(invalidId)).toThrow('eventId must be a valid ULID format');
        expect(isValidULID(invalidId)).toBe(false);
      });
    });
  });

  describe('ULID Validation for organizerId', () => {
    it('should validate organizerId as ULID format', () => {
      const organizerIdAttr = EventEntity.schema.attributes.organizerId;
      const validULID = generateULID();

      expect(() => organizerIdAttr.validate(validULID)).not.toThrow();
      expect(() => organizerIdAttr.validate('invalid-id')).toThrow('organizerId must be a valid ULID format');
      expect(() => organizerIdAttr.validate('org_123')).toThrow('organizerId must be a valid ULID format');
      expect(() => organizerIdAttr.validate('')).toThrow('organizerId must be a valid ULID format');
      expect(() => organizerIdAttr.validate('01arz3ndektsv4rrffq69g5fav')).toThrow('organizerId must be a valid ULID format'); // lowercase
    });

    it('should accept valid ULID formats for organizerId', () => {
      const organizerIdAttr = EventEntity.schema.attributes.organizerId;
      const validULIDs = [
        generateULID(),
        generateULID(),
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        '01BX5ZZKBKACTAV9WEVGEMMVRZ'
      ];

      validULIDs.forEach(ulid => {
        expect(() => organizerIdAttr.validate(ulid)).not.toThrow();
        expect(isValidULID(ulid)).toBe(true);
      });
    });

    it('should reject invalid ULID formats for organizerId', () => {
      const organizerIdAttr = EventEntity.schema.attributes.organizerId;
      const invalidULIDs = [
        'invalid-id',
        '123',
        '',
        'too-short',
        '01ARZ3NDEKTSV4RRFFQ69G5FAV-too-long',
        '01arz3ndektsv4rrffq69g5fav', // lowercase
        '01ARZ3NDEKTSV4RRFFQ69G5FA!', // invalid character
        'org_123',
        'organizer_456'
      ];

      invalidULIDs.forEach(invalidId => {
        expect(() => organizerIdAttr.validate(invalidId)).toThrow('organizerId must be a valid ULID format');
        expect(isValidULID(invalidId)).toBe(false);
      });
    });
  });

  describe('Composite Key Generation', () => {
    it('should generate slugDate composite key correctly', () => {
      const attributes = EventEntity.schema.attributes;
      const slugDateAttr = attributes.slugDate;

      expect(slugDateAttr.type).toBe('string');
      expect(slugDateAttr.watch).toEqual(['slug', 'date']);

      // Test the set function
      const mockItem = {
        slug: 'test-event',
        date: '2024-12-01T10:00:00Z'
      };
      const result = slugDateAttr.set(undefined, mockItem);
      expect(result).toBe('test-event#2024-12-01T10:00:00Z');
    });

    it('should generate creatorDate composite key correctly', () => {
      const attributes = EventEntity.schema.attributes;
      const creatorDateAttr = attributes.creatorDate;

      expect(creatorDateAttr.type).toBe('string');
      expect(creatorDateAttr.watch).toEqual(['creatorId', 'date']);

      // Test the set function
      const mockItem = {
        creatorId: 'user_123',
        date: '2024-12-01T10:00:00Z'
      };
      const result = creatorDateAttr.set(undefined, mockItem);
      expect(result).toBe('user_123#2024-12-01T10:00:00Z');
    });

    it('should generate typeDate composite key correctly', () => {
      const attributes = EventEntity.schema.attributes;
      const typeDateAttr = attributes.typeDate;

      expect(typeDateAttr.type).toBe('string');
      expect(typeDateAttr.watch).toEqual(['type', 'date']);

      // Test the set function
      const mockItem = {
        type: 'running',
        date: '2024-12-01T10:00:00Z'
      };
      const result = typeDateAttr.set(undefined, mockItem);
      expect(result).toBe('running#2024-12-01T10:00:00Z');
    });

    it('should generate difficultyDate composite key correctly', () => {
      const attributes = EventEntity.schema.attributes;
      const difficultyDateAttr = attributes.difficultyDate;

      expect(difficultyDateAttr.type).toBe('string');
      expect(difficultyDateAttr.watch).toEqual(['difficulty', 'date']);

      // Test the set function
      const mockItem = {
        difficulty: 'beginner',
        date: '2024-12-01T10:00:00Z'
      };
      const result = difficultyDateAttr.set(undefined, mockItem);
      expect(result).toBe('beginner#2024-12-01T10:00:00Z');
    });

    it('should generate featuredStatus composite key correctly', () => {
      const attributes = EventEntity.schema.attributes;
      const featuredStatusAttr = attributes.featuredStatus;

      expect(featuredStatusAttr.type).toBe('string');
      expect(featuredStatusAttr.watch).toEqual(['isFeatured']);

      // Test the set function for featured event
      const featuredItem = { isFeatured: true };
      const featuredResult = featuredStatusAttr.set(undefined, featuredItem);
      expect(featuredResult).toBe('featured');

      // Test the set function for non-featured event
      const nonFeaturedItem = { isFeatured: false };
      const nonFeaturedResult = featuredStatusAttr.set(undefined, nonFeaturedItem);
      expect(nonFeaturedResult).toBeUndefined();
    });

    it('should generate enabledStatus composite key correctly', () => {
      const attributes = EventEntity.schema.attributes;
      const enabledStatusAttr = attributes.enabledStatus;

      expect(enabledStatusAttr.type).toBe('string');
      expect(enabledStatusAttr.watch).toEqual(['isEnabled']);

      // Test the set function for enabled event
      const enabledItem = { isEnabled: true };
      const enabledResult = enabledStatusAttr.set(undefined, enabledItem);
      expect(enabledResult).toBe('enabled');

      // Test the set function for disabled event
      const disabledItem = { isEnabled: false };
      const disabledResult = enabledStatusAttr.set(undefined, disabledItem);
      expect(disabledResult).toBeUndefined();
    });
  });

  describe('Index Configuration', () => {
    it('should have correct primary index configuration', () => {
      const indexes = EventEntity.schema.indexes;
      const primaryIndex = indexes.EventPrimaryIndex;

      expect(primaryIndex.pk.field).toBe('id');
      expect(primaryIndex.pk.composite).toEqual(['eventId']);
      expect(primaryIndex.pk.casing).toBe('upper');
    });

    it('should have correct CreatorIndex configuration', () => {
      const indexes = EventEntity.schema.indexes;
      const creatorIndex = indexes.CreatorIndex;

      expect(creatorIndex.index).toBe('CreatorIndex');
      expect(creatorIndex.pk.field).toBe('creatorId');
      expect(creatorIndex.pk.composite).toEqual(['creatorId']);
      expect(creatorIndex.pk.casing).toBe('none');
      expect(creatorIndex.sk.field).toBe('date');
      expect(creatorIndex.sk.composite).toEqual(['date']);
    });

    it('should have correct SlugIndex configuration', () => {
      const indexes = EventEntity.schema.indexes;
      const slugIndex = indexes.SlugIndex;

      expect(slugIndex.index).toBe('SlugIndex');
      expect(slugIndex.pk.field).toBe('slug');
      expect(slugIndex.pk.composite).toEqual(['slug']);
      expect(slugIndex.sk.field).toBe('slugDate');
      expect(slugIndex.sk.composite).toEqual(['slugDate']);
    });

    it('should have correct TypeIndex configuration', () => {
      const indexes = EventEntity.schema.indexes;
      const typeIndex = indexes.TypeIndex;

      expect(typeIndex.index).toBe('TypeIndex');
      expect(typeIndex.pk.field).toBe('type');
      expect(typeIndex.pk.composite).toEqual(['type']);
      expect(typeIndex.sk.field).toBe('typeDate');
      expect(typeIndex.sk.composite).toEqual(['typeDate']);
    });

    it('should have correct DifficultyIndex configuration', () => {
      const indexes = EventEntity.schema.indexes;
      const difficultyIndex = indexes.DifficultyIndex;

      expect(difficultyIndex.index).toBe('DifficultyIndex');
      expect(difficultyIndex.pk.field).toBe('difficulty');
      expect(difficultyIndex.pk.composite).toEqual(['difficulty']);
      expect(difficultyIndex.sk.field).toBe('difficultyDate');
      expect(difficultyIndex.sk.composite).toEqual(['difficultyDate']);
    });

    it('should have correct FeaturedIndex configuration', () => {
      const indexes = EventEntity.schema.indexes;
      const featuredIndex = indexes.FeaturedIndex;

      expect(featuredIndex.index).toBe('FeaturedIndex');
      expect(featuredIndex.pk.field).toBe('featuredStatus');
      expect(featuredIndex.pk.composite).toEqual(['featuredStatus']);
      expect(featuredIndex.sk.field).toBe('date');
      expect(featuredIndex.sk.composite).toEqual(['date']);
    });

    it('should have correct EnabledIndex configuration', () => {
      const indexes = EventEntity.schema.indexes;
      const enabledIndex = indexes.EnabledIndex;

      expect(enabledIndex.index).toBe('EnabledIndex');
      expect(enabledIndex.pk.field).toBe('enabledStatus');
      expect(enabledIndex.pk.composite).toEqual(['enabledStatus']);
      expect(enabledIndex.sk.field).toBe('date');
      expect(enabledIndex.sk.composite).toEqual(['date']);
    });
  });

  describe('Event-Organizer Relationship Validation', () => {
    it('should require organizerId for event creation', () => {
      const attributes = EventEntity.schema.attributes;
      const organizerIdAttr = attributes.organizerId;

      expect(organizerIdAttr.required).toBe(true);
      expect(organizerIdAttr.type).toBe('string');
    });

    it('should validate organizerId format in event data', () => {
      const validEventData: EventItem = {
        eventId: generateULID(),
        creatorId: 'user_123',
        organizerId: generateULID(), // Valid ULID
        title: 'Test Event',
        type: 'running',
        date: '2024-12-01T10:00:00Z',
        isFeatured: false,
        isTeamEvent: false,
        isRelay: false,
        requiredParticipants: 1,
        location: 'Test Location',
        description: 'Test description',
        distance: '5km',
        maxParticipants: 100,
        currentParticipants: 0,
        registrationFee: 25.00,
        registrationDeadline: '2024-11-25T23:59:59Z',
        image: 'https://example.com/image.jpg',
        difficulty: 'beginner',
        tags: ['running'],
        slug: 'test-event',
        isEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(isValidULID(validEventData.organizerId)).toBe(true);
      expect(isValidULID(validEventData.eventId)).toBe(true);
    });

    it('should enforce organizerId validation in CreateEventData', () => {
      const validCreateData: CreateEventData = {
        organizerId: generateULID(), // Must be valid ULID
        title: 'New Event',
        type: 'cycling',
        date: '2024-12-15T09:00:00Z',
        isTeamEvent: true,
        requiredParticipants: 4,
        maxParticipants: 20,
        location: 'Cycling Track',
        description: 'Team cycling event',
        distance: '25km',
        registrationFee: 35.00,
        registrationDeadline: '2024-12-10T23:59:59Z',
        image: 'https://example.com/cycling.jpg',
        difficulty: 'intermediate',
      };

      expect(validCreateData.organizerId).toBeDefined();
      expect(typeof validCreateData.organizerId).toBe('string');

      // Type guard to ensure organizerId is defined before ULID validation
      if (validCreateData.organizerId) {
        expect(isValidULID(validCreateData.organizerId)).toBe(true);
      }
    });

    it('should maintain referential integrity between event and organizer', () => {
      const organizerId = generateULID();
      const eventId = generateULID();

      // Event should reference a valid organizer ID
      const eventData: EventItem = {
        eventId: eventId,
        creatorId: 'user_123',
        organizerId: organizerId, // References organizer
        title: 'Linked Event',
        type: 'running',
        date: '2024-12-01T10:00:00Z',
        isFeatured: false,
        isTeamEvent: false,
        requiredParticipants: 1,
        location: 'Test Location',
        description: 'Event linked to organizer',
        distance: '10km',
        maxParticipants: 50,
        currentParticipants: 0,
        registrationFee: 20.00,
        registrationDeadline: '2024-11-25T23:59:59Z',
        image: 'https://example.com/image.jpg',
        difficulty: 'beginner',
        tags: ['running'],
        slug: 'linked-event',
        isEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Verify the relationship
      expect(eventData.organizerId).toBe(organizerId);
      expect(isValidULID(eventData.organizerId)).toBe(true);
      expect(isValidULID(eventData.eventId)).toBe(true);
    });
  });

  describe('ElectroDB Entity Operations', () => {
    it('should have correct table configuration', () => {
      expect(EventEntity.client).toBeDefined();
      expect(EventEntity.schema).toBeDefined();
      expect(EventEntity.schema.model).toBeDefined();
    });

    it('should support create operation structure', () => {
      expect(EventEntity.create).toBeDefined();
      expect(typeof EventEntity.create).toBe('function');
    });

    it('should support query operation structure', () => {
      expect(EventEntity.query).toBeDefined();
      expect(typeof EventEntity.query).toBe('object');
    });

    it('should support update operation structure', () => {
      expect(EventEntity.update).toBeDefined();
      expect(typeof EventEntity.update).toBe('function');
    });

    it('should support delete operation structure', () => {
      expect(EventEntity.delete).toBeDefined();
      expect(typeof EventEntity.delete).toBe('function');
    });

    it('should support get operation structure', () => {
      expect(EventEntity.get).toBeDefined();
      expect(typeof EventEntity.get).toBe('function');
    });

    it('should have query methods for all indexes', () => {
      expect(EventEntity.query.EventPrimaryIndex).toBeDefined();
      expect(EventEntity.query.CreatorIndex).toBeDefined();
      expect(EventEntity.query.SlugIndex).toBeDefined();
      expect(EventEntity.query.TypeIndex).toBeDefined();
      expect(EventEntity.query.DifficultyIndex).toBeDefined();
      expect(EventEntity.query.FeaturedIndex).toBeDefined();
      expect(EventEntity.query.EnabledIndex).toBeDefined();
    });
  });

  describe('Data Validation Integration', () => {
    it('should validate complete event data structure', () => {
      const validEventData: EventItem = {
        eventId: generateULID(),
        creatorId: 'user_123',
        organizerId: generateULID(),
        title: 'Complete Event',
        type: 'triathlon',
        date: '2024-12-01T06:00:00Z',
        isFeatured: true,
        isTeamEvent: true,
        isRelay: true,
        requiredParticipants: 3,
        location: 'Triathlon Center',
        description: 'Complete triathlon event with all fields',
        distance: 'Olympic',
        maxParticipants: 150,
        currentParticipants: 45,
        registrationFee: 75.00,
        registrationDeadline: '2024-11-20T23:59:59Z',
        image: 'https://example.com/triathlon.jpg',
        difficulty: 'advanced',
        tags: ['triathlon', 'swimming', 'cycling', 'running'],
        slug: 'complete-triathlon-event',
        isEnabled: true,
        createdAt: '2024-10-01T12:00:00Z',
        updatedAt: '2024-10-15T14:30:00Z',
      };

      // Validate all required fields are present and valid
      expect(validEventData.eventId).toBeDefined();
      expect(validEventData.creatorId).toBeDefined();
      expect(validEventData.organizerId).toBeDefined();
      expect(validEventData.title).toBeDefined();
      expect(validEventData.slug).toBeDefined();
      expect(validEventData.createdAt).toBeDefined();
      expect(validEventData.updatedAt).toBeDefined();

      // Validate ULID formats
      expect(isValidULID(validEventData.eventId)).toBe(true);
      expect(isValidULID(validEventData.organizerId)).toBe(true);

      // Validate optional fields
      expect(validEventData.isRelay).toBe(true);
      expect(validEventData.tags).toHaveLength(4);
    });

    it('should validate CreateEventData type structure', () => {
      const createData: CreateEventData = {
        organizerId: generateULID(),
        title: 'New Marathon',
        type: 'running',
        date: '2024-12-25T08:00:00Z',
        isTeamEvent: false,
        isRelay: false,
        requiredParticipants: 1,
        maxParticipants: 500,
        location: 'City Marathon Route',
        description: 'Annual city marathon event',
        distance: '42.2km',
        registrationFee: 50.00,
        registrationDeadline: '2024-12-15T23:59:59Z',
        image: 'https://example.com/marathon.jpg',
        difficulty: 'advanced',
        tags: ['marathon', 'running', 'endurance'],
      };

      expect(createData.organizerId).toBeDefined();
      expect(isValidULID(createData.organizerId!)).toBe(true);
      expect(createData.title).toBe('New Marathon');
      expect(createData.tags).toHaveLength(3);
      expect(createData.isRelay).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error messages for eventId ULID validation failures', () => {
      const eventIdAttr = EventEntity.schema.attributes.eventId;

      try {
        eventIdAttr.validate('invalid-event-id');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('eventId must be a valid ULID format');
      }
    });

    it('should provide clear error messages for organizerId ULID validation failures', () => {
      const organizerIdAttr = EventEntity.schema.attributes.organizerId;

      try {
        organizerIdAttr.validate('invalid-organizer-id');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('organizerId must be a valid ULID format');
      }
    });

    it('should handle edge cases in composite key generation', () => {
      const attributes = EventEntity.schema.attributes;

      // Test with empty values
      const emptyItem = { slug: '', date: '' };
      const slugDateResult = attributes.slugDate.set(undefined, emptyItem);
      expect(slugDateResult).toBe('#');

      // Test with special characters
      const specialItem = { type: 'running-trail', date: '2024-12-01T10:00:00Z' };
      const typeDateResult = attributes.typeDate.set(undefined, specialItem);
      expect(typeDateResult).toBe('running-trail#2024-12-01T10:00:00Z');
    });
  });

  describe('ULID Generation Consistency', () => {
    it('should generate and validate ULID consistency for eventId', () => {
      const eventId1 = generateULID();
      const eventId2 = generateULID();

      expect(isValidULID(eventId1)).toBe(true);
      expect(isValidULID(eventId2)).toBe(true);
      expect(eventId1).not.toBe(eventId2);
      expect(eventId1).toHaveLength(26);
      expect(eventId2).toHaveLength(26);
    });

    it('should generate and validate ULID consistency for organizerId', () => {
      const organizerId1 = generateULID();
      const organizerId2 = generateULID();

      expect(isValidULID(organizerId1)).toBe(true);
      expect(isValidULID(organizerId2)).toBe(true);
      expect(organizerId1).not.toBe(organizerId2);
      expect(organizerId1).toHaveLength(26);
      expect(organizerId2).toHaveLength(26);
    });
  });
});