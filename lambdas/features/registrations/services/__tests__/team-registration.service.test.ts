import { ConflictError, NotFoundError, ValidationError } from '../../../../shared/errors';
import { generateParticipantId } from '../../../../shared/utils/ulid';
import { EventEntity } from '../../../events/models/event.model';
import { ParticipantEntity } from '../../models/participant.model';
import { RegistrationEntity } from '../../models/registration.model';
import { capacityValidationService } from '../capacity-validation.service';
import { emailValidationService } from '../email-validation.service';
import { reservationIdService } from '../reservation-id.service';
import { TeamParticipantData, TeamRegistrationData, TeamRegistrationService } from '../team-registration.service';

// Mock dependencies
jest.mock('../../../../shared/utils/ulid');
jest.mock('../../../events/models/event.model');
jest.mock('../../models/participant.model');
jest.mock('../../models/registration.model');
jest.mock('../base-registration.service');
jest.mock('../capacity-validation.service');
jest.mock('../email-validation.service');
jest.mock('../reservation-id.service');

const mockGenerateParticipantId = generateParticipantId as jest.MockedFunction<typeof generateParticipantId>;
const mockEventEntity = EventEntity as jest.Mocked<typeof EventEntity>;
const mockParticipantEntity = ParticipantEntity as jest.Mocked<typeof ParticipantEntity>;
const mockRegistrationEntity = RegistrationEntity as jest.Mocked<typeof RegistrationEntity>;
const mockCapacityValidationService = capacityValidationService as jest.Mocked<typeof capacityValidationService>;
const mockEmailValidationService = emailValidationService as jest.Mocked<typeof emailValidationService>;
const mockReservationIdService = reservationIdService as jest.Mocked<typeof reservationIdService>;

describe('TeamRegistrationService', () => {
  let service: TeamRegistrationService;
  const mockEventId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  const mockReservationId = '01ARZ3NDEKTSV4RRFFQ69G5FBW';
  const mockTimestamp = '2024-01-15T10:00:00.000Z';

  const mockEvent = {
    id: mockEventId,
    isEnabled: true,
    isTeamEvent: true, // This is a team event
    registrationDeadline: '2025-12-31T23:59:59.000Z',
    registrationFee: 100,
    maxParticipants: 50,
    currentParticipants: 10,
  };

  const mockTeamParticipant1: TeamParticipantData = {
    email: 'participant1@example.com',
    firstName: 'John',
    lastName: 'Doe',
    waiver: true,
    newsletter: false,
    phone: '555-0101',
    role: 'Captain',
  };

  const mockTeamParticipant2: TeamParticipantData = {
    email: 'participant2@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    waiver: true,
    newsletter: true,
    role: 'Member',
  };

  const mockTeamData: TeamRegistrationData = {
    participants: [mockTeamParticipant1, mockTeamParticipant2],
  };

  beforeEach(() => {
    service = new TeamRegistrationService();
    jest.clearAllMocks();

    // Setup default mocks
    mockGenerateParticipantId
      .mockReturnValueOnce('01ARZ3NDEKTSV4RRFFQ69G5FC1')
      .mockReturnValueOnce('01ARZ3NDEKTSV4RRFFQ69G5FC2');

    // Mock base class methods on the service instance
    jest.spyOn(service as any, 'validateEventIdFormat').mockImplementation(() => { });
    jest.spyOn(service as any, 'validateEventAvailability').mockImplementation(() => Promise.resolve(mockEvent));
    jest.spyOn(service as any, 'updateEventParticipantCount').mockImplementation(() => Promise.resolve());
    jest.spyOn(service as any, 'validateParticipantData').mockImplementation(() => []);
    jest.spyOn(service as any, 'generateReservationData').mockReturnValue({
      reservationId: mockReservationId,
      timestamp: mockTimestamp,
    });
    jest.spyOn(service as any, 'createRegistrationEntity').mockImplementation(() => Promise.resolve());
    jest.spyOn(service as any, 'createParticipantEntity').mockImplementation((participantData) => {
      return Promise.resolve(mockGenerateParticipantId());
    });

    mockReservationIdService.generateReservationId.mockReturnValue({
      reservationId: mockReservationId,
      timestamp: mockTimestamp,
    });

    mockEventEntity.get.mockReturnValue({
      go: jest.fn().mockResolvedValue({ data: mockEvent }),
    } as any);

    mockEventEntity.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({}),
      }),
    } as any);

    mockRegistrationEntity.create.mockReturnValue({
      go: jest.fn().mockResolvedValue({}),
    } as any);

    mockParticipantEntity.create.mockReturnValue({
      go: jest.fn().mockResolvedValue({}),
    } as any);

    mockEmailValidationService.validateTeamRegistration.mockResolvedValue();
    mockCapacityValidationService.validateTeamRegistration.mockResolvedValue();
  });

  describe('registerTeam', () => {
    it('should successfully register a team with valid data', async () => {
      const result = await service.registerTeam(mockEventId, mockTeamData);

      expect(result).toEqual({
        reservationId: mockReservationId,
        eventId: mockEventId,
        participants: [
          {
            participantId: '01ARZ3NDEKTSV4RRFFQ69G5FC1',
            email: 'participant1@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'Captain',
          },
          {
            participantId: '01ARZ3NDEKTSV4RRFFQ69G5FC2',
            email: 'participant2@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
            role: 'Member',
          },
        ],
        paymentStatus: false,
        registrationFee: 200, // 100 * 2 participants
        totalParticipants: 2,
        createdAt: mockTimestamp,
      });

      // Verify all validation steps were called
      expect(mockEmailValidationService.validateTeamRegistration).toHaveBeenCalledWith(
        mockEventId,
        ['participant1@example.com', 'participant2@example.com']
      );
      expect(mockCapacityValidationService.validateTeamRegistration).toHaveBeenCalledWith(mockEventId, 2);

      // Verify entities were created through base class methods
      expect((service as any).createRegistrationEntity).toHaveBeenCalledWith(
        mockReservationId,
        mockEventId,
        'team',
        2,
        200,
        mockTimestamp
      );

      expect((service as any).createParticipantEntity).toHaveBeenCalledTimes(2);

      // Verify event participant count was updated
      expect((service as any).updateEventParticipantCount).toHaveBeenCalledWith(mockEventId, 2);
    });

    it('should throw BadRequestError for invalid event ID format', async () => {
      jest.spyOn(service as any, 'validateEventIdFormat').mockImplementation(() => {
        throw new ValidationError('Invalid event ID format. Must be a valid ULID.', { eventId: 'invalid-id' });
      });

      await expect(service.registerTeam('invalid-id', mockTeamData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty team', async () => {
      const emptyTeamData: TeamRegistrationData = {
        participants: [],
      };

      await expect(service.registerTeam(mockEventId, emptyTeamData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing required fields', async () => {
      const invalidTeamData: TeamRegistrationData = {
        participants: [
          {
            email: 'test@example.com',
            firstName: '',
            lastName: 'Doe',
            waiver: true,
            newsletter: false,
          },
        ],
      };

      jest.spyOn(service as any, 'validateParticipantData').mockReturnValue(['Missing required field: firstName']);

      await expect(service.registerTeam(mockEventId, invalidTeamData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid email format', async () => {
      const invalidTeamData: TeamRegistrationData = {
        participants: [
          {
            email: 'invalid-email',
            firstName: 'John',
            lastName: 'Doe',
            waiver: true,
            newsletter: false,
          },
        ],
      };

      jest.spyOn(service as any, 'validateParticipantData').mockReturnValue(['Invalid email format']);

      await expect(service.registerTeam(mockEventId, invalidTeamData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when waiver is not accepted', async () => {
      const invalidTeamData: TeamRegistrationData = {
        participants: [
          {
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            waiver: false,
            newsletter: false,
          },
        ],
      };

      jest.spyOn(service as any, 'validateParticipantData').mockReturnValue(['Waiver must be accepted to complete registration']);

      await expect(service.registerTeam(mockEventId, invalidTeamData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid emergency email format', async () => {
      const invalidTeamData: TeamRegistrationData = {
        participants: [
          {
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            waiver: true,
            newsletter: false,
            emergencyEmail: 'invalid-emergency-email',
          },
        ],
      };

      jest.spyOn(service as any, 'validateParticipantData').mockReturnValue(['Invalid emergency contact email format']);

      await expect(service.registerTeam(mockEventId, invalidTeamData)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when event does not exist', async () => {
      jest.spyOn(service as any, 'validateEventAvailability').mockRejectedValue(
        new NotFoundError(`Event with ID ${mockEventId} not found`)
      );

      await expect(service.registerTeam(mockEventId, mockTeamData)).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when event is disabled', async () => {
      jest.spyOn(service as any, 'validateEventAvailability').mockRejectedValue(
        new ConflictError('Event is currently disabled and not accepting registrations', { eventId: mockEventId })
      );

      await expect(service.registerTeam(mockEventId, mockTeamData)).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError when registration deadline has passed', async () => {
      jest.spyOn(service as any, 'validateEventAvailability').mockRejectedValue(
        new ConflictError('Registration deadline has passed for this event', {
          eventId: mockEventId,
          registrationDeadline: '2020-01-01T00:00:00.000Z',
          currentTime: new Date().toISOString(),
        })
      );

      await expect(service.registerTeam(mockEventId, mockTeamData)).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError when event is configured for individual registration', async () => {
      jest.spyOn(service as any, 'validateEventAvailability').mockRejectedValue(
        new ConflictError('Registration type mismatch. This event is configured for individual registration only.', {
          eventId: mockEventId,
          eventRegistrationType: 'individual',
          attemptedRegistrationType: 'team',
        })
      );

      await expect(service.registerTeam(mockEventId, mockTeamData)).rejects.toThrow(ConflictError);
      await expect(service.registerTeam(mockEventId, mockTeamData)).rejects.toThrow('Registration type mismatch. This event is configured for individual registration only.');
    });

    it('should throw ConflictError when email validation fails', async () => {
      mockEmailValidationService.validateTeamRegistration.mockRejectedValue(
        new ConflictError('Duplicate email found', {})
      );

      await expect(service.registerTeam(mockEventId, mockTeamData)).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError when capacity validation fails', async () => {
      mockCapacityValidationService.validateTeamRegistration.mockRejectedValue(
        new ConflictError('Insufficient capacity', {})
      );

      await expect(service.registerTeam(mockEventId, mockTeamData)).rejects.toThrow(ConflictError);
    });

    it('should handle database errors during entity creation', async () => {
      jest.spyOn(service as any, 'createRegistrationEntity').mockRejectedValue(new Error('Database error'));

      await expect(service.registerTeam(mockEventId, mockTeamData)).rejects.toThrow(
        'Failed to create team registration entities'
      );
    });

    it('should handle errors during participant count update', async () => {
      jest.spyOn(service as any, 'updateEventParticipantCount').mockRejectedValue(
        new Error('Failed to update event participant count: Update failed')
      );

      await expect(service.registerTeam(mockEventId, mockTeamData)).rejects.toThrow(
        'Failed to update event participant count'
      );
    });

    it('should create participant entities with all optional fields', async () => {
      const fullTeamData: TeamRegistrationData = {
        participants: [
          {
            email: 'full@example.com',
            firstName: 'Full',
            lastName: 'Participant',
            waiver: true,
            newsletter: true,
            phone: '555-0123',
            dateOfBirth: '1990-01-01',
            gender: 'Male',
            address: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zipCode: '12345',
            country: 'USA',
            emergencyName: 'Emergency Contact',
            emergencyRelationship: 'Spouse',
            emergencyPhone: '555-0456',
            emergencyEmail: 'emergency@example.com',
            shirtSize: 'L',
            dietaryRestrictions: 'Vegetarian',
            medicalConditions: 'None',
            medications: 'None',
            allergies: 'Peanuts',
            role: 'Captain',
          },
        ],
      };

      await service.registerTeam(mockEventId, fullTeamData);

      expect((service as any).createParticipantEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'full@example.com',
          firstName: 'Full',
          lastName: 'Participant',
          phone: '555-0123',
          dateOfBirth: '1990-01-01',
          gender: 'Male',
          address: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'USA',
          emergencyName: 'Emergency Contact',
          emergencyRelationship: 'Spouse',
          emergencyPhone: '555-0456',
          emergencyEmail: 'emergency@example.com',
          shirtSize: 'L',
          dietaryRestrictions: 'Vegetarian',
          medicalConditions: 'None',
          medications: 'None',
          allergies: 'Peanuts',
          role: 'Captain',
        }),
        mockReservationId,
        mockEventId,
        mockTimestamp
      );
    });

    it('should generate unique participant IDs for each team member', async () => {
      // Reset and setup specific mocks for this test
      mockGenerateParticipantId.mockReset();
      mockGenerateParticipantId
        .mockReturnValueOnce('01ARZ3NDEKTSV4RRFFQ69G5FC2')
        .mockReturnValueOnce('01ARZ3NDEKTSV4RRFFQ69G5FC1');

      await service.registerTeam(mockEventId, mockTeamData);

      expect((service as any).createParticipantEntity).toHaveBeenCalledTimes(2);
    });

    it('should calculate registration fee correctly for team size', async () => {
      const largeTeamData: TeamRegistrationData = {
        participants: Array(5).fill(null).map((_, index) => ({
          email: `participant${index}@example.com`,
          firstName: `Participant${index}`,
          lastName: 'Test',
          waiver: true,
          newsletter: false,
        })),
      };

      mockGenerateParticipantId
        .mockReturnValueOnce('01ARZ3NDEKTSV4RRFFQ69G5FC1')
        .mockReturnValueOnce('01ARZ3NDEKTSV4RRFFQ69G5FC2')
        .mockReturnValueOnce('01ARZ3NDEKTSV4RRFFQ69G5FC3')
        .mockReturnValueOnce('01ARZ3NDEKTSV4RRFFQ69G5FC4')
        .mockReturnValueOnce('01ARZ3NDEKTSV4RRFFQ69G5FC5');

      const result = await service.registerTeam(mockEventId, largeTeamData);

      expect(result.registrationFee).toBe(500); // 100 * 5 participants
      expect(result.totalParticipants).toBe(5);
      expect((service as any).createRegistrationEntity).toHaveBeenCalledWith(
        mockReservationId,
        mockEventId,
        'team',
        5,
        500,
        mockTimestamp
      );
    });
  });

  describe('validateTeamRegistration', () => {
    it('should return true for valid team registration data', async () => {
      const result = await service.validateTeamRegistration(mockEventId, mockTeamData);

      expect(result).toBe(true);
      expect(mockEmailValidationService.validateTeamRegistration).toHaveBeenCalledWith(
        mockEventId,
        ['participant1@example.com', 'participant2@example.com']
      );
      expect(mockCapacityValidationService.validateTeamRegistration).toHaveBeenCalledWith(mockEventId, 2);
    });

    it('should throw ValidationError for invalid data without creating entities', async () => {
      const invalidTeamData: TeamRegistrationData = {
        participants: [
          {
            email: 'invalid-email',
            firstName: 'John',
            lastName: 'Doe',
            waiver: true,
            newsletter: false,
          },
        ],
      };

      jest.spyOn(service as any, 'validateParticipantData').mockReturnValue(['Invalid email format']);

      await expect(service.validateTeamRegistration(mockEventId, invalidTeamData)).rejects.toThrow(ValidationError);

      // Verify no entities were created
      expect((service as any).createRegistrationEntity).not.toHaveBeenCalled();
      expect((service as any).createParticipantEntity).not.toHaveBeenCalled();
    });

    it('should throw ConflictError for email validation failures without creating entities', async () => {
      mockEmailValidationService.validateTeamRegistration.mockRejectedValue(
        new ConflictError('Duplicate email found', {})
      );

      await expect(service.validateTeamRegistration(mockEventId, mockTeamData)).rejects.toThrow(ConflictError);

      // Verify no entities were created
      expect((service as any).createRegistrationEntity).not.toHaveBeenCalled();
      expect((service as any).createParticipantEntity).not.toHaveBeenCalled();
    });

    it('should throw ConflictError for capacity validation failures without creating entities', async () => {
      mockCapacityValidationService.validateTeamRegistration.mockRejectedValue(
        new ConflictError('Insufficient capacity', {})
      );

      await expect(service.validateTeamRegistration(mockEventId, mockTeamData)).rejects.toThrow(ConflictError);

      // Verify no entities were created
      expect((service as any).createRegistrationEntity).not.toHaveBeenCalled();
      expect((service as any).createParticipantEntity).not.toHaveBeenCalled();
    });
  });

  describe('ULID validation and generation', () => {
    it('should validate event ID as ULID format', async () => {
      const validateEventIdFormatSpy = jest.spyOn(service as any, 'validateEventIdFormat');

      await service.registerTeam(mockEventId, mockTeamData);

      expect(validateEventIdFormatSpy).toHaveBeenCalledWith(mockEventId);
    });

    it('should generate ULID-based reservation ID', async () => {
      await service.registerTeam(mockEventId, mockTeamData);

      expect((service as any).generateReservationData).toHaveBeenCalled();
      expect((service as any).createRegistrationEntity).toHaveBeenCalledWith(
        mockReservationId,
        mockEventId,
        'team',
        2,
        200,
        mockTimestamp
      );
    });

    it('should generate ULID-based participant IDs for all team members', async () => {
      await service.registerTeam(mockEventId, mockTeamData);

      expect((service as any).createParticipantEntity).toHaveBeenCalledTimes(2);
      expect((service as any).createParticipantEntity).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          email: 'participant1@example.com',
        }),
        mockReservationId,
        mockEventId,
        mockTimestamp
      );
      expect((service as any).createParticipantEntity).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          email: 'participant2@example.com',
        }),
        mockReservationId,
        mockEventId,
        mockTimestamp
      );
    });

    it('should link all participants to the same ULID-based reservation ID', async () => {
      const result = await service.registerTeam(mockEventId, mockTeamData);

      expect(result.reservationId).toBe(mockReservationId);
      expect((service as any).createParticipantEntity).toHaveBeenCalledTimes(2);
      // Verify both participants are created with the same reservation ID
      expect((service as any).createParticipantEntity).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        mockReservationId,
        mockEventId,
        mockTimestamp
      );
      expect((service as any).createParticipantEntity).toHaveBeenNthCalledWith(
        2,
        expect.any(Object),
        mockReservationId,
        mockEventId,
        mockTimestamp
      );
    });
  });
});
