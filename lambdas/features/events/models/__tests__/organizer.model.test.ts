import { generateULID, isValidULID } from '../../../../shared/utils/ulid';
import { CreateOrganizerData, OrganizerItem } from '../../types/organizer.types';
import { OrganizerEntity } from '../organizer.model';

// Mock the DynamoDB client
jest.mock('../../../../shared/utils/dynamo', () => ({
  ddbDocClient: {
    send: jest.fn(),
  },
}));

describe('OrganizerEntity', () => {
  const mockOrganizerData: CreateOrganizerData = {
    name: 'Test Organizer',
    contact: 'test@example.com',
    website: 'https://example.com',
    description: 'Test organizer description',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Entity Configuration', () => {
    it('should have correct entity configuration', () => {
      expect(OrganizerEntity.schema.model.entity).toBe('organizer');
      expect(OrganizerEntity.schema.model.version).toBe('1');
      expect(OrganizerEntity.schema.model.service).toBe('events');
    });
  });

  describe('Required Field Validation', () => {
    it('should validate organizerId as required', () => {
      const attributes = OrganizerEntity.schema.attributes;
      expect(attributes.organizerId.required).toBe(true);
      expect(attributes.organizerId.type).toBe('string');
    });

    it('should validate clerkId as required', () => {
      const attributes = OrganizerEntity.schema.attributes;
      expect(attributes.clerkId.required).toBe(true);
      expect(attributes.clerkId.type).toBe('string');
    });

    it('should validate name as required', () => {
      const attributes = OrganizerEntity.schema.attributes;
      expect(attributes.name.required).toBe(true);
      expect(attributes.name.type).toBe('string');
    });

    it('should validate contact as required', () => {
      const attributes = OrganizerEntity.schema.attributes;
      expect(attributes.contact.required).toBe(true);
      expect(attributes.contact.type).toBe('string');
    });

    it('should validate createdAt as required', () => {
      const attributes = OrganizerEntity.schema.attributes;
      expect(attributes.createdAt.required).toBe(true);
      expect(attributes.createdAt.type).toBe('string');
    });

    it('should validate updatedAt as required', () => {
      const attributes = OrganizerEntity.schema.attributes;
      expect(attributes.updatedAt.required).toBe(true);
      expect(attributes.updatedAt.type).toBe('string');
    });
  });

  describe('Optional Field Validation', () => {
    it('should validate website as optional string', () => {
      const attributes = OrganizerEntity.schema.attributes;
      expect('required' in attributes.website).toBe(false);
      expect(attributes.website.type).toBe('string');
    });

    it('should validate description as optional string', () => {
      const attributes = OrganizerEntity.schema.attributes;
      expect('required' in attributes.description).toBe(false);
      expect(attributes.description.type).toBe('string');
    });
  });

  describe('ULID Validation', () => {
    it('should validate organizerId as ULID format', () => {
      const organizerIdAttr = OrganizerEntity.schema.attributes.organizerId;
      const validULID = generateULID();

      expect(() => organizerIdAttr.validate(validULID)).not.toThrow();
      expect(() => organizerIdAttr.validate('invalid-id')).toThrow('organizerId must be a valid ULID format');
      expect(() => organizerIdAttr.validate('org_123')).toThrow('organizerId must be a valid ULID format');
      expect(() => organizerIdAttr.validate('')).toThrow('organizerId must be a valid ULID format');
      expect(() => organizerIdAttr.validate('01arz3ndektsv4rrffq69g5fav')).toThrow('organizerId must be a valid ULID format'); // lowercase
    });

    it('should accept valid ULID formats for organizerId', () => {
      const organizerIdAttr = OrganizerEntity.schema.attributes.organizerId;
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
      const organizerIdAttr = OrganizerEntity.schema.attributes.organizerId;
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

    it('should generate and validate ULID consistency', () => {
      const organizerId1 = generateULID();
      const organizerId2 = generateULID();

      expect(isValidULID(organizerId1)).toBe(true);
      expect(isValidULID(organizerId2)).toBe(true);

      // Test that generated ULIDs are different
      expect(organizerId1).not.toBe(organizerId2);
    });
  });

  describe('ClerkId Validation', () => {
    it('should validate clerkId as non-empty string', () => {
      const clerkIdAttr = OrganizerEntity.schema.attributes.clerkId;

      expect(() => clerkIdAttr.validate('user_123')).not.toThrow();
      expect(() => clerkIdAttr.validate('clerk_user_456')).not.toThrow();
      expect(() => clerkIdAttr.validate('valid-clerk-id')).not.toThrow();
    });

    it('should reject invalid clerkId values', () => {
      const clerkIdAttr = OrganizerEntity.schema.attributes.clerkId;

      expect(() => clerkIdAttr.validate('')).toThrow('clerkId is required and must be a non-empty string');
      expect(() => clerkIdAttr.validate('   ')).toThrow('clerkId is required and must be a non-empty string');
      expect(() => clerkIdAttr.validate(null as any)).toThrow('clerkId is required and must be a non-empty string');
      expect(() => clerkIdAttr.validate(undefined as any)).toThrow('clerkId is required and must be a non-empty string');
      expect(() => clerkIdAttr.validate(123 as any)).toThrow('clerkId is required and must be a non-empty string');
    });

    it('should accept various valid clerkId formats', () => {
      const clerkIdAttr = OrganizerEntity.schema.attributes.clerkId;
      const validClerkIds = [
        'user_123',
        'clerk_user_456',
        'valid-clerk-id',
        'user123',
        'user_abc_def_123',
        'a',
        '1'
      ];

      validClerkIds.forEach(clerkId => {
        expect(() => clerkIdAttr.validate(clerkId)).not.toThrow();
      });
    });
  });

  describe('Index Configuration', () => {
    it('should have correct primary index configuration', () => {
      const indexes = OrganizerEntity.schema.indexes;
      const primaryIndex = indexes.OrganizerPrimaryIndex;

      expect(primaryIndex.pk.field).toBe('id');
      expect(primaryIndex.pk.composite).toEqual(['organizerId']);
      expect(primaryIndex.pk.casing).toBe('upper');
    });

    it('should have correct ClerkIndex configuration', () => {
      const indexes = OrganizerEntity.schema.indexes;
      const clerkIndex = indexes.ClerkIndex;

      expect(clerkIndex.index).toBe('ClerkIndex');
      expect(clerkIndex.pk.field).toBe('clerkId');
      expect(clerkIndex.pk.composite).toEqual(['clerkId']);
      expect(clerkIndex.pk.casing).toBe('none');
      expect(clerkIndex.sk.field).toBe('createdAt');
      expect(clerkIndex.sk.composite).toEqual(['createdAt']);
    });
  });

  describe('ElectroDB Entity Operations', () => {
    it('should have correct table configuration', () => {
      expect(OrganizerEntity.client).toBeDefined();
      // ElectroDB entities don't expose table name directly, but we can verify the entity is properly configured
      expect(OrganizerEntity.schema).toBeDefined();
      expect(OrganizerEntity.schema.model).toBeDefined();
    });

    it('should support create operation structure', () => {
      // Test that the entity can be used for create operations
      expect(OrganizerEntity.create).toBeDefined();
      expect(typeof OrganizerEntity.create).toBe('function');
    });

    it('should support query operation structure', () => {
      // Test that the entity can be used for query operations
      expect(OrganizerEntity.query).toBeDefined();
      expect(typeof OrganizerEntity.query).toBe('object');
    });

    it('should support update operation structure', () => {
      // Test that the entity can be used for update operations
      expect(OrganizerEntity.update).toBeDefined();
      expect(typeof OrganizerEntity.update).toBe('function');
    });

    it('should support delete operation structure', () => {
      // Test that the entity can be used for delete operations
      expect(OrganizerEntity.delete).toBeDefined();
      expect(typeof OrganizerEntity.delete).toBe('function');
    });

    it('should support get operation structure', () => {
      // Test that the entity can be used for get operations
      expect(OrganizerEntity.get).toBeDefined();
      expect(typeof OrganizerEntity.get).toBe('function');
    });

    it('should have query methods for indexes', () => {
      // Test that query methods exist for each index
      expect(OrganizerEntity.query.OrganizerPrimaryIndex).toBeDefined();
      expect(OrganizerEntity.query.ClerkIndex).toBeDefined();
    });
  });

  describe('Data Validation Integration', () => {
    it('should validate complete organizer data structure', () => {
      const validOrganizerData: OrganizerItem = {
        organizerId: generateULID(),
        clerkId: 'user_123',
        name: 'Test Organizer',
        contact: 'test@example.com',
        website: 'https://example.com',
        description: 'Test description',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Test that all required fields are present
      expect(validOrganizerData.organizerId).toBeDefined();
      expect(validOrganizerData.clerkId).toBeDefined();
      expect(validOrganizerData.name).toBeDefined();
      expect(validOrganizerData.contact).toBeDefined();
      expect(validOrganizerData.createdAt).toBeDefined();
      expect(validOrganizerData.updatedAt).toBeDefined();

      // Test that optional fields can be undefined
      const minimalOrganizerData: OrganizerItem = {
        organizerId: generateULID(),
        clerkId: 'user_456',
        name: 'Minimal Organizer',
        contact: 'minimal@example.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(minimalOrganizerData.website).toBeUndefined();
      expect(minimalOrganizerData.description).toBeUndefined();
    });

    it('should validate CreateOrganizerData type structure', () => {
      const createData: CreateOrganizerData = {
        name: 'New Organizer',
        contact: 'new@example.com',
        website: 'https://neworganizer.com',
        description: 'New organizer description',
      };

      expect(createData.name).toBe('New Organizer');
      expect(createData.contact).toBe('new@example.com');
      expect(createData.website).toBe('https://neworganizer.com');
      expect(createData.description).toBe('New organizer description');

      // Test minimal create data
      const minimalCreateData: CreateOrganizerData = {
        name: 'Minimal New Organizer',
        contact: 'minimal-new@example.com',
      };

      expect(minimalCreateData.name).toBe('Minimal New Organizer');
      expect(minimalCreateData.contact).toBe('minimal-new@example.com');
      expect(minimalCreateData.website).toBeUndefined();
      expect(minimalCreateData.description).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error messages for ULID validation failures', () => {
      const organizerIdAttr = OrganizerEntity.schema.attributes.organizerId;

      try {
        organizerIdAttr.validate('invalid-ulid');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('organizerId must be a valid ULID format');
      }
    });

    it('should provide clear error messages for clerkId validation failures', () => {
      const clerkIdAttr = OrganizerEntity.schema.attributes.clerkId;

      try {
        clerkIdAttr.validate('');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('clerkId is required and must be a non-empty string');
      }

      try {
        clerkIdAttr.validate('   ');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('clerkId is required and must be a non-empty string');
      }
    });
  });
});