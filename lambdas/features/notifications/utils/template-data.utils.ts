/**
 * Template data transformation utilities for email notifications
 * 
 * This module provides utilities to transform notification messages into
 * template data formats required by Maileroo email templates.
 */

import { logger } from '@/shared/logger';
import { TemplateDataError } from '../errors/notification.errors';
import {
  ConfirmationTemplateData,
  IndividualTemplateData,
  TeamTemplateData
} from '../types/email.types';
import {
  PaymentConfirmationMessage,
  RegistrationNotificationMessage
} from '../types/notification.types';

/**
 * Transform registration notification message to individual registration template data
 * @param message Registration notification message for individual registration
 * @returns IndividualTemplateData formatted for Maileroo template
 * @throws TemplateDataError if message is invalid or missing required fields
 */
export function transformToIndividualTemplateData(message: RegistrationNotificationMessage): IndividualTemplateData {
  try {
    // Validate message type
    if (message.type !== 'registration_success') {
      throw new TemplateDataError(`Invalid message type for individual template: ${message.type}`);
    }

    if (message.registrationType !== 'individual') {
      throw new TemplateDataError(`Invalid registration type for individual template: ${message.registrationType}`);
    }

    // Validate required fields
    if (!message.participant) {
      throw new TemplateDataError('Participant information is required for individual registration template');
    }

    if (!message.event) {
      throw new TemplateDataError('Event information is required for individual registration template');
    }

    if (!message.payment) {
      throw new TemplateDataError('Payment information is required for individual registration template');
    }

    if (!message.reservationId) {
      throw new TemplateDataError('Reservation ID is required for individual registration template');
    }

    // Extract participant information
    const participant = message.participant;
    if (!participant.email || !participant.firstName || !participant.lastName) {
      throw new TemplateDataError('Participant email, firstName, and lastName are required');
    }

    // Extract event information
    const event = message.event;
    if (!event.name || !event.date || !event.time || !event.location) {
      throw new TemplateDataError('Event name, date, time, and location are required');
    }

    // Extract payment information
    const payment = message.payment;
    if (!payment.amount || !payment.bankAccount) {
      throw new TemplateDataError('Payment amount and bank account are required');
    }

    // Transform to template data format
    const templateData: IndividualTemplateData = {
      event_name: event.name,
      event_date: event.date,
      event_time: event.time,
      event_location: event.location,
      participant_id: participant.participantId || generateParticipantId(participant),
      participant_name: `${participant.firstName} ${participant.lastName}`,
      payment_amount: payment.amount,
      bank_account: payment.bankAccount,
      reservation_id: message.reservationId
    };

    logger.debug({
      reservationId: message.reservationId,
      participantEmail: participant.email,
      eventName: event.name
    }, 'Successfully transformed individual registration message to template data');

    return templateData;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({
      messageType: message?.type,
      registrationType: message?.registrationType,
      reservationId: message?.reservationId,
      error: errorMessage
    }, 'Failed to transform individual registration message to template data');

    if (error instanceof TemplateDataError) {
      throw error;
    }

    throw new TemplateDataError(
      `Failed to transform individual registration message: ${errorMessage}`,
      { originalError: error, message }
    );
  }
}

/**
 * Transform registration notification message to team registration template data
 * @param message Registration notification message for team registration
 * @returns TeamTemplateData formatted for Maileroo template
 * @throws TemplateDataError if message is invalid or missing required fields
 */
export function transformToTeamTemplateData(message: RegistrationNotificationMessage): TeamTemplateData {
  try {
    // Validate message type
    if (message.type !== 'registration_success') {
      throw new TemplateDataError(`Invalid message type for team template: ${message.type}`);
    }

    if (message.registrationType !== 'team') {
      throw new TemplateDataError(`Invalid registration type for team template: ${message.registrationType}`);
    }

    // Validate required fields
    if (!message.participant) {
      throw new TemplateDataError('Participant information is required for team registration template');
    }

    if (!message.team) {
      throw new TemplateDataError('Team information is required for team registration template');
    }

    if (!message.event) {
      throw new TemplateDataError('Event information is required for team registration template');
    }

    if (!message.payment) {
      throw new TemplateDataError('Payment information is required for team registration template');
    }

    if (!message.reservationId) {
      throw new TemplateDataError('Reservation ID is required for team registration template');
    }

    // Extract and validate team information
    const team = message.team;
    if (!team.name || !Array.isArray(team.members) || team.members.length === 0) {
      throw new TemplateDataError('Team name and members array are required');
    }

    // Validate team members
    team.members.forEach((member, index) => {
      if (!member.name || !member.email || typeof member.isCaptain !== 'boolean') {
        throw new TemplateDataError(`Team member at index ${index} missing required fields: name, email, or isCaptain`);
      }
    });

    // Extract participant information (team captain)
    const participant = message.participant;
    if (!participant.email || !participant.firstName || !participant.lastName) {
      throw new TemplateDataError('Participant (team captain) email, firstName, and lastName are required');
    }

    // Extract event information
    const event = message.event;
    if (!event.name || !event.date || !event.time || !event.location) {
      throw new TemplateDataError('Event name, date, time, and location are required');
    }

    // Extract payment information
    const payment = message.payment;
    if (!payment.amount || !payment.bankAccount) {
      throw new TemplateDataError('Payment amount and bank account are required');
    }

    // Transform team members to template format
    const teamMembers = team.members.map(member => ({
      member_name: member.name,
      member_discipline: member.role || 'Not specified',
      is_captain: member.isCaptain
    }));

    // Generate team ID if not provided
    const teamId = generateTeamId(team.name, message.reservationId);

    // Transform to template data format
    const templateData: TeamTemplateData = {
      event_name: event.name,
      event_date: event.date,
      event_time: event.time,
      event_location: event.location,
      team_name: team.name,
      team_id: teamId,
      team_members_count: team.members.length,
      team_members: teamMembers,
      payment_amount: payment.amount,
      bank_account: payment.bankAccount,
      reservation_id: message.reservationId
    };

    logger.debug({
      reservationId: message.reservationId,
      teamName: team.name,
      teamMembersCount: team.members.length,
      eventName: event.name
    }, 'Successfully transformed team registration message to template data');

    return templateData;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({
      messageType: message?.type,
      registrationType: message?.registrationType,
      reservationId: message?.reservationId,
      teamName: message?.team?.name,
      error: errorMessage
    }, 'Failed to transform team registration message to template data');

    if (error instanceof TemplateDataError) {
      throw error;
    }

    throw new TemplateDataError(
      `Failed to transform team registration message: ${errorMessage}`,
      { originalError: error, message }
    );
  }
}

/**
 * Transform payment confirmation message to payment confirmation template data
 * @param message Payment confirmation message
 * @returns ConfirmationTemplateData formatted for Maileroo template
 * @throws TemplateDataError if message is invalid or missing required fields
 */
export function transformToConfirmationTemplateData(message: PaymentConfirmationMessage): ConfirmationTemplateData {
  try {
    // Validate message type
    if (message.type !== 'payment_confirmed') {
      throw new TemplateDataError(`Invalid message type for confirmation template: ${message.type}`);
    }

    // Validate required fields
    if (!message.participant) {
      throw new TemplateDataError('Participant information is required for payment confirmation template');
    }

    if (!message.event) {
      throw new TemplateDataError('Event information is required for payment confirmation template');
    }

    if (!message.payment) {
      throw new TemplateDataError('Payment information is required for payment confirmation template');
    }

    if (!message.reservationId) {
      throw new TemplateDataError('Reservation ID is required for payment confirmation template');
    }

    // Extract participant information
    const participant = message.participant;
    if (!participant.email || !participant.firstName || !participant.lastName || !participant.participantId) {
      throw new TemplateDataError('Participant email, firstName, lastName, and participantId are required');
    }

    // Extract event information
    const event = message.event;
    if (!event.name || !event.date || !event.time || !event.location) {
      throw new TemplateDataError('Event name, date, time, and location are required');
    }

    // Extract payment information
    const payment = message.payment;
    if (!payment.amount || !payment.confirmationNumber || !payment.transferReference || !payment.paymentDate) {
      throw new TemplateDataError('Payment amount, confirmation number, transfer reference, and payment date are required');
    }

    // Transform to template data format
    const templateData: ConfirmationTemplateData = {
      event_name: event.name,
      event_date: event.date,
      event_time: event.time,
      event_location: event.location,
      participant_id: participant.participantId,
      confirmation_number: payment.confirmationNumber,
      payment_amount: payment.amount,
      transfer_reference: payment.transferReference,
      payment_date: payment.paymentDate
    };

    logger.debug({
      reservationId: message.reservationId,
      participantId: participant.participantId,
      confirmationNumber: payment.confirmationNumber,
      eventName: event.name
    }, 'Successfully transformed payment confirmation message to template data');

    return templateData;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({
      messageType: message?.type,
      reservationId: message?.reservationId,
      participantId: message?.participant?.participantId,
      error: errorMessage
    }, 'Failed to transform payment confirmation message to template data');

    if (error instanceof TemplateDataError) {
      throw error;
    }

    throw new TemplateDataError(
      `Failed to transform payment confirmation message: ${errorMessage}`,
      { originalError: error, message }
    );
  }
}

/**
 * Apply default values to template data to prevent rendering errors
 * @param templateData Template data to process
 * @param templateType Type of template (individual, team, confirmation)
 * @returns Template data with default values applied
 */
export function applyTemplateDataDefaults(
  templateData: Record<string, any>,
  templateType: 'individual' | 'team' | 'confirmation'
): Record<string, any> {
  try {
    if (!templateData || typeof templateData !== 'object') {
      throw new TemplateDataError('Template data must be a valid object');
    }

    const processedData = { ...templateData };

    // Apply default values for common fields
    const commonDefaults: Record<string, any> = {
      event_name: processedData.event_name || 'Event',
      event_date: processedData.event_date || 'TBD',
      event_time: processedData.event_time || 'TBD',
      event_location: processedData.event_location || 'TBD',
      payment_amount: processedData.payment_amount || '0'
    };

    // Apply template-specific defaults
    let specificDefaults: Record<string, any> = {};

    if (templateType === 'individual') {
      specificDefaults = {
        participant_id: processedData.participant_id || 'N/A',
        participant_name: processedData.participant_name || 'Participant',
        bank_account: processedData.bank_account || 'TBD',
        reservation_id: processedData.reservation_id || 'N/A'
      };
    } else if (templateType === 'team') {
      specificDefaults = {
        team_name: processedData.team_name || 'Team',
        team_id: processedData.team_id || 'N/A',
        team_members_count: processedData.team_members_count || 0,
        team_members: processedData.team_members || [],
        bank_account: processedData.bank_account || 'TBD',
        reservation_id: processedData.reservation_id || 'N/A'
      };

      // Ensure team_members array has proper defaults
      if (Array.isArray(processedData.team_members)) {
        specificDefaults.team_members = processedData.team_members.map((member: any) => ({
          member_name: member?.member_name || 'Team Member',
          member_discipline: member?.member_discipline || 'Not specified',
          is_captain: member?.is_captain || false
        }));
      }
    } else if (templateType === 'confirmation') {
      specificDefaults = {
        participant_id: processedData.participant_id || 'N/A',
        confirmation_number: processedData.confirmation_number || 'N/A',
        transfer_reference: processedData.transfer_reference || 'N/A',
        payment_date: processedData.payment_date || 'N/A'
      };
    }

    // Merge defaults with provided data (provided data takes precedence)
    const result = { ...commonDefaults, ...specificDefaults, ...processedData };

    logger.debug({
      templateType,
      originalFieldCount: Object.keys(templateData).length,
      processedFieldCount: Object.keys(result).length
    }, 'Applied default values to template data');

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({
      templateType,
      error: errorMessage
    }, 'Failed to apply default values to template data');

    if (error instanceof TemplateDataError) {
      throw error;
    }

    throw new TemplateDataError(
      `Failed to apply default values: ${errorMessage}`,
      { originalError: error, templateData, templateType }
    );
  }
}

/**
 * Validate template data completeness and format
 * @param templateData Template data to validate
 * @param templateType Type of template (individual, team, confirmation)
 * @throws TemplateDataError if template data is invalid
 */
export function validateTemplateData(
  templateData: Record<string, any>,
  templateType: 'individual' | 'team' | 'confirmation'
): void {
  try {
    if (!templateData || typeof templateData !== 'object') {
      throw new TemplateDataError('Template data must be a valid object');
    }

    // Define required fields for each template type
    const requiredFields: Record<string, string[]> = {
      individual: [
        'event_name', 'event_date', 'event_time', 'event_location',
        'participant_id', 'participant_name', 'payment_amount',
        'bank_account', 'reservation_id'
      ],
      team: [
        'event_name', 'event_date', 'event_time', 'event_location',
        'team_name', 'team_id', 'team_members_count', 'team_members',
        'payment_amount', 'bank_account', 'reservation_id'
      ],
      confirmation: [
        'event_name', 'event_date', 'event_time', 'event_location',
        'participant_id', 'confirmation_number', 'payment_amount',
        'transfer_reference', 'payment_date'
      ]
    };

    const required = requiredFields[templateType];
    const missing = required.filter(field =>
      !(field in templateData) ||
      templateData[field] === null ||
      templateData[field] === undefined ||
      (typeof templateData[field] === 'string' && templateData[field].trim() === '')
    );

    if (missing.length > 0) {
      throw new TemplateDataError(
        `Missing or empty required template data fields for ${templateType} template: ${missing.join(', ')}`,
        { templateType, missingFields: missing, providedFields: Object.keys(templateData) }
      );
    }

    // Validate team members array for team template
    if (templateType === 'team') {
      if (!Array.isArray(templateData.team_members)) {
        throw new TemplateDataError('team_members must be an array for team template');
      }

      if (templateData.team_members.length === 0) {
        throw new TemplateDataError('team_members array cannot be empty for team template');
      }

      // Validate team_members_count matches array length
      if (templateData.team_members_count !== templateData.team_members.length) {
        throw new TemplateDataError(
          `team_members_count (${templateData.team_members_count}) does not match team_members array length (${templateData.team_members.length})`
        );
      }

      // Validate each team member has required fields
      templateData.team_members.forEach((member: any, index: number) => {
        if (!member || typeof member !== 'object') {
          throw new TemplateDataError(`Team member at index ${index} must be a valid object`);
        }

        const memberRequiredFields = ['member_name', 'member_discipline', 'is_captain'];
        const memberMissing = memberRequiredFields.filter(field =>
          !(field in member) ||
          member[field] === null ||
          member[field] === undefined ||
          (typeof member[field] === 'string' && member[field].trim() === '')
        );

        if (memberMissing.length > 0) {
          throw new TemplateDataError(
            `Team member at index ${index} missing required fields: ${memberMissing.join(', ')}`
          );
        }

        // Validate is_captain is boolean
        if (typeof member.is_captain !== 'boolean') {
          throw new TemplateDataError(
            `Team member at index ${index} is_captain must be a boolean, got: ${typeof member.is_captain}`
          );
        }
      });
    }

    logger.debug({
      templateType,
      fieldCount: Object.keys(templateData).length,
      requiredFieldsCount: required.length
    }, 'Template data validation passed');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({
      templateType,
      providedFields: templateData ? Object.keys(templateData) : [],
      error: errorMessage
    }, 'Template data validation failed');

    if (error instanceof TemplateDataError) {
      throw error;
    }

    throw new TemplateDataError(
      `Template data validation failed: ${errorMessage}`,
      { originalError: error, templateData, templateType }
    );
  }
}

/**
 * Generate a participant ID from participant information
 * @param participant Participant information
 * @returns Generated participant ID
 */
function generateParticipantId(participant: { firstName: string; lastName: string; email: string }): string {
  // Create a simple participant ID from name and email hash
  const nameInitials = `${participant.firstName.charAt(0)}${participant.lastName.charAt(0)}`.toUpperCase();
  const emailHash = participant.email.split('@')[0].slice(-4);
  const timestamp = Date.now().toString().slice(-4);

  return `${nameInitials}${emailHash}${timestamp}`;
}

/**
 * Generate a team ID from team name and reservation ID
 * @param teamName Team name
 * @param reservationId Reservation ID
 * @returns Generated team ID
 */
function generateTeamId(teamName: string, reservationId: string): string {
  // Create a team ID from team name and reservation ID
  const teamPrefix = teamName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  const reservationSuffix = reservationId.slice(-4);

  return `TEAM${teamPrefix}${reservationSuffix}`;
}

/**
 * Transform any notification message to appropriate template data
 * @param message Notification message (registration or payment confirmation)
 * @returns Template data formatted for Maileroo template
 * @throws TemplateDataError if message type is not supported
 */
export function transformNotificationMessage(
  message: RegistrationNotificationMessage | PaymentConfirmationMessage
): IndividualTemplateData | TeamTemplateData | ConfirmationTemplateData {
  try {
    if (message.type === 'registration_success') {
      const registrationMessage = message as RegistrationNotificationMessage;

      if (registrationMessage.registrationType === 'individual') {
        return transformToIndividualTemplateData(registrationMessage);
      } else if (registrationMessage.registrationType === 'team') {
        return transformToTeamTemplateData(registrationMessage);
      } else {
        throw new TemplateDataError(`Unsupported registration type: ${registrationMessage.registrationType}`);
      }
    } else if (message.type === 'payment_confirmed') {
      return transformToConfirmationTemplateData(message as PaymentConfirmationMessage);
    } else {
      throw new TemplateDataError(`Unsupported message type: ${(message as any).type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({
      messageType: (message as any)?.type,
      error: errorMessage
    }, 'Failed to transform notification message');

    if (error instanceof TemplateDataError) {
      throw error;
    }

    throw new TemplateDataError(
      `Failed to transform notification message: ${errorMessage}`,
      { originalError: error, message }
    );
  }
}