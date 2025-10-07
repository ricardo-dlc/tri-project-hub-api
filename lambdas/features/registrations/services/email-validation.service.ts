import { ConflictError } from '../../../shared/errors';
import { createFeatureLogger } from '../../../shared/logger';
import { ParticipantEntity } from '../models/participant.model';

const logger = createFeatureLogger('registrations');

export interface EmailValidationResult {
  isValid: boolean;
  duplicateEmails: string[];
  conflictingParticipants?: Array<{
    email: string;
    participantId: string;
    reservationId: string;
  }>;
}

export class EmailValidationService {
  /**
   * Validates email uniqueness for a single email address within an event
   * @param eventId - The event ID to check against
   * @param email - The email address to validate
   * @returns Promise<EmailValidationResult>
   */
  async validateSingleEmail(eventId: string, email: string): Promise<EmailValidationResult> {
    try {
      // Query the EventParticipantIndex to check if email already exists for this event
      const existingParticipants = await ParticipantEntity.query
        .EventParticipantIndex({
          eventParticipantId: eventId,
          participantEmail: email,
        })
        .go();

      const isValid = existingParticipants.data.length === 0;
      const duplicateEmails = isValid ? [] : [email];
      const conflictingParticipants = existingParticipants.data.map(participant => ({
        email: participant.email,
        participantId: participant.participantId,
        reservationId: participant.reservationId,
      }));

      return {
        isValid,
        duplicateEmails,
        conflictingParticipants: isValid ? undefined : conflictingParticipants,
      };
    } catch (error) {
      throw new Error(`Failed to validate email uniqueness: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates email uniqueness for multiple email addresses within an event
   * Handles both team registration validation and internal team duplicate checking
   * @param eventId - The event ID to check against
   * @param emails - Array of email addresses to validate
   * @returns Promise<EmailValidationResult>
   */
  async validateMultipleEmails(eventId: string, emails: string[]): Promise<EmailValidationResult> {
    if (emails.length === 0) {
      return {
        isValid: true,
        duplicateEmails: [],
      };
    }

    // First, check for duplicates within the provided email list (team internal duplicates)
    const emailSet = new Set<string>();
    const internalDuplicates: string[] = [];

    for (const email of emails) {
      const normalizedEmail = email.toLowerCase().trim();
      if (emailSet.has(normalizedEmail)) {
        internalDuplicates.push(email);
      } else {
        emailSet.add(normalizedEmail);
      }
    }

    // If there are internal duplicates, return immediately
    if (internalDuplicates.length > 0) {
      return {
        isValid: false,
        duplicateEmails: internalDuplicates,
      };
    }

    try {
      // Check each email against existing event participants
      const validationPromises = emails.map(email => this.validateSingleEmail(eventId, email));
      const validationResults = await Promise.all(validationPromises);

      // Collect all duplicate emails and conflicting participants
      const allDuplicateEmails: string[] = [];
      const allConflictingParticipants: Array<{
        email: string;
        participantId: string;
        reservationId: string;
      }> = [];

      validationResults.forEach(result => {
        if (!result.isValid) {
          allDuplicateEmails.push(...result.duplicateEmails);
          if (result.conflictingParticipants) {
            allConflictingParticipants.push(...result.conflictingParticipants);
          }
        }
      });

      const isValid = allDuplicateEmails.length === 0;

      return {
        isValid,
        duplicateEmails: allDuplicateEmails,
        conflictingParticipants: isValid ? undefined : allConflictingParticipants,
      };
    } catch (error) {
      throw new Error(`Failed to validate multiple emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates email uniqueness for individual registration
   * @param eventId - The event ID to check against
   * @param email - The email address to validate
   * @throws ConflictError if email already exists for the event
   */
  async validateIndividualRegistration(eventId: string, email: string): Promise<void> {
    const result = await this.validateSingleEmail(eventId, email);

    if (!result.isValid) {
      logger.warn({ eventId, email, conflictingCount: result.conflictingParticipants?.length }, 'Email already registered for event');
      throw new ConflictError(
        `Email ${email} is already registered for this event`,
        {
          email,
          eventId,
          conflictingParticipants: result.conflictingParticipants,
        }
      );
    }

    logger.debug({ eventId, email }, 'Email validation passed - email is unique');
  }

  /**
   * Validates email uniqueness for team registration
   * @param eventId - The event ID to check against
   * @param emails - Array of team member email addresses to validate
   * @throws ConflictError if any email conflicts are found
   */
  async validateTeamRegistration(eventId: string, emails: string[]): Promise<void> {
    logger.debug({ eventId, emailCount: emails.length }, 'Validating team emails');
    const result = await this.validateMultipleEmails(eventId, emails);

    if (!result.isValid) {
      const isInternalDuplicate = !result.conflictingParticipants;
      logger.warn({
        eventId,
        duplicateEmails: result.duplicateEmails,
        isInternalDuplicate,
        conflictingCount: result.conflictingParticipants?.length
      }, 'Team email validation failed');

      const errorMessage = result.conflictingParticipants
        ? `The following emails are already registered for this event: ${result.duplicateEmails.join(', ')}`
        : `Duplicate emails found within team registration: ${result.duplicateEmails.join(', ')}`;

      throw new ConflictError(errorMessage, {
        eventId,
        duplicateEmails: result.duplicateEmails,
        conflictingParticipants: result.conflictingParticipants,
      });
    }

    logger.debug({ eventId, emailCount: emails.length }, 'Team email validation passed - all emails unique');
  }
}

// Export a singleton instance for use across the application
export const emailValidationService = new EmailValidationService();
