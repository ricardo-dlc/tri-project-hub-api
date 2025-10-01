import { RegistrationEntity, CreateRegistrationData } from '../registration.model';

// Mock the DynamoDB client
jest.mock('../../../../shared/utils/dynamo', () => ({
  ddbDocClient: {
    send: jest.fn(),
  },
}));

describe('RegistrationEntity', () => {
  const mockRegistrationData: CreateRegistrationData = {
    reservationId: 'res_123456789',
    eventId: 'event_123',
    registrationType: 'individual',
    totalParticipants: 1,
    registrationFee: 50.00,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Entity Configuration', () => {
    it('should have correct entity configuration', () => {
      expect(RegistrationEntity.schema.model.entity).toBe('registration');
      expect(RegistrationEntity.schema.model.version).toBe('1');
      expect(RegistrationEntity.schema.model.service).toBe('registrations');
    });
  });

  describe('Required Field Validation', () => {
    it('should validate reservationId as required', () => {
      const attributes = RegistrationEntity.schema.attributes;
      expect(attributes.reservationId.required).toBe(true);
      expect(attributes.reservationId.type).toBe('string');
    });

    it('should validate eventId as required', () => {
      const attributes = RegistrationEntity.schema.attributes;
      expect(attributes.eventId.required).toBe(true);
      expect(attributes.eventId.type).toBe('string');
    });

    it('should validate registrationType as required with enum validation', () => {
      const attributes = RegistrationEntity.schema.attributes;
      expect(attributes.registrationType.required).toBe(true);
      expect(attributes.registrationType.type).toBe('string');
      expect(attributes.registrationType.validate).toEqual(/^(individual|team)$/);
    });

    it('should validate totalParticipants as required number', () => {
      const attributes = RegistrationEntity.schema.attributes;
      expect(attributes.totalParticipants.required).toBe(true);
      expect(attributes.totalParticipants.type).toBe('number');
    });

    it('should validate registrationFee as required number', () => {
      const attributes = RegistrationEntity.schema.attributes;
      expect(attributes.registrationFee.required).toBe(true);
      expect(attributes.registrationFee.type).toBe('number');
    });

    it('should have paymentStatus with default false', () => {
      const attributes = RegistrationEntity.schema.attributes;
      expect(attributes.paymentStatus.required).toBe(true);
      expect(attributes.paymentStatus.default).toBe(false);
      expect(attributes.paymentStatus.type).toBe('boolean');
    });
  });

  describe('GSI Attribute Generation', () => {
    it('should generate eventRegistrationId from eventId', () => {
      const attributes = RegistrationEntity.schema.attributes;
      const eventRegistrationId = attributes.eventRegistrationId;
      
      expect(eventRegistrationId.required).toBe(true);
      expect(eventRegistrationId.watch).toEqual(['eventId']);
      
      const result = eventRegistrationId.set(undefined, { eventId: 'event_123' });
      expect(result).toBe('event_123');
    });

    it('should generate registrationDate from createdAt', () => {
      const attributes = RegistrationEntity.schema.attributes;
      const registrationDate = attributes.registrationDate;
      
      expect(registrationDate.required).toBe(true);
      expect(registrationDate.watch).toEqual(['createdAt']);
      
      const result = registrationDate.set(undefined, { createdAt: '2024-01-01T00:00:00Z' });
      expect(result).toBe('2024-01-01T00:00:00Z');
    });

    it('should generate eventPaymentStatus from eventId and paymentStatus', () => {
      const attributes = RegistrationEntity.schema.attributes;
      const eventPaymentStatus = attributes.eventPaymentStatus;
      
      expect(eventPaymentStatus.required).toBe(true);
      expect(eventPaymentStatus.watch).toEqual(['eventId', 'paymentStatus']);
      
      const result = eventPaymentStatus.set(undefined, { 
        eventId: 'event_123', 
        paymentStatus: false 
      });
      expect(result).toBe('event_123#false');
    });

    it('should generate paymentDate from createdAt', () => {
      const attributes = RegistrationEntity.schema.attributes;
      const paymentDate = attributes.paymentDate;
      
      expect(paymentDate.required).toBe(true);
      expect(paymentDate.watch).toEqual(['createdAt']);
      
      const result = paymentDate.set(undefined, { createdAt: '2024-01-01T00:00:00Z' });
      expect(result).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('Index Configuration', () => {
    it('should have correct primary index configuration', () => {
      const indexes = RegistrationEntity.schema.indexes;
      const primaryIndex = indexes.RegistrationPrimaryIndex;
      
      expect(primaryIndex.pk.field).toBe('id');
      expect(primaryIndex.pk.composite).toEqual(['reservationId']);
    });

    it('should have correct EventRegistrationIndex configuration', () => {
      const indexes = RegistrationEntity.schema.indexes;
      const eventRegistrationIndex = indexes.EventRegistrationIndex;
      
      expect(eventRegistrationIndex.index).toBe('EventRegistrationIndex');
      expect(eventRegistrationIndex.pk.field).toBe('eventRegistrationId');
      expect(eventRegistrationIndex.pk.composite).toEqual(['eventRegistrationId']);
      expect(eventRegistrationIndex.sk.field).toBe('registrationDate');
      expect(eventRegistrationIndex.sk.composite).toEqual(['registrationDate']);
    });

    it('should have correct PaymentStatusIndex configuration', () => {
      const indexes = RegistrationEntity.schema.indexes;
      const paymentStatusIndex = indexes.PaymentStatusIndex;
      
      expect(paymentStatusIndex.index).toBe('PaymentStatusIndex');
      expect(paymentStatusIndex.pk.field).toBe('eventPaymentStatus');
      expect(paymentStatusIndex.pk.composite).toEqual(['eventPaymentStatus']);
      expect(paymentStatusIndex.sk.field).toBe('paymentDate');
      expect(paymentStatusIndex.sk.composite).toEqual(['paymentDate']);
    });
  });

  describe('Registration Type Validation', () => {
    it('should accept valid registration types', () => {
      const registrationTypeAttr = RegistrationEntity.schema.attributes.registrationType;
      const regex = registrationTypeAttr.validate as RegExp;
      
      expect(regex.test('individual')).toBe(true);
      expect(regex.test('team')).toBe(true);
    });

    it('should reject invalid registration types', () => {
      const registrationTypeAttr = RegistrationEntity.schema.attributes.registrationType;
      const regex = registrationTypeAttr.validate as RegExp;
      
      expect(regex.test('group')).toBe(false);
      expect(regex.test('solo')).toBe(false);
      expect(regex.test('')).toBe(false);
      expect(regex.test('INDIVIDUAL')).toBe(false);
    });
  });

  describe('Type Definitions', () => {
    it('should export correct CreateRegistrationData type', () => {
      // This test ensures the type is properly defined by attempting to use it
      const createData: CreateRegistrationData = {
        reservationId: 'res_123',
        eventId: 'event_123',
        registrationType: 'individual',
        totalParticipants: 1,
        registrationFee: 50.00,
      };
      
      expect(createData.reservationId).toBe('res_123');
      expect(createData.eventId).toBe('event_123');
      expect(createData.registrationType).toBe('individual');
      expect(createData.totalParticipants).toBe(1);
      expect(createData.registrationFee).toBe(50.00);
    });
  });
});