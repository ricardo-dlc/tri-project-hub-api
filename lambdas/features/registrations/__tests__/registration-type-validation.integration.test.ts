/**
 * Integration test to verify that registration type validation works correctly
 * This test demonstrates the fix for the bug where individual registrations
 * were allowed on team events and vice versa.
 */

import { ConflictError } from '@/shared/errors';
import { EventEntity } from '@/features/events/models/event.model';
import { BaseRegistrationService } from '../services/base-registration.service';

// Mock the EventEntity
jest.mock('@/features/events/models/event.model');
const mockEventEntity = EventEntity as jest.Mocked<typeof EventEntity>;

// Create a test service that extends BaseRegistrationService to test the validation directly
class TestRegistrationService extends BaseRegistrationService {
  async testValidateEventAvailability(eventId: string, expectedType: 'individual' | 'team') {
    return this.validateEventAvailability(eventId, expectedType);
  }
}

describe('Registration Type Validation Integration', () => {
  const eventId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  let testService: TestRegistrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    testService = new TestRegistrationService();
  });

  describe('Individual Event (isTeamEvent: false)', () => {
    const individualEvent = {
      id: eventId,
      isEnabled: true,
      isTeamEvent: false, // Individual event
      registrationDeadline: new Date(Date.now() + 86400000).toISOString(),
      registrationFee: 50,
      maxParticipants: 100,
      currentParticipants: 10,
    };

    beforeEach(() => {
      mockEventEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: individualEvent }),
      });
    });

    it('should allow individual registration on individual event', async () => {
      // This should NOT throw an error
      const result = await testService.testValidateEventAvailability(eventId, 'individual');
      expect(result).toBeDefined();
      expect(result.isTeamEvent).toBe(false);
    });

    it('should reject team registration on individual event', async () => {
      // This SHOULD throw a ConflictError
      await expect(
        testService.testValidateEventAvailability(eventId, 'team')
      ).rejects.toThrow(ConflictError);

      await expect(
        testService.testValidateEventAvailability(eventId, 'team')
      ).rejects.toThrow('Registration type mismatch. This event is configured for individual registration only.');
    });
  });

  describe('Team Event (isTeamEvent: true)', () => {
    const teamEvent = {
      id: eventId,
      isEnabled: true,
      isTeamEvent: true, // Team event
      registrationDeadline: new Date(Date.now() + 86400000).toISOString(),
      registrationFee: 100,
      maxParticipants: 50,
      currentParticipants: 5,
    };

    beforeEach(() => {
      mockEventEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: teamEvent }),
      });
    });

    it('should allow team registration on team event', async () => {
      // This should NOT throw an error
      const result = await testService.testValidateEventAvailability(eventId, 'team');
      expect(result).toBeDefined();
      expect(result.isTeamEvent).toBe(true);
    });

    it('should reject individual registration on team event', async () => {
      // This SHOULD throw a ConflictError
      await expect(
        testService.testValidateEventAvailability(eventId, 'individual')
      ).rejects.toThrow(ConflictError);

      await expect(
        testService.testValidateEventAvailability(eventId, 'individual')
      ).rejects.toThrow('Registration type mismatch. This event is configured for team registration only.');
    });
  });

  describe('Error Details', () => {
    it('should provide detailed error information for individual-to-team mismatch', async () => {
      const teamEvent = {
        id: eventId,
        isEnabled: true,
        isTeamEvent: true,
        registrationDeadline: new Date(Date.now() + 86400000).toISOString(),
        registrationFee: 100,
        maxParticipants: 50,
        currentParticipants: 5,
      };

      mockEventEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: teamEvent }),
      });

      try {
        await testService.testValidateEventAvailability(eventId, 'individual');
        fail('Expected ConflictError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        const conflictError = error as ConflictError;
        expect(conflictError.details).toEqual({
          eventId,
          eventRegistrationType: 'team',
          attemptedRegistrationType: 'individual',
        });
      }
    });

    it('should provide detailed error information for team-to-individual mismatch', async () => {
      const individualEvent = {
        id: eventId,
        isEnabled: true,
        isTeamEvent: false,
        registrationDeadline: new Date(Date.now() + 86400000).toISOString(),
        registrationFee: 50,
        maxParticipants: 100,
        currentParticipants: 10,
      };

      mockEventEntity.get = jest.fn().mockReturnValue({
        go: jest.fn().mockResolvedValue({ data: individualEvent }),
      });

      try {
        await testService.testValidateEventAvailability(eventId, 'team');
        fail('Expected ConflictError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        const conflictError = error as ConflictError;
        expect(conflictError.details).toEqual({
          eventId,
          eventRegistrationType: 'individual',
          attemptedRegistrationType: 'team',
        });
      }
    });
  });
});