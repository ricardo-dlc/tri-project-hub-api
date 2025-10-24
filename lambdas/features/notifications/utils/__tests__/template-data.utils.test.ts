/**
 * Tests for template data transformation utilities
 */

import { TemplateDataError } from '../../errors/notification.errors';
import { PaymentConfirmationMessage, RegistrationNotificationMessage } from '../../types/notification.types';
import {
  applyTemplateDataDefaults,
  transformNotificationMessage,
  transformToConfirmationTemplateData,
  transformToIndividualTemplateData,
  transformToTeamTemplateData,
  validateTemplateData
} from '../template-data.utils';

describe('Template Data Transformation Utilities', () => {
  describe('transformToIndividualTemplateData', () => {
    it('should transform individual registration message to template data', () => {
      const message: RegistrationNotificationMessage = {
        type: 'registration_success',
        registrationType: 'individual',
        eventId: 'event-123',
        reservationId: 'res-456',
        participant: {
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          participantId: 'part-789'
        },
        event: {
          name: 'Test Event',
          date: '2024-12-01',
          time: '10:00 AM',
          location: 'Test Location'
        },
        payment: {
          amount: '100.00',
          bankAccount: 'BANK123456',
          payment_reference: 'REF123456'
        }
      };

      const result = transformToIndividualTemplateData(message);

      expect(result).toEqual({
        event_name: 'Test Event',
        event_date: '2024-12-01',
        event_time: '10:00 AM',
        event_location: 'Test Location',
        participant_id: 'part-789',
        participant_name: 'John Doe',
        payment_amount: '100.00',
        bank_account: 'BANK123456',
        payment_reference: 'REF123456',
        reservation_id: 'res-456'
      });
    });

    it('should generate participant ID when not provided', () => {
      const message: RegistrationNotificationMessage = {
        type: 'registration_success',
        registrationType: 'individual',
        eventId: 'event-123',
        reservationId: 'res-456',
        participant: {
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe'
        },
        event: {
          name: 'Test Event',
          date: '2024-12-01',
          time: '10:00 AM',
          location: 'Test Location'
        },
        payment: {
          amount: '100.00',
          bankAccount: 'BANK123456',
          payment_reference: 'REF123456'
        }
      };

      const result = transformToIndividualTemplateData(message);

      expect(result.participant_id).toMatch(/^JD.+/); // Should start with initials
      expect(result.participant_name).toBe('John Doe');
    });

    it('should throw error for invalid message type', () => {
      const message = {
        type: 'invalid_type',
        registrationType: 'individual'
      } as any;

      expect(() => transformToIndividualTemplateData(message)).toThrow(TemplateDataError);
    });
  });

  describe('transformToTeamTemplateData', () => {
    it('should transform team registration message to template data', () => {
      const message: RegistrationNotificationMessage = {
        type: 'registration_success',
        registrationType: 'team',
        eventId: 'event-123',
        reservationId: 'res-456',
        participant: {
          email: 'captain@example.com',
          firstName: 'Team',
          lastName: 'Captain'
        },
        team: {
          name: 'Test Team',
          members: [
            {
              name: 'Team Captain',
              email: 'captain@example.com',
              role: 'Leader',
              isCaptain: true
            },
            {
              name: 'Team Member',
              email: 'member@example.com',
              role: 'Developer',
              isCaptain: false
            }
          ]
        },
        event: {
          name: 'Test Event',
          date: '2024-12-01',
          time: '10:00 AM',
          location: 'Test Location'
        },
        payment: {
          amount: '200.00',
          bankAccount: 'BANK123456',
          payment_reference: 'TEAMREF123'
        }
      };

      const result = transformToTeamTemplateData(message);

      expect(result.team_name).toBe('Test Team');
      expect(result.team_members_count).toBe(2);
      expect(result.team_members).toHaveLength(2);
      expect(result.team_members[0]).toEqual({
        member_name: 'Team Captain',
        member_discipline: 'Leader',
        is_captain: true
      });
      expect(result.team_id).toMatch(/^TEAMTEST.+/);
    });

    it('should throw error for missing team information', () => {
      const message = {
        type: 'registration_success',
        registrationType: 'team',
        participant: { email: 'test@example.com', firstName: 'Test', lastName: 'User' },
        event: { name: 'Event', date: '2024-12-01', time: '10:00', location: 'Location' },
        payment: { amount: '100', bankAccount: 'BANK123', payment_reference: 'REF123' },
        reservationId: 'res-123'
      } as any;

      expect(() => transformToTeamTemplateData(message)).toThrow(TemplateDataError);
    });
  });

  describe('transformToConfirmationTemplateData', () => {
    it('should transform payment confirmation message to template data', () => {
      const message: PaymentConfirmationMessage = {
        type: 'payment_confirmed',
        reservationId: 'res-456',
        participant: {
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          participantId: 'part-789'
        },
        event: {
          name: 'Test Event',
          date: '2024-12-01',
          time: '10:00 AM',
          location: 'Test Location'
        },
        payment: {
          amount: '100.00',
          confirmationNumber: 'CONF123',
          transferReference: 'TXN456',
          paymentDate: '2024-11-15'
        }
      };

      const result = transformToConfirmationTemplateData(message);

      expect(result).toEqual({
        event_name: 'Test Event',
        event_date: '2024-12-01',
        event_time: '10:00 AM',
        event_location: 'Test Location',
        participant_id: 'part-789',
        confirmation_number: 'CONF123',
        payment_amount: '100.00',
        transfer_reference: 'TXN456',
        payment_date: '2024-11-15'
      });
    });
  });

  describe('applyTemplateDataDefaults', () => {
    it('should apply default values for individual template', () => {
      const templateData = {
        event_name: 'Test Event',
        participant_name: 'John Doe'
      };

      const result = applyTemplateDataDefaults(templateData, 'individual');

      expect(result.event_name).toBe('Test Event');
      expect(result.participant_name).toBe('John Doe');
      expect(result.event_date).toBe('TBD');
      expect(result.participant_id).toBe('N/A');
    });

    it('should apply default values for team template', () => {
      const templateData = {
        team_name: 'Test Team',
        team_members: []
      };

      const result = applyTemplateDataDefaults(templateData, 'team');

      expect(result.team_name).toBe('Test Team');
      expect(result.team_members_count).toBe(0);
      expect(result.event_date).toBe('TBD');
    });
  });

  describe('validateTemplateData', () => {
    it('should validate individual template data successfully', () => {
      const templateData = {
        event_name: 'Test Event',
        event_date: '2024-12-01',
        event_time: '10:00 AM',
        event_location: 'Test Location',
        participant_id: 'part-123',
        participant_name: 'John Doe',
        payment_amount: '100.00',
        bank_account: 'BANK123',
        payment_reference: 'REF123',
        reservation_id: 'res-456'
      };

      expect(() => validateTemplateData(templateData, 'individual')).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const templateData = {
        event_name: 'Test Event'
      };

      expect(() => validateTemplateData(templateData, 'individual')).toThrow(TemplateDataError);
    });

    it('should validate team template data with members', () => {
      const templateData = {
        event_name: 'Test Event',
        event_date: '2024-12-01',
        event_time: '10:00 AM',
        event_location: 'Test Location',
        team_name: 'Test Team',
        team_id: 'team-123',
        team_members_count: 1,
        team_members: [
          {
            member_name: 'John Doe',
            member_discipline: 'Developer',
            is_captain: true
          }
        ],
        payment_amount: '100.00',
        bank_account: 'BANK123',
        payment_reference: 'TEAMREF123',
        reservation_id: 'res-456'
      };

      expect(() => validateTemplateData(templateData, 'team')).not.toThrow();
    });
  });

  describe('transformNotificationMessage', () => {
    it('should transform individual registration message', () => {
      const message: RegistrationNotificationMessage = {
        type: 'registration_success',
        registrationType: 'individual',
        eventId: 'event-123',
        reservationId: 'res-456',
        participant: {
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          participantId: 'part-789'
        },
        event: {
          name: 'Test Event',
          date: '2024-12-01',
          time: '10:00 AM',
          location: 'Test Location'
        },
        payment: {
          amount: '100.00',
          bankAccount: 'BANK123456',
          payment_reference: 'REF123456'
        }
      };

      const result = transformNotificationMessage(message);
      expect(result).toHaveProperty('participant_name', 'John Doe');
    });

    it('should transform payment confirmation message', () => {
      const message: PaymentConfirmationMessage = {
        type: 'payment_confirmed',
        reservationId: 'res-456',
        participant: {
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          participantId: 'part-789'
        },
        event: {
          name: 'Test Event',
          date: '2024-12-01',
          time: '10:00 AM',
          location: 'Test Location'
        },
        payment: {
          amount: '100.00',
          confirmationNumber: 'CONF123',
          transferReference: 'TXN456',
          paymentDate: '2024-11-15'
        }
      };

      const result = transformNotificationMessage(message);
      expect(result).toHaveProperty('confirmation_number', 'CONF123');
    });
  });
});
