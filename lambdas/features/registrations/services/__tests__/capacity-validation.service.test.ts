import { ConflictError, NotFoundError } from '../../../../shared/errors';
import { CapacityValidationService } from '../capacity-validation.service';

// Mock the EventEntity
jest.mock('../../../events/models/event.model', () => ({
  EventEntity: {
    get: jest.fn(),
  },
}));

// Import after mocking
import { EventEntity } from '../../../events/models/event.model';

const mockEventEntity = EventEntity as jest.Mocked<typeof EventEntity>;

describe('CapacityValidationService', () => {
  let capacityValidationService: CapacityValidationService;
  const mockGo = jest.fn();

  beforeEach(() => {
    capacityValidationService = new CapacityValidationService();
    jest.clearAllMocks();
    // Setup the mock chain
    (mockEventEntity.get as jest.Mock).mockReturnValue({
      go: mockGo,
    });
  });

  describe('validateCapacity', () => {
    const mockEvent = {
      id: 'event-123',
      maxParticipants: 100,
      currentParticipants: 50,
      isEnabled: true,
      registrationDeadline: '2024-12-31T23:59:59Z',
    };

    it('should return valid result when sufficient capacity is available', async () => {
      // Arrange
      const eventId = 'event-123';
      const requestedParticipants = 10;

      mockGo.mockResolvedValue({ data: mockEvent });

      // Act
      const result = await capacityValidationService.validateCapacity(eventId, requestedParticipants);

      // Assert
      expect(result).toEqual({
        isValid: true,
        maxParticipants: 100,
        currentParticipants: 50,
        requestedParticipants: 10,
        availableSpots: 50,
      });
      expect(mockEventEntity.get).toHaveBeenCalledWith({ id: eventId });
    });

    it('should return invalid result when insufficient capacity', async () => {
      // Arrange
      const eventId = 'event-123';
      const requestedParticipants = 60; // More than available spots (50)

      mockGo.mockResolvedValue({ data: mockEvent });

      // Act
      const result = await capacityValidationService.validateCapacity(eventId, requestedParticipants);

      // Assert
      expect(result).toEqual({
        isValid: false,
        maxParticipants: 100,
        currentParticipants: 50,
        requestedParticipants: 60,
        availableSpots: 50,
      });
    });

    it('should handle exact capacity match', async () => {
      // Arrange
      const eventId = 'event-123';
      const requestedParticipants = 50; // Exactly the available spots

      mockGo.mockResolvedValue({ data: mockEvent });

      // Act
      const result = await capacityValidationService.validateCapacity(eventId, requestedParticipants);

      // Assert
      expect(result).toEqual({
        isValid: true,
        maxParticipants: 100,
        currentParticipants: 50,
        requestedParticipants: 50,
        availableSpots: 50,
      });
    });

    it('should handle event at full capacity', async () => {
      // Arrange
      const eventId = 'event-123';
      const requestedParticipants = 1;
      const fullEvent = { ...mockEvent, currentParticipants: 100 };

      mockGo.mockResolvedValue({ data: fullEvent });

      // Act
      const result = await capacityValidationService.validateCapacity(eventId, requestedParticipants);

      // Assert
      expect(result).toEqual({
        isValid: false,
        maxParticipants: 100,
        currentParticipants: 100,
        requestedParticipants: 1,
        availableSpots: 0,
      });
    });

    it('should throw error for zero or negative requested participants', async () => {
      // Arrange
      const eventId = 'event-123';

      // Act & Assert
      await expect(capacityValidationService.validateCapacity(eventId, 0))
        .rejects.toThrow('Requested participants must be greater than 0');

      await expect(capacityValidationService.validateCapacity(eventId, -5))
        .rejects.toThrow('Requested participants must be greater than 0');
    });

    it('should throw NotFoundError when event does not exist', async () => {
      // Arrange
      const eventId = 'non-existent-event';
      const requestedParticipants = 1;

      mockGo.mockResolvedValue({ data: null });

      // Act & Assert
      await expect(capacityValidationService.validateCapacity(eventId, requestedParticipants))
        .rejects.toThrow(NotFoundError);

      try {
        await capacityValidationService.validateCapacity(eventId, requestedParticipants);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
        expect((error as NotFoundError).message).toBe(`Event with ID ${eventId} not found`);
      }
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const eventId = 'event-123';
      const requestedParticipants = 1;

      mockGo.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(capacityValidationService.validateCapacity(eventId, requestedParticipants))
        .rejects.toThrow('Failed to validate event capacity: Database connection failed');
    });

    it('should handle edge case with zero max participants', async () => {
      // Arrange
      const eventId = 'event-123';
      const requestedParticipants = 1;
      const zeroCapacityEvent = { ...mockEvent, maxParticipants: 0, currentParticipants: 0 };

      mockGo.mockResolvedValue({ data: zeroCapacityEvent });

      // Act
      const result = await capacityValidationService.validateCapacity(eventId, requestedParticipants);

      // Assert
      expect(result).toEqual({
        isValid: false,
        maxParticipants: 0,
        currentParticipants: 0,
        requestedParticipants: 1,
        availableSpots: 0,
      });
    });

    it('should handle large team registration requests', async () => {
      // Arrange
      const eventId = 'event-123';
      const requestedParticipants = 25; // Large team
      const largeCapacityEvent = { ...mockEvent, maxParticipants: 200, currentParticipants: 10 };

      mockGo.mockResolvedValue({ data: largeCapacityEvent });

      // Act
      const result = await capacityValidationService.validateCapacity(eventId, requestedParticipants);

      // Assert
      expect(result).toEqual({
        isValid: true,
        maxParticipants: 200,
        currentParticipants: 10,
        requestedParticipants: 25,
        availableSpots: 190,
      });
    });
  });

  describe('validateIndividualRegistration', () => {
    const mockEvent = {
      id: 'event-123',
      maxParticipants: 100,
      currentParticipants: 50,
      isEnabled: true,
      registrationDeadline: '2024-12-31T23:59:59Z',
    };

    it('should not throw when capacity is available for individual registration', async () => {
      // Arrange
      const eventId = 'event-123';

      mockGo.mockResolvedValue({ data: mockEvent });

      // Act & Assert
      await expect(capacityValidationService.validateIndividualRegistration(eventId))
        .resolves.not.toThrow();
    });

    it('should throw ConflictError when event is at capacity', async () => {
      // Arrange
      const eventId = 'event-123';
      const fullEvent = { ...mockEvent, currentParticipants: 100 };

      mockGo.mockResolvedValue({ data: fullEvent });

      // Act & Assert
      await expect(capacityValidationService.validateIndividualRegistration(eventId))
        .rejects.toThrow(ConflictError);

      try {
        await capacityValidationService.validateIndividualRegistration(eventId);
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        expect((error as ConflictError).message).toBe(
          'Event is at maximum capacity. Available spots: 0, requested: 1'
        );
        expect((error as ConflictError).details).toEqual({
          eventId,
          maxParticipants: 100,
          currentParticipants: 100,
          requestedParticipants: 1,
          availableSpots: 0,
        });
      }
    });

    it('should throw NotFoundError when event does not exist', async () => {
      // Arrange
      const eventId = 'non-existent-event';

      mockGo.mockResolvedValue({ data: null });

      // Act & Assert
      await expect(capacityValidationService.validateIndividualRegistration(eventId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('validateTeamRegistration', () => {
    const mockEvent = {
      id: 'event-123',
      maxParticipants: 100,
      currentParticipants: 50,
      isEnabled: true,
      registrationDeadline: '2024-12-31T23:59:59Z',
    };

    it('should not throw when capacity is available for team registration', async () => {
      // Arrange
      const eventId = 'event-123';
      const teamSize = 5;

      mockGo.mockResolvedValue({ data: mockEvent });

      // Act & Assert
      await expect(capacityValidationService.validateTeamRegistration(eventId, teamSize))
        .resolves.not.toThrow();
    });

    it('should throw ConflictError when insufficient capacity for team', async () => {
      // Arrange
      const eventId = 'event-123';
      const teamSize = 60; // More than available spots (50)

      mockGo.mockResolvedValue({ data: mockEvent });

      // Act & Assert
      await expect(capacityValidationService.validateTeamRegistration(eventId, teamSize))
        .rejects.toThrow(ConflictError);

      try {
        await capacityValidationService.validateTeamRegistration(eventId, teamSize);
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        expect((error as ConflictError).message).toBe(
          'Event does not have sufficient capacity for team registration. Available spots: 50, team size: 60'
        );
        expect((error as ConflictError).details).toEqual({
          eventId,
          maxParticipants: 100,
          currentParticipants: 50,
          requestedParticipants: 60,
          availableSpots: 50,
          teamSize: 60,
        });
      }
    });

    it('should handle exact capacity match for team registration', async () => {
      // Arrange
      const eventId = 'event-123';
      const teamSize = 50; // Exactly the available spots

      mockGo.mockResolvedValue({ data: mockEvent });

      // Act & Assert
      await expect(capacityValidationService.validateTeamRegistration(eventId, teamSize))
        .resolves.not.toThrow();
    });

    it('should handle single member team registration', async () => {
      // Arrange
      const eventId = 'event-123';
      const teamSize = 1;

      mockGo.mockResolvedValue({ data: mockEvent });

      // Act & Assert
      await expect(capacityValidationService.validateTeamRegistration(eventId, teamSize))
        .resolves.not.toThrow();
    });

    it('should throw NotFoundError when event does not exist', async () => {
      // Arrange
      const eventId = 'non-existent-event';
      const teamSize = 5;

      mockGo.mockResolvedValue({ data: null });

      // Act & Assert
      await expect(capacityValidationService.validateTeamRegistration(eventId, teamSize))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('isEventAvailableForRegistration', () => {
    const baseEvent = {
      id: 'event-123',
      maxParticipants: 100,
      currentParticipants: 50,
      isEnabled: true,
      registrationDeadline: '2024-12-31T23:59:59Z',
    };

    beforeEach(() => {
      // Mock current date to be before registration deadline
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true when event is enabled and registration is open', async () => {
      // Arrange
      const eventId = 'event-123';

      mockGo.mockResolvedValue({ data: baseEvent });

      // Act
      const result = await capacityValidationService.isEventAvailableForRegistration(eventId);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when event is disabled', async () => {
      // Arrange
      const eventId = 'event-123';
      const disabledEvent = { ...baseEvent, isEnabled: false };

      mockGo.mockResolvedValue({ data: disabledEvent });

      // Act
      const result = await capacityValidationService.isEventAvailableForRegistration(eventId);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when registration deadline has passed', async () => {
      // Arrange
      const eventId = 'event-123';
      const expiredEvent = { ...baseEvent, registrationDeadline: '2024-01-01T23:59:59Z' };

      mockGo.mockResolvedValue({ data: expiredEvent });

      // Act
      const result = await capacityValidationService.isEventAvailableForRegistration(eventId);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when event is disabled and deadline has passed', async () => {
      // Arrange
      const eventId = 'event-123';
      const unavailableEvent = {
        ...baseEvent,
        isEnabled: false,
        registrationDeadline: '2024-01-01T23:59:59Z',
      };

      mockGo.mockResolvedValue({ data: unavailableEvent });

      // Act
      const result = await capacityValidationService.isEventAvailableForRegistration(eventId);

      // Assert
      expect(result).toBe(false);
    });

    it('should throw NotFoundError when event does not exist', async () => {
      // Arrange
      const eventId = 'non-existent-event';

      mockGo.mockResolvedValue({ data: null });

      // Act & Assert
      await expect(capacityValidationService.isEventAvailableForRegistration(eventId))
        .rejects.toThrow(NotFoundError);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const eventId = 'event-123';

      mockGo.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(capacityValidationService.isEventAvailableForRegistration(eventId))
        .rejects.toThrow('Failed to check event availability: Database error');
    });

    it('should handle edge case with registration deadline exactly at current time', async () => {
      // Arrange
      const eventId = 'event-123';
      const currentTime = '2024-06-01T12:00:00Z';
      const exactDeadlineEvent = { ...baseEvent, registrationDeadline: currentTime };

      jest.setSystemTime(new Date(currentTime));
      mockGo.mockResolvedValue({ data: exactDeadlineEvent });

      // Act
      const result = await capacityValidationService.isEventAvailableForRegistration(eventId);

      // Assert
      expect(result).toBe(true); // Should be available when deadline is exactly at current time
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle event with 1 max participant and 0 current participants', async () => {
      // Arrange
      const eventId = 'event-123';
      const requestedParticipants = 1;
      const smallEvent = {
        id: 'event-123',
        maxParticipants: 1,
        currentParticipants: 0,
        isEnabled: true,
        registrationDeadline: '2024-12-31T23:59:59Z',
      };

      mockGo.mockResolvedValue({ data: smallEvent });

      // Act
      const result = await capacityValidationService.validateCapacity(eventId, requestedParticipants);

      // Assert
      expect(result).toEqual({
        isValid: true,
        maxParticipants: 1,
        currentParticipants: 0,
        requestedParticipants: 1,
        availableSpots: 1,
      });
    });

    it('should handle event with very large capacity', async () => {
      // Arrange
      const eventId = 'event-123';
      const requestedParticipants = 1000;
      const largeEvent = {
        id: 'event-123',
        maxParticipants: 10000,
        currentParticipants: 5000,
        isEnabled: true,
        registrationDeadline: '2024-12-31T23:59:59Z',
      };

      mockGo.mockResolvedValue({ data: largeEvent });

      // Act
      const result = await capacityValidationService.validateCapacity(eventId, requestedParticipants);

      // Assert
      expect(result).toEqual({
        isValid: true,
        maxParticipants: 10000,
        currentParticipants: 5000,
        requestedParticipants: 1000,
        availableSpots: 5000,
      });
    });

    it('should handle requesting exactly one more than available spots', async () => {
      // Arrange
      const eventId = 'event-123';
      const requestedParticipants = 51; // One more than available (50)
      const mockEvent = {
        id: 'event-123',
        maxParticipants: 100,
        currentParticipants: 50,
        isEnabled: true,
        registrationDeadline: '2024-12-31T23:59:59Z',
      };

      mockGo.mockResolvedValue({ data: mockEvent });

      // Act
      const result = await capacityValidationService.validateCapacity(eventId, requestedParticipants);

      // Assert
      expect(result).toEqual({
        isValid: false,
        maxParticipants: 100,
        currentParticipants: 50,
        requestedParticipants: 51,
        availableSpots: 50,
      });
    });
  });
});
