import { ConflictError } from '@/shared/errors';
import { EmailValidationService } from '../email-validation.service';

// Mock the ParticipantEntity
jest.mock('@/features/registrations/models/participant.model', () => ({
  ParticipantEntity: {
    query: {
      EventParticipantIndex: jest.fn(),
    },
  },
}));

// Import after mocking
import { ParticipantEntity } from '@/features/registrations/models/participant.model';

const mockParticipantEntity = ParticipantEntity as jest.Mocked<typeof ParticipantEntity>;

describe('EmailValidationService', () => {
  let emailValidationService: EmailValidationService;
  const mockGo = jest.fn();

  beforeEach(() => {
    emailValidationService = new EmailValidationService();
    jest.clearAllMocks();
    // Setup the mock chain
    (mockParticipantEntity.query.EventParticipantIndex as jest.Mock).mockReturnValue({
      go: mockGo,
    });
  });

  describe('validateSingleEmail', () => {
    it('should return valid result when email does not exist for event', async () => {
      // Arrange
      const eventId = 'event-123';
      const email = 'test@example.com';

      mockGo.mockResolvedValue({ data: [] });

      // Act
      const result = await emailValidationService.validateSingleEmail(eventId, email);

      // Assert
      expect(result).toEqual({
        isValid: true,
        duplicateEmails: [],
        conflictingParticipants: undefined,
      });
      expect(mockParticipantEntity.query.EventParticipantIndex).toHaveBeenCalledWith({
        eventParticipantId: eventId,
        participantEmail: email,
      });
    });

    it('should return invalid result when email already exists for event', async () => {
      // Arrange
      const eventId = 'event-123';
      const email = 'test@example.com';
      const existingParticipant = {
        email: 'test@example.com',
        participantId: 'participant-456',
        reservationId: 'reservation-789',
      };

      mockGo.mockResolvedValue({ data: [existingParticipant] });

      // Act
      const result = await emailValidationService.validateSingleEmail(eventId, email);

      // Assert
      expect(result).toEqual({
        isValid: false,
        duplicateEmails: [email],
        conflictingParticipants: [existingParticipant],
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const eventId = 'event-123';
      const email = 'test@example.com';

      mockGo.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(emailValidationService.validateSingleEmail(eventId, email))
        .rejects.toThrow('Failed to validate email uniqueness: Database connection failed');
    });
  });

  describe('validateMultipleEmails', () => {
    it('should return valid result for empty email array', async () => {
      // Act
      const result = await emailValidationService.validateMultipleEmails('event-123', []);

      // Assert
      expect(result).toEqual({
        isValid: true,
        duplicateEmails: [],
      });
    });

    it('should detect internal duplicates within team emails', async () => {
      // Arrange
      const eventId = 'event-123';
      const emails = ['test1@example.com', 'test2@example.com', 'test1@example.com'];

      // Act
      const result = await emailValidationService.validateMultipleEmails(eventId, emails);

      // Assert
      expect(result).toEqual({
        isValid: false,
        duplicateEmails: ['test1@example.com'],
      });
      // Should not call database when internal duplicates are found
      expect(mockParticipantEntity.query.EventParticipantIndex).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive email comparison for internal duplicates', async () => {
      // Arrange
      const eventId = 'event-123';
      const emails = ['Test@Example.com', 'test@example.com'];

      // Act
      const result = await emailValidationService.validateMultipleEmails(eventId, emails);

      // Assert
      expect(result).toEqual({
        isValid: false,
        duplicateEmails: ['test@example.com'],
      });
    });

    it('should return valid result when all emails are unique and not in database', async () => {
      // Arrange
      const eventId = 'event-123';
      const emails = ['test1@example.com', 'test2@example.com', 'test3@example.com'];

      mockGo.mockResolvedValue({ data: [] });

      // Act
      const result = await emailValidationService.validateMultipleEmails(eventId, emails);

      // Assert
      expect(result).toEqual({
        isValid: true,
        duplicateEmails: [],
        conflictingParticipants: undefined,
      });
      expect(mockParticipantEntity.query.EventParticipantIndex).toHaveBeenCalledTimes(3);
    });

    it('should return invalid result when some emails exist in database', async () => {
      // Arrange
      const eventId = 'event-123';
      const emails = ['test1@example.com', 'test2@example.com', 'test3@example.com'];
      const existingParticipant = {
        email: 'test2@example.com',
        participantId: 'participant-456',
        reservationId: 'reservation-789',
      };

      // Mock responses: first and third emails are unique, second email exists
      mockGo
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [existingParticipant] })
        .mockResolvedValueOnce({ data: [] });

      // Act
      const result = await emailValidationService.validateMultipleEmails(eventId, emails);

      // Assert
      expect(result).toEqual({
        isValid: false,
        duplicateEmails: ['test2@example.com'],
        conflictingParticipants: [existingParticipant],
      });
    });

    it('should handle database errors during validation', async () => {
      // Arrange
      const eventId = 'event-123';
      const emails = ['test1@example.com'];

      mockGo.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(emailValidationService.validateMultipleEmails(eventId, emails))
        .rejects.toThrow('Failed to validate multiple emails: Failed to validate email uniqueness: Database error');
    });
  });

  describe('validateIndividualRegistration', () => {
    it('should not throw when email is unique for event', async () => {
      // Arrange
      const eventId = 'event-123';
      const email = 'test@example.com';

      mockGo.mockResolvedValue({ data: [] });

      // Act & Assert
      await expect(emailValidationService.validateIndividualRegistration(eventId, email))
        .resolves.not.toThrow();
    });

    it('should throw ConflictError when email already exists for event', async () => {
      // Arrange
      const eventId = 'event-123';
      const email = 'test@example.com';
      const existingParticipant = {
        email: 'test@example.com',
        participantId: 'participant-456',
        reservationId: 'reservation-789',
      };

      mockGo.mockResolvedValue({ data: [existingParticipant] });

      // Act & Assert
      await expect(emailValidationService.validateIndividualRegistration(eventId, email))
        .rejects.toThrow(ConflictError);

      try {
        await emailValidationService.validateIndividualRegistration(eventId, email);
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        expect((error as ConflictError).message).toBe(`Email ${email} is already registered for this event`);
        expect((error as ConflictError).details).toEqual({
          email,
          eventId,
          conflictingParticipants: [existingParticipant],
        });
      }
    });
  });

  describe('validateTeamRegistration', () => {
    it('should not throw when all team emails are unique', async () => {
      // Arrange
      const eventId = 'event-123';
      const emails = ['test1@example.com', 'test2@example.com'];

      mockGo.mockResolvedValue({ data: [] });

      // Act & Assert
      await expect(emailValidationService.validateTeamRegistration(eventId, emails))
        .resolves.not.toThrow();
    });

    it('should throw ConflictError for internal team duplicates', async () => {
      // Arrange
      const eventId = 'event-123';
      const emails = ['test1@example.com', 'test1@example.com'];

      // Act & Assert
      await expect(emailValidationService.validateTeamRegistration(eventId, emails))
        .rejects.toThrow(ConflictError);

      try {
        await emailValidationService.validateTeamRegistration(eventId, emails);
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        expect((error as ConflictError).message).toBe('Duplicate emails found within team registration: test1@example.com');
        expect((error as ConflictError).details).toEqual({
          eventId,
          duplicateEmails: ['test1@example.com'],
          conflictingParticipants: undefined,
        });
      }
    });

    it('should throw ConflictError when team emails conflict with existing participants', async () => {
      // Arrange
      const eventId = 'event-123';
      const emails = ['test1@example.com', 'test2@example.com'];
      const existingParticipant = {
        email: 'test1@example.com',
        participantId: 'participant-456',
        reservationId: 'reservation-789',
      };

      mockGo
        .mockResolvedValueOnce({ data: [existingParticipant] })
        .mockResolvedValueOnce({ data: [] });

      // Act & Assert
      await expect(emailValidationService.validateTeamRegistration(eventId, emails))
        .rejects.toThrow(ConflictError);

      try {
        await emailValidationService.validateTeamRegistration(eventId, emails);
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        expect((error as ConflictError).message).toBe('The following emails are already registered for this event: test1@example.com');
        expect((error as ConflictError).details).toEqual({
          eventId,
          duplicateEmails: ['test1@example.com'],
          conflictingParticipants: [existingParticipant],
        });
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string emails gracefully', async () => {
      // Arrange
      const eventId = 'event-123';
      const email = '';

      mockGo.mockResolvedValue({ data: [] });

      // Act
      const result = await emailValidationService.validateSingleEmail(eventId, email);

      // Assert
      expect(result.isValid).toBe(true);
      expect(mockParticipantEntity.query.EventParticipantIndex).toHaveBeenCalledWith({
        eventParticipantId: eventId,
        participantEmail: email,
      });
    });

    it('should handle whitespace in emails for internal duplicate detection', async () => {
      // Arrange
      const eventId = 'event-123';
      const emails = ['  test@example.com  ', 'test@example.com'];

      // Act
      const result = await emailValidationService.validateMultipleEmails(eventId, emails);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.duplicateEmails).toContain('test@example.com');
    });

    it('should handle multiple existing participants for same email', async () => {
      // Arrange
      const eventId = 'event-123';
      const email = 'test@example.com';
      const existingParticipants = [
        {
          email: 'test@example.com',
          participantId: 'participant-1',
          reservationId: 'reservation-1',
        },
        {
          email: 'test@example.com',
          participantId: 'participant-2',
          reservationId: 'reservation-2',
        },
      ];

      mockGo.mockResolvedValue({ data: existingParticipants });

      // Act
      const result = await emailValidationService.validateSingleEmail(eventId, email);

      // Assert
      expect(result).toEqual({
        isValid: false,
        duplicateEmails: [email],
        conflictingParticipants: existingParticipants,
      });
    });
  });
});