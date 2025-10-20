/**
 * Email processor Lambda function for handling SQS notification messages
 * 
 * This Lambda function processes SQS messages containing notification requests
 * and sends emails via the Maileroo service. It handles both registration
 * notifications and payment confirmations with comprehensive error handling
 * and retry logic.
 */

import { createFeatureLogger } from '@/shared/logger';
import { SQSEvent, SQSHandler, SQSRecord } from 'aws-lambda';
import { EmailConfigurationError, MailerooApiError, TemplateDataError } from '../errors/notification.errors';
import { EmailService, createEmailService } from '../services/email.service';
import { EmailProcessingResult, EmailServiceConfig } from '../types/email.types';
import {
  ErrorHandlingResult,
  NotificationMessage,
  PaymentConfirmationMessage,
  RegistrationNotificationMessage,
  SQSNotificationMessage
} from '../types/notification.types';
import {
  isPaymentConfirmationMessage,
  isRegistrationNotificationMessage,
  parseAndValidateMessage
} from '../utils/message-validation.utils';
import {
  transformToConfirmationTemplateData,
  transformToIndividualTemplateData,
  transformToTeamTemplateData
} from '../utils/template-data.utils';

const logger = createFeatureLogger('email-processor');

/**
 * Email processor class that handles SQS message processing and email sending
 */
class EmailProcessor {
  private emailService: EmailService | null = null;
  private config: EmailServiceConfig;

  constructor() {
    this.config = this.loadConfiguration();
  }

  /**
   * Load email service configuration from environment variables
   * @returns EmailServiceConfig
   * @throws EmailConfigurationError if required environment variables are missing
   */
  private loadConfiguration(): EmailServiceConfig {
    const requiredEnvVars = [
      'MAILEROO_API_KEY',
      'FROM_EMAIL',
      'FROM_NAME',
      'INDIVIDUAL_TEMPLATE_ID',
      'TEAM_TEMPLATE_ID',
      'CONFIRMATION_TEMPLATE_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new EmailConfigurationError(
        `Missing required environment variables: ${missingVars.join(', ')}`
      );
    }

    const config: EmailServiceConfig = {
      mailerooApiKey: process.env.MAILEROO_API_KEY!,
      fromEmail: process.env.FROM_EMAIL!,
      fromName: process.env.FROM_NAME!,
      templates: {
        individual: parseInt(process.env.INDIVIDUAL_TEMPLATE_ID!, 10),
        team: parseInt(process.env.TEAM_TEMPLATE_ID!, 10),
        confirmation: parseInt(process.env.CONFIRMATION_TEMPLATE_ID!, 10)
      }
    };

    // Validate template IDs are valid numbers
    if (isNaN(config.templates.individual) || isNaN(config.templates.team) || isNaN(config.templates.confirmation)) {
      throw new EmailConfigurationError('Template IDs must be valid numbers');
    }

    logger.info({
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      templateIds: config.templates
    }, 'Email processor configuration loaded');

    return config;
  }

  /**
   * Initialize the email service
   * @returns Promise<void>
   */
  async initialize(): Promise<void> {
    if (!this.emailService) {
      this.emailService = await createEmailService(this.config);
      logger.info('Email service initialized successfully');
    }
  }

  /**
   * Process a single SQS record
   * @param record SQS record to process
   * @returns Promise<EmailProcessingResult>
   */
  async processRecord(record: SQSRecord): Promise<EmailProcessingResult> {
    const startTime = Date.now();
    const messageId = record.messageId;

    try {
      logger.info({
        messageId,
        receiptHandle: record.receiptHandle
      }, 'Processing SQS message');

      // Ensure email service is initialized
      await this.initialize();

      // Parse and validate the SQS message
      const sqsMessage: SQSNotificationMessage = {
        messageId: record.messageId,
        receiptHandle: record.receiptHandle,
        body: record.body,
        attributes: record.attributes ? record.attributes as unknown as Record<string, string> : undefined
      };

      const validationResult = parseAndValidateMessage(sqsMessage);
      if (!validationResult.success) {
        throw new TemplateDataError(
          `Message validation failed: ${validationResult.error}`,
          { messageId, validationError: validationResult.error }
        );
      }

      const message = validationResult.data!;

      // Route message based on type
      const result = await this.routeMessage(message);

      const duration = Date.now() - startTime;
      logger.info({
        messageId,
        messageType: message.type,
        success: result.success,
        referenceId: result.referenceId,
        duration
      }, 'Message processed successfully');

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorHandlingResult = this.handleProcessingError(error, messageId);

      logger.error({
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: errorHandlingResult.action === 'retry',
        duration,
        errorType: error?.constructor?.name
      }, 'Message processing failed');

      return {
        success: false,
        error: {
          code: error instanceof Error && 'code' in error ? (error as any).code : 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown processing error',
          details: error instanceof Error && 'details' in error ? (error as any).details : undefined
        },
        retryable: errorHandlingResult.action === 'retry'
      };
    }
  }

  /**
   * Route message to appropriate email handler based on message type
   * @param message Validated notification message
   * @returns Promise<EmailProcessingResult>
   */
  private async routeMessage(message: NotificationMessage): Promise<EmailProcessingResult> {
    if (isRegistrationNotificationMessage(message)) {
      return this.handleRegistrationNotification(message);
    } else if (isPaymentConfirmationMessage(message)) {
      return this.handlePaymentConfirmation(message);
    } else {
      throw new TemplateDataError(`Unsupported message type: ${(message as any).type}`);
    }
  }

  /**
   * Handle registration notification messages
   * @param message Registration notification message
   * @returns Promise<EmailProcessingResult>
   */
  private async handleRegistrationNotification(message: RegistrationNotificationMessage): Promise<EmailProcessingResult> {
    try {
      if (!this.emailService) {
        throw new EmailConfigurationError('Email service not initialized');
      }

      let templateData: any;
      let templateType: 'individual' | 'team';
      let subject: string;

      if (message.registrationType === 'individual') {
        templateData = transformToIndividualTemplateData(message);
        templateType = 'individual';
        subject = `Registration Confirmation - ${message.event.name}`;
      } else if (message.registrationType === 'team') {
        templateData = transformToTeamTemplateData(message);
        templateType = 'team';
        subject = `Team Registration Confirmation - ${message.event.name}`;
      } else {
        throw new TemplateDataError(`Unsupported registration type: ${message.registrationType}`);
      }

      // Send email using the email service
      const result = await this.emailService.sendEmail(
        templateType,
        message.participant.email,
        `${message.participant.firstName} ${message.participant.lastName}`,
        subject,
        templateData
      );

      logger.info({
        messageId: message.messageId,
        reservationId: message.reservationId,
        registrationType: message.registrationType,
        recipient: message.participant.email,
        referenceId: result.referenceId
      }, 'Registration notification email sent successfully');

      return result;

    } catch (error) {
      logger.error({
        messageId: message.messageId,
        reservationId: message.reservationId,
        registrationType: message.registrationType,
        recipient: message.participant.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to send registration notification email');

      throw error;
    }
  }

  /**
   * Handle payment confirmation messages
   * @param message Payment confirmation message
   * @returns Promise<EmailProcessingResult>
   */
  private async handlePaymentConfirmation(message: PaymentConfirmationMessage): Promise<EmailProcessingResult> {
    try {
      if (!this.emailService) {
        throw new EmailConfigurationError('Email service not initialized');
      }

      const templateData = transformToConfirmationTemplateData(message);
      const subject = `Payment Confirmed - ${message.event.name}`;

      // Send email using the email service
      const result = await this.emailService.sendEmail(
        'confirmation',
        message.participant.email,
        `${message.participant.firstName} ${message.participant.lastName}`,
        subject,
        templateData
      );

      logger.info({
        messageId: message.messageId,
        reservationId: message.reservationId,
        participantId: message.participant.participantId,
        recipient: message.participant.email,
        confirmationNumber: message.payment.confirmationNumber,
        referenceId: result.referenceId
      }, 'Payment confirmation email sent successfully');

      return result;

    } catch (error) {
      logger.error({
        messageId: message.messageId,
        reservationId: message.reservationId,
        participantId: message.participant.participantId,
        recipient: message.participant.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to send payment confirmation email');

      throw error;
    }
  }

  /**
   * Handle processing errors and determine retry strategy
   * @param error Error that occurred during processing
   * @param messageId SQS message ID for context
   * @returns ErrorHandlingResult
   */
  private handleProcessingError(error: any, messageId: string): ErrorHandlingResult {
    // Configuration errors are not retryable
    if (error instanceof EmailConfigurationError) {
      return {
        action: 'dlq',
        reason: 'Configuration error - not retryable',
      };
    }

    // Template data errors are not retryable
    if (error instanceof TemplateDataError) {
      return {
        action: 'dlq',
        reason: 'Template data error - not retryable',
      };
    }

    // Maileroo API errors - check if retryable
    if (error instanceof MailerooApiError) {
      if (error.retryable) {
        return {
          action: 'retry',
          delay: 30, // 30 seconds delay for retryable API errors
          reason: 'Retryable Maileroo API error',
        };
      } else {
        return {
          action: 'dlq',
          reason: 'Non-retryable Maileroo API error',
        };
      }
    }

    // Network and timeout errors are retryable
    if (error?.code === 'ECONNRESET' ||
      error?.code === 'ENOTFOUND' ||
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ECONNREFUSED') {
      return {
        action: 'retry',
        delay: 60, // 60 seconds delay for network errors
        reason: 'Network error - retryable',
      };
    }

    // Unknown errors default to retry
    return {
      action: 'retry',
      delay: 30,
      reason: 'Unknown error - defaulting to retry',
    };
  }

  /**
   * Process multiple SQS records in batch
   * @param records Array of SQS records
   * @returns Promise<EmailProcessingResult[]>
   */
  async processRecords(records: SQSRecord[]): Promise<EmailProcessingResult[]> {
    logger.info({ recordCount: records.length }, 'Processing batch of SQS records');

    const results = await Promise.allSettled(
      records.map(record => this.processRecord(record))
    );

    const processedResults: EmailProcessingResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        processedResults.push(result.value);
        if (result.value.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } else {
        // Handle promise rejection
        processedResults.push({
          success: false,
          error: {
            code: 'PROMISE_REJECTION',
            message: result.reason instanceof Error ? result.reason.message : 'Promise rejected',
            details: { recordIndex: index }
          },
          retryable: true
        });
        failureCount++;
      }
    });

    logger.info({
      totalRecords: records.length,
      successCount,
      failureCount
    }, 'Batch processing completed');

    return processedResults;
  }
}

// Create singleton instance
const emailProcessor = new EmailProcessor();

/**
 * Lambda handler for processing SQS messages
 * @param event SQS event containing messages to process
 * @returns Promise<void>
 */
export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  const startTime = Date.now();

  logger.info({
    recordCount: event.Records.length,
    eventSource: event.Records[0]?.eventSource
  }, 'Email processor Lambda invoked');

  try {
    // Process all records in the batch
    const results = await emailProcessor.processRecords(event.Records);

    // Check for any failed records that should cause the Lambda to fail
    const nonRetryableFailures = results.filter(result =>
      !result.success && !result.retryable
    );

    const retryableFailures = results.filter(result =>
      !result.success && result.retryable
    );

    const successCount = results.filter(result => result.success).length;

    const duration = Date.now() - startTime;

    logger.info({
      totalRecords: event.Records.length,
      successCount,
      retryableFailures: retryableFailures.length,
      nonRetryableFailures: nonRetryableFailures.length,
      duration
    }, 'Email processor Lambda completed');

    // If there are retryable failures, throw an error to trigger SQS retry
    if (retryableFailures.length > 0) {
      const errorMessage = `${retryableFailures.length} messages failed with retryable errors`;
      logger.warn({ retryableFailures: retryableFailures.length }, errorMessage);
      throw new Error(errorMessage);
    }

    // Non-retryable failures are logged but don't cause Lambda failure
    // SQS will automatically move these to DLQ based on redrive policy
    if (nonRetryableFailures.length > 0) {
      logger.error({
        nonRetryableFailures: nonRetryableFailures.length,
        failures: nonRetryableFailures.map(f => f.error?.message)
      }, 'Some messages failed with non-retryable errors');
    }

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      recordCount: event.Records.length,
      duration,
      errorType: error?.constructor?.name
    }, 'Email processor Lambda failed');

    // Re-throw to trigger SQS retry mechanism
    throw error;
  }
};
