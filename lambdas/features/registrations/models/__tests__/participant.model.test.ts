import { generateULID, isValidULID } from '@/shared/utils/ulid';
import { CreateParticipantData, ParticipantEntity } from '../participant.model';

// Mock the DynamoDB client
jest.mock('@/shared/utils/dynamo', () => ({
  ddbDocClient: {
    send: jest.fn(),
  },
}));

describe('ParticipantEntity', () => {
  const mockParticipantData: CreateParticipantData = {
    participantId: generateULID(),
    reservationId: generateULID(),
    eventId: generateULID(),
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    waiver: true,
    newsletter: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Entity Configuration', () => {
    it('should have correct entity configuration', () => {
      expect(ParticipantEntity.schema.model.entity).toBe('participant');
      expect(ParticipantEntity.schema.model.version).toBe('1');
      expect(ParticipantEntity.schema.model.service).toBe('registrations');
    });
  });

  describe('Required Field Validation', () => {
    it('should validate participantId as required', () => {
      const attributes = ParticipantEntity.schema.attributes;
      expect(attributes.participantId.required).toBe(true);
      expect(attributes.participantId.type).toBe('string');
    });

    it('should validate reservationId as required', () => {
      const attributes = ParticipantEntity.schema.attributes;
      expect(attributes.reservationId.required).toBe(true);
      expect(attributes.reservationId.type).toBe('string');
    });

    it('should validate eventId as required', () => {
      const attributes = ParticipantEntity.schema.attributes;
      expect(attributes.eventId.required).toBe(true);
      expect(attributes.eventId.type).toBe('string');
    });

    it('should validate email as required with email format validation', () => {
      const attributes = ParticipantEntity.schema.attributes;
      expect(attributes.email.required).toBe(true);
      expect(attributes.email.type).toBe('string');
      expect(attributes.email.validate).toEqual(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should validate firstName as required', () => {
      const attributes = ParticipantEntity.schema.attributes;
      expect(attributes.firstName.required).toBe(true);
      expect(attributes.firstName.type).toBe('string');
    });

    it('should validate lastName as required', () => {
      const attributes = ParticipantEntity.schema.attributes;
      expect(attributes.lastName.required).toBe(true);
      expect(attributes.lastName.type).toBe('string');
    });

    it('should validate waiver as required boolean with default false', () => {
      const attributes = ParticipantEntity.schema.attributes;
      expect(attributes.waiver.required).toBe(true);
      expect(attributes.waiver.type).toBe('boolean');
      expect(attributes.waiver.default).toBe(false);
    });

    it('should validate newsletter as required boolean with default false', () => {
      const attributes = ParticipantEntity.schema.attributes;
      expect(attributes.newsletter.required).toBe(true);
      expect(attributes.newsletter.type).toBe('boolean');
      expect(attributes.newsletter.default).toBe(false);
    });
  });

  describe('Optional Field Validation', () => {
    const optionalStringFields = [
      'phone', 'dateOfBirth', 'gender', 'address', 'city', 'state', 'zipCode', /* 'country', */
      'emergencyName', 'emergencyRelationship', 'emergencyPhone', /* 'emergencyEmail', */
      /* 'shirtSize', */ 'dietaryRestrictions', 'medicalConditions', 'medications', 'allergies', 'role'
    ] as const;

    optionalStringFields.forEach(field => {
      it(`should validate ${field} as optional string`, () => {
        const attributes = ParticipantEntity.schema.attributes;
        expect((attributes as any)[field].required).toBeUndefined();
        expect((attributes as any)[field].type).toBe('string');
      });
    });
  });

  describe('Email Validation', () => {
    it('should accept valid email formats', () => {
      const emailAttr = ParticipantEntity.schema.attributes.email;
      const regex = emailAttr.validate as RegExp;

      expect(regex.test('test@example.com')).toBe(true);
      expect(regex.test('user.name@domain.co.uk')).toBe(true);
      expect(regex.test('user+tag@example.org')).toBe(true);
      expect(regex.test('123@456.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      const emailAttr = ParticipantEntity.schema.attributes.email;
      const regex = emailAttr.validate as RegExp;

      expect(regex.test('invalid-email')).toBe(false);
      expect(regex.test('@example.com')).toBe(false);
      expect(regex.test('user@')).toBe(false);
      expect(regex.test('user@domain')).toBe(false);
      expect(regex.test('user name@example.com')).toBe(false);
      expect(regex.test('')).toBe(false);
    });
  });

  describe('GSI Attribute Generation', () => {
    it('should generate eventParticipantId from eventId', () => {
      const attributes = ParticipantEntity.schema.attributes;
      const eventParticipantId = attributes.eventParticipantId;

      expect(eventParticipantId.required).toBe(true);
      expect(eventParticipantId.watch).toEqual(['eventId']);

      const result = eventParticipantId.set(undefined, { eventId: 'event_123' });
      expect(result).toBe('event_123');
    });

    it('should generate participantEmail from email', () => {
      const attributes = ParticipantEntity.schema.attributes;
      const participantEmail = attributes.participantEmail;

      expect(participantEmail.required).toBe(true);
      expect(participantEmail.watch).toEqual(['email']);

      const result = participantEmail.set(undefined, { email: 'test@example.com' });
      expect(result).toBe('test@example.com');
    });

    it('should generate reservationParticipantId from reservationId', () => {
      const attributes = ParticipantEntity.schema.attributes;
      const reservationParticipantId = attributes.reservationParticipantId;

      expect(reservationParticipantId.required).toBe(true);
      expect(reservationParticipantId.watch).toEqual(['reservationId']);

      const result = reservationParticipantId.set(undefined, { reservationId: 'res_123' });
      expect(result).toBe('res_123');
    });

    it('should generate participantSequence from participantId', () => {
      const attributes = ParticipantEntity.schema.attributes;
      const participantSequence = attributes.participantSequence;

      expect(participantSequence.required).toBe(true);
      expect(participantSequence.watch).toEqual(['participantId']);

      const result = participantSequence.set(undefined, { participantId: 'part_123' });
      expect(result).toBe('part_123');
    });
  });

  describe('Index Configuration', () => {
    it('should have correct primary index configuration', () => {
      const indexes = ParticipantEntity.schema.indexes;
      const primaryIndex = indexes.ParticipantPrimaryIndex;

      expect(primaryIndex.pk.field).toBe('id');
      expect(primaryIndex.pk.composite).toEqual(['participantId']);
    });

    it('should have correct EventParticipantIndex configuration', () => {
      const indexes = ParticipantEntity.schema.indexes;
      const eventParticipantIndex = indexes.EventParticipantIndex;

      expect(eventParticipantIndex.index).toBe('EventParticipantIndex');
      expect(eventParticipantIndex.pk.field).toBe('eventParticipantId');
      expect(eventParticipantIndex.pk.composite).toEqual(['eventParticipantId']);
      expect(eventParticipantIndex.sk.field).toBe('participantEmail');
      expect(eventParticipantIndex.sk.composite).toEqual(['participantEmail']);
    });

    it('should have correct ReservationParticipantIndex configuration', () => {
      const indexes = ParticipantEntity.schema.indexes;
      const reservationParticipantIndex = indexes.ReservationParticipantIndex;

      expect(reservationParticipantIndex.index).toBe('ReservationParticipantIndex');
      expect(reservationParticipantIndex.pk.field).toBe('reservationParticipantId');
      expect(reservationParticipantIndex.pk.composite).toEqual(['reservationParticipantId']);
      expect(reservationParticipantIndex.sk.field).toBe('participantSequence');
      expect(reservationParticipantIndex.sk.composite).toEqual(['participantSequence']);
    });
  });

  describe('Type Definitions', () => {
    it('should export correct CreateParticipantData type with required fields', () => {
      const createData: CreateParticipantData = {
        participantId: 'part_123',
        reservationId: 'res_123',
        eventId: 'event_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        waiver: true,
        newsletter: false,
      };

      expect(createData.participantId).toBe('part_123');
      expect(createData.reservationId).toBe('res_123');
      expect(createData.eventId).toBe('event_123');
      expect(createData.email).toBe('test@example.com');
      expect(createData.firstName).toBe('John');
      expect(createData.lastName).toBe('Doe');
      expect(createData.waiver).toBe(true);
      expect(createData.newsletter).toBe(false);
    });

    it('should allow optional fields in CreateParticipantData type', () => {
      const createDataWithOptionals: CreateParticipantData = {
        participantId: generateULID(),
        reservationId: generateULID(),
        eventId: generateULID(),
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        waiver: true,
        newsletter: false,
        phone: '555-1234',
        emergencyName: 'Jane Doe',
        dietaryRestrictions: 'Vegetarian',
        role: 'swimmer',
      };

      expect(createDataWithOptionals.phone).toBe('555-1234');
      expect(createDataWithOptionals.emergencyName).toBe('Jane Doe');
      expect(createDataWithOptionals.dietaryRestrictions).toBe('Vegetarian');
      expect(createDataWithOptionals.role).toBe('swimmer');
    });
  });

  describe('ULID Validation', () => {
    it('should validate participantId as ULID format', () => {
      const participantIdAttr = ParticipantEntity.schema.attributes.participantId;
      const validULID = generateULID();

      expect(() => participantIdAttr.validate(validULID)).not.toThrow();
      expect(() => participantIdAttr.validate('invalid-id')).toThrow('participantId must be a valid ULID format');
      expect(() => participantIdAttr.validate('part_123')).toThrow('participantId must be a valid ULID format');
      expect(() => participantIdAttr.validate('')).toThrow('participantId must be a valid ULID format');
    });

    it('should validate reservationId as ULID format', () => {
      const reservationIdAttr = ParticipantEntity.schema.attributes.reservationId;
      const validULID = generateULID();

      expect(() => reservationIdAttr.validate(validULID)).not.toThrow();
      expect(() => reservationIdAttr.validate('invalid-id')).toThrow('reservationId must be a valid ULID format');
      expect(() => reservationIdAttr.validate('res_123')).toThrow('reservationId must be a valid ULID format');
      expect(() => reservationIdAttr.validate('')).toThrow('reservationId must be a valid ULID format');
    });

    it('should validate eventId as ULID format', () => {
      const eventIdAttr = ParticipantEntity.schema.attributes.eventId;
      const validULID = generateULID();

      expect(() => eventIdAttr.validate(validULID)).not.toThrow();
      expect(() => eventIdAttr.validate('invalid-id')).toThrow('eventId must be a valid ULID format');
      expect(() => eventIdAttr.validate('event_123')).toThrow('eventId must be a valid ULID format');
      expect(() => eventIdAttr.validate('')).toThrow('eventId must be a valid ULID format');
    });

    it('should generate and validate ULID consistency', () => {
      const participantId = generateULID();
      const reservationId = generateULID();
      const eventId = generateULID();

      expect(isValidULID(participantId)).toBe(true);
      expect(isValidULID(reservationId)).toBe(true);
      expect(isValidULID(eventId)).toBe(true);

      // Test that generated ULIDs are different
      expect(participantId).not.toBe(reservationId);
      expect(participantId).not.toBe(eventId);
      expect(reservationId).not.toBe(eventId);
    });
  });
});
