/**
 * Message validation utilities for SQS notification messages
 */

import { MessageValidationError } from '../errors/notification.errors';
import {
  NotificationMessage,
  PaymentConfirmationMessage,
  RegistrationNotificationMessage,
  SQSNotificationMessage,
  ValidationResult
} from '../types/notification.types';

/**
 * Validates that a value is a non-empty string
 */
function validateString(value: any, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MessageValidationError(`${fieldName} must be a non-empty string`, fieldName);
  }
  return value.trim();
}

/**
 * Validates that a value is a valid email address
 */
function validateEmail(value: any, fieldName: string): string {
  const email = validateString(value, fieldName);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new MessageValidationError(`${fieldName} must be a valid email address`, fieldName);
  }
  return email;
}

/**
 * Validates participant object structure
 */
function validateParticipant(participant: any, fieldName: string, requireParticipantId: boolean = false): RegistrationNotificationMessage['participant'] | PaymentConfirmationMessage['participant'] {
  if (!participant || typeof participant !== 'object') {
    throw new MessageValidationError(`${fieldName} must be an object`, fieldName);
  }

  const validated = {
    email: validateEmail(participant.email, `${fieldName}.email`),
    firstName: validateString(participant.firstName, `${fieldName}.firstName`),
    lastName: validateString(participant.lastName, `${fieldName}.lastName`),
  };

  if (requireParticipantId) {
    return {
      ...validated,
      participantId: validateString(participant.participantId, `${fieldName}.participantId`)
    };
  }

  if (participant.participantId !== undefined) {
    return {
      ...validated,
      participantId: validateString(participant.participantId, `${fieldName}.participantId`)
    };
  }

  return validated;
}

/**
 * Validates event object structure
 */
function validateEvent(event: any, fieldName: string): RegistrationNotificationMessage['event'] {
  if (!event || typeof event !== 'object') {
    throw new MessageValidationError(`${fieldName} must be an object`, fieldName);
  }

  return {
    name: validateString(event.name, `${fieldName}.name`),
    date: validateString(event.date, `${fieldName}.date`),
    time: validateString(event.time, `${fieldName}.time`),
    location: validateString(event.location, `${fieldName}.location`)
  };
}

/**
 * Validates team object structure for team registrations
 */
function validateTeam(team: any, fieldName: string): RegistrationNotificationMessage['team'] {
  if (!team || typeof team !== 'object') {
    throw new MessageValidationError(`${fieldName} must be an object`, fieldName);
  }

  if (!Array.isArray(team.members)) {
    throw new MessageValidationError(`${fieldName}.members must be an array`, `${fieldName}.members`);
  }

  const members = team.members.map((member: any, index: number) => {
    if (!member || typeof member !== 'object') {
      throw new MessageValidationError(`${fieldName}.members[${index}] must be an object`, `${fieldName}.members[${index}]`);
    }

    return {
      name: validateString(member.name, `${fieldName}.members[${index}].name`),
      email: validateEmail(member.email, `${fieldName}.members[${index}].email`),
      role: member.role ? validateString(member.role, `${fieldName}.members[${index}].role`) : undefined,
      isCaptain: typeof member.isCaptain === 'boolean' ? member.isCaptain : false
    };
  });

  return {
    name: validateString(team.name, `${fieldName}.name`),
    members
  };
}

/**
 * Validates payment object structure for registration notifications
 */
function validateRegistrationPayment(payment: any, fieldName: string): RegistrationNotificationMessage['payment'] {
  if (!payment || typeof payment !== 'object') {
    throw new MessageValidationError(`${fieldName} must be an object`, fieldName);
  }

  return {
    amount: validateString(payment.amount, `${fieldName}.amount`),
    bankAccount: validateString(payment.bankAccount, `${fieldName}.bankAccount`),
    payment_reference: validateString(payment.payment_reference, `${fieldName}.payment_reference`)
  };
}

/**
 * Validates payment object structure for payment confirmations
 */
function validateConfirmationPayment(payment: any, fieldName: string): PaymentConfirmationMessage['payment'] {
  if (!payment || typeof payment !== 'object') {
    throw new MessageValidationError(`${fieldName} must be an object`, fieldName);
  }

  return {
    amount: validateString(payment.amount, `${fieldName}.amount`),
    confirmationNumber: validateString(payment.confirmationNumber, `${fieldName}.confirmationNumber`),
    transferReference: validateString(payment.transferReference, `${fieldName}.transferReference`),
    paymentDate: validateString(payment.paymentDate, `${fieldName}.paymentDate`)
  };
}

/**
 * Validates a registration notification message
 */
export function validateRegistrationNotificationMessage(data: any): ValidationResult<RegistrationNotificationMessage> {
  try {
    if (!data || typeof data !== 'object') {
      throw new MessageValidationError('Message must be an object');
    }

    if (data.type !== 'registration_success') {
      throw new MessageValidationError('Message type must be "registration_success"', 'type');
    }

    const registrationType = data.registrationType;
    if (registrationType !== 'individual' && registrationType !== 'team') {
      throw new MessageValidationError('Registration type must be "individual" or "team"', 'registrationType');
    }

    const validated: RegistrationNotificationMessage = {
      type: 'registration_success',
      registrationType,
      eventId: validateString(data.eventId, 'eventId'),
      reservationId: validateString(data.reservationId, 'reservationId'),
      participant: validateParticipant(data.participant, 'participant', false),
      event: validateEvent(data.event, 'event'),
      payment: validateRegistrationPayment(data.payment, 'payment')
    };

    // Add optional fields
    if (data.timestamp) {
      validated.timestamp = validateString(data.timestamp, 'timestamp');
    }

    if (data.messageId) {
      validated.messageId = validateString(data.messageId, 'messageId');
    }

    // Validate team data for team registrations
    if (registrationType === 'team') {
      if (!data.team) {
        throw new MessageValidationError('Team data is required for team registrations', 'team');
      }
      validated.team = validateTeam(data.team, 'team');
    }

    return {
      success: true,
      data: validated
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof MessageValidationError ? error.message : 'Unknown validation error'
    };
  }
}

/**
 * Validates a payment confirmation message
 */
export function validatePaymentConfirmationMessage(data: any): ValidationResult<PaymentConfirmationMessage> {
  try {
    if (!data || typeof data !== 'object') {
      throw new MessageValidationError('Message must be an object');
    }

    if (data.type !== 'payment_confirmed') {
      throw new MessageValidationError('Message type must be "payment_confirmed"', 'type');
    }

    const validated: PaymentConfirmationMessage = {
      type: 'payment_confirmed',
      reservationId: validateString(data.reservationId, 'reservationId'),
      participant: validateParticipant(data.participant, 'participant', true) as PaymentConfirmationMessage['participant'],
      event: validateEvent(data.event, 'event'),
      payment: validateConfirmationPayment(data.payment, 'payment')
    };

    // Add optional fields
    if (data.timestamp) {
      validated.timestamp = validateString(data.timestamp, 'timestamp');
    }

    if (data.messageId) {
      validated.messageId = validateString(data.messageId, 'messageId');
    }

    return {
      success: true,
      data: validated
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof MessageValidationError ? error.message : 'Unknown validation error'
    };
  }
}

/**
 * Parses and validates an SQS message body
 */
export function parseAndValidateMessage(sqsMessage: SQSNotificationMessage): ValidationResult<NotificationMessage> {
  try {
    // Parse JSON body
    let parsedBody: any;
    try {
      parsedBody = JSON.parse(sqsMessage.body);
    } catch (error) {
      return {
        success: false,
        error: 'Invalid JSON in message body'
      };
    }

    // Add SQS metadata to parsed body
    if (!parsedBody.messageId && sqsMessage.messageId) {
      parsedBody.messageId = sqsMessage.messageId;
    }

    if (!parsedBody.timestamp) {
      parsedBody.timestamp = new Date().toISOString();
    }

    // Determine message type and validate accordingly
    const messageType = parsedBody.type;

    if (messageType === 'registration_success') {
      return validateRegistrationNotificationMessage(parsedBody);
    } else if (messageType === 'payment_confirmed') {
      return validatePaymentConfirmationMessage(parsedBody);
    } else {
      return {
        success: false,
        error: `Unknown message type: ${messageType}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    };
  }
}

/**
 * Type guard to check if a message is a registration notification
 */
export function isRegistrationNotificationMessage(message: NotificationMessage): message is RegistrationNotificationMessage {
  return message.type === 'registration_success';
}

/**
 * Type guard to check if a message is a payment confirmation
 */
export function isPaymentConfirmationMessage(message: NotificationMessage): message is PaymentConfirmationMessage {
  return message.type === 'payment_confirmed';
}