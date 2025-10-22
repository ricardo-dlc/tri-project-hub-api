/**
 * Message builder utilities for creating notification messages
 */

import { PaymentConfirmationMessage, RegistrationNotificationMessage } from '../types/notification.types';

/**
 * Event data interface for building notification messages
 */
export interface EventData {
  name: string;
  date: string;
  time: string;
  location: string;
  registrationFee: number;
}

/**
 * Participant data interface for building notification messages
 */
export interface ParticipantData {
  email: string;
  firstName: string;
  lastName: string;
  participantId?: string;
}

/**
 * Team data interface for building team notification messages
 */
export interface TeamData {
  name: string;
  members: Array<{
    name: string;
    email: string;
    role?: string;
    isCaptain: boolean;
  }>;
}

/**
 * Payment data interface for building payment confirmation messages
 */
export interface PaymentData {
  amount: string;
  bankAccount: string;
  payment_reference?: string;
  confirmationNumber?: string;
  transferReference?: string;
  paymentDate?: string;
}

/**
 * Build a registration notification message for individual registration
 * @param eventId - The event ID
 * @param reservationId - The reservation ID
 * @param participant - Participant data
 * @param event - Event data
 * @param payment - Payment data
 * @returns RegistrationNotificationMessage
 */
export function buildIndividualRegistrationMessage(
  eventId: string,
  reservationId: string,
  participant: ParticipantData,
  event: EventData,
  payment: PaymentData
): RegistrationNotificationMessage {
  return {
    type: 'registration_success',
    registrationType: 'individual',
    eventId,
    reservationId,
    participant: {
      email: participant.email,
      firstName: participant.firstName,
      lastName: participant.lastName,
      participantId: participant.participantId,
    },
    event: {
      name: event.name,
      date: event.date,
      time: event.time,
      location: event.location,
    },
    payment: {
      amount: payment.amount,
      bankAccount: payment.bankAccount,
      payment_reference: payment.payment_reference || `PAY-${reservationId.slice(-10).toUpperCase()}`,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a registration notification message for team registration
 * @param eventId - The event ID
 * @param reservationId - The reservation ID
 * @param participant - Team captain data
 * @param team - Team data
 * @param event - Event data
 * @param payment - Payment data
 * @returns RegistrationNotificationMessage
 */
export function buildTeamRegistrationMessage(
  eventId: string,
  reservationId: string,
  participant: ParticipantData,
  team: TeamData,
  event: EventData,
  payment: PaymentData
): RegistrationNotificationMessage {
  return {
    type: 'registration_success',
    registrationType: 'team',
    eventId,
    reservationId,
    participant: {
      email: participant.email,
      firstName: participant.firstName,
      lastName: participant.lastName,
    },
    team: {
      name: team.name,
      members: team.members,
    },
    event: {
      name: event.name,
      date: event.date,
      time: event.time,
      location: event.location,
    },
    payment: {
      amount: payment.amount,
      bankAccount: payment.bankAccount,
      payment_reference: payment.payment_reference || `PAY-${reservationId.slice(-10).toUpperCase()}`,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a payment confirmation message
 * @param reservationId - The reservation ID
 * @param participant - Participant data
 * @param event - Event data
 * @param payment - Payment data with confirmation details
 * @returns PaymentConfirmationMessage
 */
export function buildPaymentConfirmationMessage(
  reservationId: string,
  participant: ParticipantData & { participantId: string },
  event: EventData,
  payment: PaymentData & {
    confirmationNumber: string;
    transferReference: string;
    paymentDate: string;
  }
): PaymentConfirmationMessage {
  return {
    type: 'payment_confirmed',
    reservationId,
    participant: {
      email: participant.email,
      firstName: participant.firstName,
      lastName: participant.lastName,
      participantId: participant.participantId,
    },
    event: {
      name: event.name,
      date: event.date,
      time: event.time,
      location: event.location,
    },
    payment: {
      amount: payment.amount,
      confirmationNumber: payment.confirmationNumber,
      transferReference: payment.transferReference,
      paymentDate: payment.paymentDate,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format registration fee as currency string
 * @param fee - Registration fee as number
 * @returns Formatted currency string
 */
export function formatRegistrationFee(fee: number): string {
  return fee.toFixed(2);
}

/**
 * Format event date and time for display
 * @param date - Event date string (ISO format)
 * @returns Formatted date and time for America/Cancun timezone
 */
export function formatEventDateTime(date: string): { date: string; time: string } {
  try {
    const eventDate = new Date(date);

    // Format date for America/Cancun timezone in Spanish
    const formattedDate = eventDate.toLocaleDateString('es-MX', {
      timeZone: 'America/Cancun',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // Format time for America/Cancun timezone in Spanish
    const formattedTime = eventDate.toLocaleTimeString('es-MX', {
      timeZone: 'America/Cancun',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return {
      date: formattedDate,
      time: formattedTime,
    };
  } catch (error) {
    // Fallback to original behavior if date parsing fails
    return {
      date,
      time: 'TBD',
    };
  }
}
