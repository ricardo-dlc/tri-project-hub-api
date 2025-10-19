/**
 * Custom error classes for the notification system
 */

/**
 * Base error class for notification system errors
 */
export class NotificationError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly details?: any;

  constructor(message: string, code: string, retryable: boolean = false, details?: any) {
    super(message);
    this.name = 'NotificationError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

/**
 * Error thrown when email service configuration is invalid
 */
export class EmailConfigurationError extends NotificationError {
  constructor(message: string, details?: any) {
    super(message, 'EMAIL_CONFIGURATION_ERROR', false, details);
    this.name = 'EmailConfigurationError';
  }
}

/**
 * Error thrown when template data is invalid or incomplete
 */
export class TemplateDataError extends NotificationError {
  constructor(message: string, details?: any) {
    super(message, 'TEMPLATE_DATA_ERROR', false, details);
    this.name = 'TemplateDataError';
  }
}

/**
 * Error thrown when Maileroo API calls fail
 */
export class MailerooApiError extends NotificationError {
  constructor(message: string, retryable: boolean = true, details?: any) {
    super(message, 'MAILEROO_API_ERROR', retryable, details);
    this.name = 'MailerooApiError';
  }
}

/**
 * Error thrown when SQS message processing fails
 */
export class MessageProcessingError extends NotificationError {
  constructor(message: string, retryable: boolean = true, details?: any) {
    super(message, 'MESSAGE_PROCESSING_ERROR', retryable, details);
    this.name = 'MessageProcessingError';
  }
}

/**
 * Error thrown when message validation fails
 */
export class MessageValidationError extends NotificationError {
  constructor(message: string, details?: any) {
    super(message, 'MESSAGE_VALIDATION_ERROR', false, details);
    this.name = 'MessageValidationError';
  }
}
