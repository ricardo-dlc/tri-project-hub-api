import { BadRequestError, ConflictError, NotFoundError, ValidationError } from '@/shared/errors';
import { generateParticipantId, isValidULID } from '@/shared/utils/ulid';
import { EventEntity } from '@/features/events/models/event.model';
import { ParticipantEntity } from '@/features/registrations/models/participant.model';
import { RegistrationEntity } from '@/features/registrations/models/registration.model';
import { capacityValidationService } from '../capacity-validation.service';
import { emailValidationService } from '../email-validation.service';
import { IndividualRegistrationData, IndividualRegistrationService } from '../individual-registration.service';
import { reservationIdService } from '../reservation-id.service';

// Mock all dependencies
jest.mock('../email-validation.service');
jest.mock('../capacity-validation.service');
jest.mock('../reservation-id.service');
jest.mock('@/features/registrations/models/registration.model');
jest.mock('@/features/registrations/models/participant.model');
jest.mock('@/features/events/models/event.model');
jest.mock('@/shared/utils/ulid');

describe('IndividualRegistrationService', () => {
  let service: IndividualRegistrationService;
  let mockEmailValidationService: jest.Mocked<typeof emailValidationService>;
  let mockCapacityValidationService: jest.Mocked<typeof capacityValidationService>;
  let mockReservationIdService: jest.Mocked<typeof reservationIdService>;
  let mockRegistrationEntity: jest.Mocked<typeof RegistrationEntity>;
  let mockParticipantEntity: jest.Mocked<typeof ParticipantEntity>;
  let mockEventEntity: jest.Mocked<typeof EventEntity>;
  let mockGenerateParticipantId: jest.MockedFunction<typeof generateParticipantId>;
  let mockIsValidULID: jest.MockedFunction<typeof isValidULID>;

  const validEventId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  const validReservationId = '01ARZ3NDEKTSV4RRFFQ69G5FBW';
  const validParticipantId = '01ARZ3NDEKTSV4RRFFQ69G5FBX';
  const mockTimestamp = '2024-01-01T00:00:00.000Z';

  const validParticipantData: IndividualRegistrationData = {
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    waiver: true,
    newsletter: false,
    phone: '+1234567890',
    dateOfBirth: '1990-01-01',
    gender: 'male',
    address: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zipCode: '12345',
    // country: 'USA',
    emergencyName: 'Jane Doe',
    emergencyRelationship: 'spouse',
    emergencyPhone: '+1234567891',
    // emergencyEmail: 'jane@example.com',
    // shirtSize: 'M',
    dietaryRestrictions: 'None',
    medicalConditions: 'None',
    medications: 'None',
    allergies: 'None',
  };

  const mockEvent = {
    id: validEventId,
    title: 'Test Event',
    isEnabled: true,
    isTeamEvent: false, // This is an individual event
    registrationDeadline: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    registrationFee: 50,
    maxParticipants: 100,
    currentParticipants: 10,
  };

  beforeEach(() => {
    service = new IndividualRegistrationService();

    // Reset all mocks
    jest.clearAllMocks();

    // Setup mocks
    mockEmailValidationService = emailValidationService as jest.Mocked<typeof emailValidationService>;
    mockCapacityValidationService = capacityValidationService as jest.Mocked<typeof capacityValidationService>;
    mockReservationIdService = reservationIdService as jest.Mocked<typeof reservationIdService>;
    mockRegistrationEntity = RegistrationEntity as jest.Mocked<typeof RegistrationEntity>;
    mockParticipantEntity = ParticipantEntity as jest.Mocked<typeof ParticipantEntity>;
    mockEventEntity = EventEntity as jest.Mocked<typeof EventEntity>;
    mockGenerateParticipantId = generateParticipantId as jest.MockedFunction<typeof generateParticipantId>;
    mockIsValidULID = isValidULID as jest.MockedFunction<typeof isValidULID>;

    // Default mock implementations
    mockIsValidULID.mockImplementation((id: string) => /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/.test(id));
    mockReservationIdService.generateReservationId.mockReturnValue({
      reservationId: validReservationId,
      timestamp: mockTimestamp,
    });
    mockGenerateParticipantId.mockReturnValue(validParticipantId);

    mockEventEntity.get = jest.fn().mockReturnValue({
      go: jest.fn().mockResolvedValue({ data: mockEvent }),
    });

    mockEventEntity.update = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({}),
      }),
    });

    mockRegistrationEntity.create = jest.fn().mockReturnValue({
      go: jest.fn().mockResolvedValue({ data: { reservationId: validReservationId } }),
    });

    mockParticipantEntity.create = jest.fn().mockReturnValue({
      go: jest.fn().mockResolvedValue({ data: { participantId: validParticipantId } }),
    });

    mockEmailValidationService.validateIndividualRegistration.mockResolvedValue();
    mockCapacityValidationService.validateIndividualRegistration.mockResolvedValue();
  });

  describe('registerIndividual', () => {
    it('should successfully register an individual with all valid data', async () => {
      const result = await service.registerIndividual(validEventId, validParticipantData);

      expect(result).toEqual({
        reservationId: validReservationId,
        participantId: validParticipantId,
        eventId: validEventId,
        email: validParticipantData.email,
        paymentStatus: false,
        registrationFee: mockEvent.registrationFee,
        createdAt: expect.any(String),
      });

      // Verify all validation steps were called
      expect(mockEmailValidationService.validateIndividualRegistration).toHaveBeenCalledWith(
        validEventId,
        validParticipantData.email
      );
      expect(mockCapacityValidationService.validateIndividualRegistration).toHaveBeenCalledWith(validEventId);

      // Verify entities were created
      expect(mockRegistrationEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId: validReservationId,
          eventId: validEventId,
          registrationType: 'individual',
          totalParticipants: 1,
          registrationFee: mockEvent.registrationFee,
          paymentStatus: false,
        })
      );

      expect(mockParticipantEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          participantId: validParticipantId,
          reservationId: validReservationId,
          eventId: validEventId,
          email: validParticipantData.email,
          firstName: validParticipantData.firstName,
          lastName: validParticipantData.lastName,
          waiver: true,
        })
      );

      // Verify event participant count was updated
      expect(mockEventEntity.update).toHaveBeenCalledWith({ eventId: validEventId });
    });

    it('should successfully register with only required fields', async () => {
      const minimalData: IndividualRegistrationData = {
        email: 'minimal@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        waiver: true,
        newsletter: true,
      };

      const result = await service.registerIndividual(validEventId, minimalData);

      expect(result).toEqual({
        reservationId: validReservationId,
        participantId: validParticipantId,
        eventId: validEventId,
        email: minimalData.email,
        paymentStatus: false,
        registrationFee: mockEvent.registrationFee,
        createdAt: expect.any(String),
      });

      expect(mockParticipantEntity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: minimalData.email,
          firstName: minimalData.firstName,
          lastName: minimalData.lastName,
          waiver: true,
          newsletter: true,
          // Optional fields should be undefined
          phone: undefined,
          address: undefined,
        })
      );
    });

    describe('Input Validation', () => {
      it('should throw BadRequestError for invalid event ID format', async () => {
        const invalidEventId = 'invalid-id';
        mockIsValidULID.mockReturnValue(false);

        await expect(service.registerIndividual(invalidEventId, validParticipantData))
          .rejects.toThrow(BadRequestError);
        await expect(service.registerIndividual(invalidEventId, validParticipantData))
          .rejects.toThrow('Invalid event ID format. Must be a valid ULID.');
      });

      it('should throw ValidationError for missing required fields', async () => {
        const incompleteData = {
          ...validParticipantData,
          firstName: '',
          lastName: undefined as any,
        };

        await expect(service.registerIndividual(validEventId, incompleteData))
          .rejects.toThrow(ValidationError);
        await expect(service.registerIndividual(validEventId, incompleteData))
          .rejects.toThrow('Missing required fields: firstName, lastName');
      });

      it('should throw ValidationError for invalid email format', async () => {
        const invalidEmailData = {
          ...validParticipantData,
          email: 'invalid-email',
        };

        await expect(service.registerIndividual(validEventId, invalidEmailData))
          .rejects.toThrow(ValidationError);
        await expect(service.registerIndividual(validEventId, invalidEmailData))
          .rejects.toThrow('Invalid email format');
      });

      it('should throw ValidationError when waiver is not accepted', async () => {
        const noWaiverData = {
          ...validParticipantData,
          waiver: false,
        };

        await expect(service.registerIndividual(validEventId, noWaiverData))
          .rejects.toThrow(ValidationError);
        await expect(service.registerIndividual(validEventId, noWaiverData))
          .rejects.toThrow('Waiver must be accepted to complete registration');
      });

      // Emergency email validation is now commented out
      // it('should throw ValidationError for invalid emergency email format', async () => {
      //   const invalidEmergencyEmailData = {
      //     ...validParticipantData,
      //     emergencyEmail: 'invalid-emergency-email',
      //   };

      //   await expect(service.registerIndividual(validEventId, invalidEmergencyEmailData))
      //     .rejects.toThrow(ValidationError);
      //   await expect(service.registerIndividual(validEventId, invalidEmergencyEmailData))
      //     .rejects.toThrow('Invalid emergency contact email format');
      // });
    });

    describe('Event Validation', () => {
      it('should throw NotFoundError when event does not exist', async () => {
        mockEventEntity.get = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: null }),
        });

        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow(NotFoundError);
        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow(`Event with ID ${validEventId} not found`);
      });

      it('should throw ConflictError when event is disabled', async () => {
        const disabledEvent = { ...mockEvent, isEnabled: false };
        mockEventEntity.get = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: disabledEvent }),
        });

        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow(ConflictError);
        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow('Event is currently disabled and not accepting registrations');
      });

      it('should throw ConflictError when registration deadline has passed', async () => {
        const expiredEvent = {
          ...mockEvent,
          registrationDeadline: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        };
        mockEventEntity.get = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: expiredEvent }),
        });

        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow(ConflictError);
        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow('Registration deadline has passed for this event');
      });

      it('should throw ConflictError when event is configured for team registration', async () => {
        const teamEvent = { ...mockEvent, isTeamEvent: true };
        mockEventEntity.get = jest.fn().mockReturnValue({
          go: jest.fn().mockResolvedValue({ data: teamEvent }),
        });

        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow(ConflictError);
        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow('Registration type mismatch. This event is configured for team registration only.');
      });
    });

    describe('Email Validation', () => {
      it('should throw ConflictError when email is already registered', async () => {
        mockEmailValidationService.validateIndividualRegistration.mockRejectedValue(
          new ConflictError('Email test@example.com is already registered for this event')
        );

        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow(ConflictError);
        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow('Email test@example.com is already registered for this event');
      });
    });

    describe('Capacity Validation', () => {
      it('should throw ConflictError when event is at capacity', async () => {
        mockCapacityValidationService.validateIndividualRegistration.mockRejectedValue(
          new ConflictError('Event is at maximum capacity')
        );

        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow(ConflictError);
        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow('Event is at maximum capacity');
      });
    });

    describe('ULID Generation and Validation', () => {
      it('should generate valid ULID identifiers for reservation and participant', async () => {
        await service.registerIndividual(validEventId, validParticipantData);

        // Verify ULID generation was called for both reservation and participant
        expect(mockReservationIdService.generateReservationId).toHaveBeenCalledTimes(1);
        expect(mockGenerateParticipantId).toHaveBeenCalledTimes(1);

        // Verify the generated IDs were used in entity creation
        expect(mockRegistrationEntity.create).toHaveBeenCalledWith(
          expect.objectContaining({
            reservationId: validReservationId,
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          })
        );

        expect(mockParticipantEntity.create).toHaveBeenCalledWith(
          expect.objectContaining({
            participantId: validParticipantId,
            reservationId: validReservationId,
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          })
        );
      });

      it('should validate ULID format for event ID', async () => {
        await service.registerIndividual(validEventId, validParticipantData);

        expect(mockIsValidULID).toHaveBeenCalledWith(validEventId);
      });
    });

    describe('Error Scenarios', () => {
      it('should handle database errors during entity creation', async () => {
        mockRegistrationEntity.create = jest.fn().mockReturnValue({
          go: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        });

        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow('Failed to create registration entities');
      });

      it('should handle errors during participant count update', async () => {
        mockEventEntity.update = jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            go: jest.fn().mockRejectedValue(new Error('Update failed')),
          }),
        });

        await expect(service.registerIndividual(validEventId, validParticipantData))
          .rejects.toThrow('Failed to update event participant count');
      });
    });
  });

  describe('validateIndividualRegistration', () => {
    it('should return true for valid registration data', async () => {
      const result = await service.validateIndividualRegistration(validEventId, validParticipantData);

      expect(result).toBe(true);
      expect(mockEmailValidationService.validateIndividualRegistration).toHaveBeenCalledWith(
        validEventId,
        validParticipantData.email
      );
      expect(mockCapacityValidationService.validateIndividualRegistration).toHaveBeenCalledWith(validEventId);
    });

    it('should throw same validation errors as registerIndividual without creating entities', async () => {
      mockEmailValidationService.validateIndividualRegistration.mockRejectedValue(
        new ConflictError('Email already registered')
      );

      await expect(service.validateIndividualRegistration(validEventId, validParticipantData))
        .rejects.toThrow(ConflictError);

      // Verify no entities were created
      expect(mockRegistrationEntity.create).not.toHaveBeenCalled();
      expect(mockParticipantEntity.create).not.toHaveBeenCalled();
      expect(mockEventEntity.update).not.toHaveBeenCalled();
    });

    it('should validate input data format', async () => {
      const invalidData = {
        ...validParticipantData,
        email: 'invalid-email',
      };

      await expect(service.validateIndividualRegistration(validEventId, invalidData))
        .rejects.toThrow(ValidationError);
    });
  });
});
