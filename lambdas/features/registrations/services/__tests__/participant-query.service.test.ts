import { BadRequestError, NotFoundError } from '../../../../shared/errors';
import { ParticipantQueryService } from '../participant-query.service';

// Mock the entities and utilities
jest.mock('../../models/participant.model', () => ({
  ParticipantEntity: {
    query: {
      EventParticipantIndex: jest.fn(),
    },
  },
}));

jest.mock('../../models/registration.model', () => ({
  RegistrationEntity: {
    get: jest.fn(),
  },
}));

jest.mock('../../../events/models/event.model', () => ({
  EventEntity: {
    get: jest.fn(),
  },
}));

jest.mock('../../../../shared/utils/ulid', () => ({
  isValidULID: jest.fn(),
}));

// Import after mocking
import { ParticipantEntity } from '../../models/participant.model';
import { RegistrationEntity } from '../../models/registration.model';
import { EventEntity } from '../../../events/models/event.model';
import { isValidULID } from '../../../../shared/utils/ulid';

const mockParticipantEntity = ParticipantEntity as jest.Mocked<typeof ParticipantEntity>;
const mockRegistrationEntity = RegistrationEntity as jest.Mocked<typeof RegistrationEntity>;
const mockEventEntity = EventEntity as jest.Mocked<typeof EventEntity>;
const mockIsValidULID = isValidULID as jest.MockedFunction<typeof isValidULID>;

describe('ParticipantQueryService', () => {
  let participantQueryService: ParticipantQueryService;
  const mockGo = jest.fn();
  const mockEventGo = jest.fn();
  const mockRegistrationGo = jest.fn();

  beforeEach(() => {
    participantQueryService = new ParticipantQueryService();
    jest.clearAllMocks();

    // Setup the mock chains
    (mockParticipantEntity.query.EventParticipantIndex as jest.Mock).mockReturnValue({
      go: mockGo,
    });
    (mockEventEntity.get as jest.Mock).mockReturnValue({
      go: mockEventGo,
    });
    (mockRegistrationEntity.get as jest.Mock).mockReturnValue({
      go: mockRegistrationGo,
    });
  });

  describe('getParticipantsByEvent', () => {
    const validEventId = 'event-123';
    const validOrganizerId = 'organizer-456';

    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should return empty result when no participants exist for event', async () => {
      // Arrange
      const mockEvent = {
        id: validEventId,
        creatorId: validOrganizerId,
        title: 'Test Event',
      };

      mockEventGo.mockResolvedValue({ data: mockEvent });
      mockGo.mockResolvedValue({ data: [] });

      // Act
      const result = await participantQueryService.getParticipantsByEvent(validEventId, validOrganizerId);

      // Assert
      expect(result).toEqual({
        participants: [],
        totalCount: 0,
        registrationSummary: {
          totalRegistrations: 0,
          paidRegistrations: 0,
          unpaidRegistrations: 0,
          individualRegistrations: 0,
          teamRegistrations: 0,
        },
      });
    });

    it('should return participants with registration data for valid event', async () => {
      // Arrange
      const mockEvent = {
        id: validEventId,
        creatorId: validOrganizerId,
        title: 'Test Event',
      };

      const mockParticipants = [
        {
          participantId: 'participant-1',
          reservationId: 'reservation-1',
          eventId: validEventId,
          email: 'test1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          waiver: true,
          newsletter: false,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          participantId: 'participant-2',
          reservationId: 'reservation-2',
          eventId: validEventId,
          email: 'test2@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          waiver: true,
          newsletter: true,
          createdAt: '2023-01-02T00:00:00Z',
          updatedAt: '2023-01-02T00:00:00Z',
        },
      ];

      const mockRegistrations = [
        {
          reservationId: 'reservation-1',
          eventId: validEventId,
          registrationType: 'individual',
          paymentStatus: true,
          totalParticipants: 1,
          registrationFee: 50,
          createdAt: '2023-01-01T00:00:00Z',
        },
        {
          reservationId: 'reservation-2',
          eventId: validEventId,
          registrationType: 'individual',
          paymentStatus: false,
          totalParticipants: 1,
          registrationFee: 50,
          createdAt: '2023-01-02T00:00:00Z',
        },
      ];

      mockEventGo.mockResolvedValue({ data: mockEvent });
      mockGo.mockResolvedValue({ data: mockParticipants });
      mockRegistrationGo
        .mockResolvedValueOnce({ data: mockRegistrations[0] })
        .mockResolvedValueOnce({ data: mockRegistrations[1] });

      // Act
      const result = await participantQueryService.getParticipantsByEvent(validEventId, validOrganizerId);

      // Assert
      expect(result.participants).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.participants[0]).toMatchObject({
        participantId: 'participant-1',
        email: 'test1@example.com',
        registrationType: 'individual',
        paymentStatus: true,
        registrationFee: 50,
      });
      expect(result.registrationSummary).toEqual({
        totalRegistrations: 2,
        paidRegistrations: 1,
        unpaidRegistrations: 1,
        individualRegistrations: 2,
        teamRegistrations: 0,
      });
    });

    it('should handle team registrations correctly', async () => {
      // Arrange
      const mockEvent = {
        id: validEventId,
        creatorId: validOrganizerId,
        title: 'Test Team Event',
      };

      const mockParticipants = [
        {
          participantId: 'participant-1',
          reservationId: 'reservation-1',
          eventId: validEventId,
          email: 'team1@example.com',
          firstName: 'Team',
          lastName: 'Member1',
          role: 'captain',
          waiver: true,
          newsletter: false,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          participantId: 'participant-2',
          reservationId: 'reservation-1', // Same reservation ID for team
          eventId: validEventId,
          email: 'team2@example.com',
          firstName: 'Team',
          lastName: 'Member2',
          role: 'member',
          waiver: true,
          newsletter: true,
          createdAt: '2023-01-01T00:01:00Z',
          updatedAt: '2023-01-01T00:01:00Z',
        },
      ];

      const mockRegistration = {
        reservationId: 'reservation-1',
        eventId: validEventId,
        registrationType: 'team',
        paymentStatus: true,
        totalParticipants: 2,
        registrationFee: 100,
        createdAt: '2023-01-01T00:00:00Z',
      };

      mockEventGo.mockResolvedValue({ data: mockEvent });
      mockGo.mockResolvedValue({ data: mockParticipants });
      mockRegistrationGo.mockResolvedValue({ data: mockRegistration });

      // Act
      const result = await participantQueryService.getParticipantsByEvent(validEventId, validOrganizerId);

      // Assert
      expect(result.participants).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.registrationSummary).toEqual({
        totalRegistrations: 1, // Only one registration for the team
        paidRegistrations: 1,
        unpaidRegistrations: 0,
        individualRegistrations: 0,
        teamRegistrations: 1,
      });
      
      // Both participants should have the same registration data
      expect(result.participants[0].registrationType).toBe('team');
      expect(result.participants[1].registrationType).toBe('team');
      expect(result.participants[0].totalParticipants).toBe(2);
      expect(result.participants[1].totalParticipants).toBe(2);
    });

    it('should sort participants by reservation ID and creation date', async () => {
      // Arrange
      const mockEvent = {
        id: validEventId,
        creatorId: validOrganizerId,
        title: 'Test Event',
      };

      const mockParticipants = [
        {
          participantId: 'participant-3',
          reservationId: 'reservation-2',
          eventId: validEventId,
          email: 'test3@example.com',
          firstName: 'Third',
          lastName: 'Person',
          waiver: true,
          newsletter: false,
          createdAt: '2023-01-03T00:00:00Z',
          updatedAt: '2023-01-03T00:00:00Z',
        },
        {
          participantId: 'participant-1',
          reservationId: 'reservation-1',
          eventId: validEventId,
          email: 'test1@example.com',
          firstName: 'First',
          lastName: 'Person',
          waiver: true,
          newsletter: false,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      const mockRegistrations = [
        {
          reservationId: 'reservation-1',
          eventId: validEventId,
          registrationType: 'individual',
          paymentStatus: true,
          totalParticipants: 1,
          registrationFee: 50,
          createdAt: '2023-01-01T00:00:00Z',
        },
        {
          reservationId: 'reservation-2',
          eventId: validEventId,
          registrationType: 'individual',
          paymentStatus: false,
          totalParticipants: 1,
          registrationFee: 50,
          createdAt: '2023-01-03T00:00:00Z',
        },
      ];

      mockEventGo.mockResolvedValue({ data: mockEvent });
      mockGo.mockResolvedValue({ data: mockParticipants });
      mockRegistrationGo
        .mockResolvedValueOnce({ data: mockRegistrations[0] })
        .mockResolvedValueOnce({ data: mockRegistrations[1] });

      // Act
      const result = await participantQueryService.getParticipantsByEvent(validEventId, validOrganizerId);

      // Assert
      expect(result.participants).toHaveLength(2);
      // Should be sorted by reservation ID (reservation-1 comes before reservation-2)
      expect(result.participants[0].reservationId).toBe('reservation-1');
      expect(result.participants[1].reservationId).toBe('reservation-2');
    });

    it('should handle missing registration data gracefully', async () => {
      // Arrange
      const mockEvent = {
        id: validEventId,
        creatorId: validOrganizerId,
        title: 'Test Event',
      };

      const mockParticipants = [
        {
          participantId: 'participant-1',
          reservationId: 'reservation-1',
          eventId: validEventId,
          email: 'test1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          waiver: true,
          newsletter: false,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockEventGo.mockResolvedValue({ data: mockEvent });
      mockGo.mockResolvedValue({ data: mockParticipants });
      mockRegistrationGo.mockResolvedValue({ data: null }); // No registration found

      // Act
      const result = await participantQueryService.getParticipantsByEvent(validEventId, validOrganizerId);

      // Assert
      expect(result.participants).toHaveLength(1);
      expect(result.participants[0]).toMatchObject({
        participantId: 'participant-1',
        email: 'test1@example.com',
        registrationType: 'individual', // Default value
        paymentStatus: false, // Default value
        totalParticipants: 1, // Default value
        registrationFee: 0, // Default value
      });
    });

    it('should throw BadRequestError for invalid event ID format', async () => {
      // Arrange
      mockIsValidULID.mockReturnValue(false);

      // Act & Assert
      await expect(
        participantQueryService.getParticipantsByEvent('invalid-id', validOrganizerId)
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw NotFoundError when event does not exist', async () => {
      // Arrange
      mockEventGo.mockResolvedValue({ data: null });

      // Act & Assert
      await expect(
        participantQueryService.getParticipantsByEvent(validEventId, validOrganizerId)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError when organizer does not have access to event', async () => {
      // Arrange
      const mockEvent = {
        id: validEventId,
        creatorId: 'different-organizer',
        title: 'Test Event',
      };

      mockEventGo.mockResolvedValue({ data: mockEvent });

      // Act & Assert
      await expect(
        participantQueryService.getParticipantsByEvent(validEventId, validOrganizerId)
      ).rejects.toThrow(BadRequestError);
    });

    it('should handle database errors during participant query', async () => {
      // Arrange
      const mockEvent = {
        id: validEventId,
        creatorId: validOrganizerId,
        title: 'Test Event',
      };

      mockEventGo.mockResolvedValue({ data: mockEvent });
      mockGo.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(
        participantQueryService.getParticipantsByEvent(validEventId, validOrganizerId)
      ).rejects.toThrow('Failed to query participants: Database connection failed');
    });

    it('should handle database errors during event validation', async () => {
      // Arrange
      mockEventGo.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        participantQueryService.getParticipantsByEvent(validEventId, validOrganizerId)
      ).rejects.toThrow('Failed to validate event access: Database error');
    });
  });

  describe('getParticipantsGroupedByReservation', () => {
    const validEventId = 'event-123';
    const validOrganizerId = 'organizer-456';

    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should return participants grouped by reservation ID', async () => {
      // Arrange
      const mockEvent = {
        id: validEventId,
        creatorId: validOrganizerId,
        title: 'Test Event',
      };

      const mockParticipants = [
        {
          participantId: 'participant-1',
          reservationId: 'reservation-1',
          eventId: validEventId,
          email: 'team1@example.com',
          firstName: 'Team',
          lastName: 'Member1',
          waiver: true,
          newsletter: false,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          participantId: 'participant-2',
          reservationId: 'reservation-1',
          eventId: validEventId,
          email: 'team2@example.com',
          firstName: 'Team',
          lastName: 'Member2',
          waiver: true,
          newsletter: true,
          createdAt: '2023-01-01T00:01:00Z',
          updatedAt: '2023-01-01T00:01:00Z',
        },
        {
          participantId: 'participant-3',
          reservationId: 'reservation-2',
          eventId: validEventId,
          email: 'individual@example.com',
          firstName: 'Individual',
          lastName: 'Participant',
          waiver: true,
          newsletter: false,
          createdAt: '2023-01-02T00:00:00Z',
          updatedAt: '2023-01-02T00:00:00Z',
        },
      ];

      const mockRegistrations = [
        {
          reservationId: 'reservation-1',
          eventId: validEventId,
          registrationType: 'team',
          paymentStatus: true,
          totalParticipants: 2,
          registrationFee: 100,
          createdAt: '2023-01-01T00:00:00Z',
        },
        {
          reservationId: 'reservation-2',
          eventId: validEventId,
          registrationType: 'individual',
          paymentStatus: false,
          totalParticipants: 1,
          registrationFee: 50,
          createdAt: '2023-01-02T00:00:00Z',
        },
      ];

      mockEventGo.mockResolvedValue({ data: mockEvent });
      mockGo.mockResolvedValue({ data: mockParticipants });
      mockRegistrationGo
        .mockResolvedValueOnce({ data: mockRegistrations[0] })
        .mockResolvedValueOnce({ data: mockRegistrations[1] });

      // Act
      const result = await participantQueryService.getParticipantsGroupedByReservation(validEventId, validOrganizerId);

      // Assert
      expect(result.size).toBe(2);
      expect(result.get('reservation-1')).toHaveLength(2);
      expect(result.get('reservation-2')).toHaveLength(1);
      
      const teamParticipants = result.get('reservation-1')!;
      expect(teamParticipants[0].email).toBe('team1@example.com');
      expect(teamParticipants[1].email).toBe('team2@example.com');
      
      const individualParticipant = result.get('reservation-2')!;
      expect(individualParticipant[0].email).toBe('individual@example.com');
    });

    it('should return empty map when no participants exist', async () => {
      // Arrange
      const mockEvent = {
        id: validEventId,
        creatorId: validOrganizerId,
        title: 'Test Event',
      };

      mockEventGo.mockResolvedValue({ data: mockEvent });
      mockGo.mockResolvedValue({ data: [] });

      // Act
      const result = await participantQueryService.getParticipantsGroupedByReservation(validEventId, validOrganizerId);

      // Assert
      expect(result.size).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    const validEventId = 'event-123';
    const validOrganizerId = 'organizer-456';

    beforeEach(() => {
      mockIsValidULID.mockReturnValue(true);
    });

    it('should handle partial registration fetch failures gracefully', async () => {
      // Arrange
      const mockEvent = {
        id: validEventId,
        creatorId: validOrganizerId,
        title: 'Test Event',
      };

      const mockParticipants = [
        {
          participantId: 'participant-1',
          reservationId: 'reservation-1',
          eventId: validEventId,
          email: 'test1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          waiver: true,
          newsletter: false,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          participantId: 'participant-2',
          reservationId: 'reservation-2',
          eventId: validEventId,
          email: 'test2@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          waiver: true,
          newsletter: true,
          createdAt: '2023-01-02T00:00:00Z',
          updatedAt: '2023-01-02T00:00:00Z',
        },
      ];

      const mockRegistration = {
        reservationId: 'reservation-1',
        eventId: validEventId,
        registrationType: 'individual',
        paymentStatus: true,
        totalParticipants: 1,
        registrationFee: 50,
        createdAt: '2023-01-01T00:00:00Z',
      };

      mockEventGo.mockResolvedValue({ data: mockEvent });
      mockGo.mockResolvedValue({ data: mockParticipants });
      mockRegistrationGo
        .mockResolvedValueOnce({ data: mockRegistration })
        .mockRejectedValueOnce(new Error('Registration fetch failed'));

      // Act
      const result = await participantQueryService.getParticipantsByEvent(validEventId, validOrganizerId);

      // Assert
      expect(result.participants).toHaveLength(2);
      expect(result.participants[0].paymentStatus).toBe(true); // Has registration data
      expect(result.participants[1].paymentStatus).toBe(false); // Uses default values
    });

    it('should handle mixed registration types in summary calculation', async () => {
      // Arrange
      const mockEvent = {
        id: validEventId,
        creatorId: validOrganizerId,
        title: 'Test Event',
      };

      const mockParticipants = [
        {
          participantId: 'participant-1',
          reservationId: 'reservation-1',
          eventId: validEventId,
          email: 'individual@example.com',
          firstName: 'Individual',
          lastName: 'Participant',
          waiver: true,
          newsletter: false,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          participantId: 'participant-2',
          reservationId: 'reservation-2',
          eventId: validEventId,
          email: 'team1@example.com',
          firstName: 'Team',
          lastName: 'Member1',
          waiver: true,
          newsletter: false,
          createdAt: '2023-01-02T00:00:00Z',
          updatedAt: '2023-01-02T00:00:00Z',
        },
        {
          participantId: 'participant-3',
          reservationId: 'reservation-2',
          eventId: validEventId,
          email: 'team2@example.com',
          firstName: 'Team',
          lastName: 'Member2',
          waiver: true,
          newsletter: true,
          createdAt: '2023-01-02T00:01:00Z',
          updatedAt: '2023-01-02T00:01:00Z',
        },
      ];

      const mockRegistrations = [
        {
          reservationId: 'reservation-1',
          eventId: validEventId,
          registrationType: 'individual',
          paymentStatus: true,
          totalParticipants: 1,
          registrationFee: 50,
          createdAt: '2023-01-01T00:00:00Z',
        },
        {
          reservationId: 'reservation-2',
          eventId: validEventId,
          registrationType: 'team',
          paymentStatus: false,
          totalParticipants: 2,
          registrationFee: 100,
          createdAt: '2023-01-02T00:00:00Z',
        },
      ];

      mockEventGo.mockResolvedValue({ data: mockEvent });
      mockGo.mockResolvedValue({ data: mockParticipants });
      mockRegistrationGo
        .mockResolvedValueOnce({ data: mockRegistrations[0] })
        .mockResolvedValueOnce({ data: mockRegistrations[1] });

      // Act
      const result = await participantQueryService.getParticipantsByEvent(validEventId, validOrganizerId);

      // Assert
      expect(result.registrationSummary).toEqual({
        totalRegistrations: 2,
        paidRegistrations: 1,
        unpaidRegistrations: 1,
        individualRegistrations: 1,
        teamRegistrations: 1,
      });
    });
  });
});