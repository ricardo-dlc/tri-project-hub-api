/**
 * Core notification types and interfaces for the email notification system
 */

/**
 * Base message interface for all notification messages
 */
export interface BaseNotificationMessage {
  type: string;
  timestamp?: string;
  messageId?: string;
}

/**
 * Registration notification message sent when a registration is successful
 */
export interface RegistrationNotificationMessage extends BaseNotificationMessage {
  type: 'registration_success';
  registrationType: 'individual' | 'team';
  eventId: string;
  reservationId: string;
  participant: {
    email: string;
    firstName: string;
    lastName: string;
    participantId?: string; // For individual registrations
  };
  team?: {
    name: string;
    members: Array<{
      name: string;
      email: string;
      role?: string;
      isCaptain: boolean;
    }>;
  };
  event: {
    name: string;
    date: string;
    time: string;
    location: string;
  };
  payment: {
    amount: string;
    bankAccount: string;
    payment_reference: string;
  };
}

/**
 * Payment confirmation message sent when payment status is updated to paid
 */
export interface PaymentConfirmationMessage extends BaseNotificationMessage {
  type: 'payment_confirmed';
  reservationId: string;
  participant: {
    email: string;
    firstName: string;
    lastName: string;
    participantId: string;
  };
  event: {
    name: string;
    date: string;
    time: string;
    location: string;
  };
  payment: {
    amount: string;
    confirmationNumber: string;
    transferReference: string;
    paymentDate: string;
  };
}

/**
 * Union type for all notification messages
 */
export type NotificationMessage = RegistrationNotificationMessage | PaymentConfirmationMessage;

/**
 * SQS message wrapper for notification messages
 */
export interface SQSNotificationMessage {
  messageId: string;
  receiptHandle: string;
  body: string; // JSON stringified NotificationMessage
  attributes?: Record<string, string>;
}



/**
 * Error handling result for failed email processing
 */
export interface ErrorHandlingResult {
  action: 'retry' | 'dlq' | 'discard';
  delay?: number;
  reason: string;
}

/**
 * Validation result for message parsing
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}


