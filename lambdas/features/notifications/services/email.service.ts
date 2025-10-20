/**
 * Email service implementation using Maileroo SDK
 */

import { logger } from '@/shared/logger';
import { EmailAddress, MailerooClient } from 'maileroo-sdk';
import { EmailConfigurationError, MailerooApiError, TemplateDataError } from '../errors/notification.errors';
import { EmailProcessingResult, EmailRequest, EmailServiceConfig } from '../types/email.types';

/**
 * Email service class that handles email sending via Maileroo
 */
export class EmailService {
  private client: MailerooClient | null = null;
  private fromAddress: EmailAddress | null = null;
  private config: EmailServiceConfig;

  /**
   * Initialize the email service with configuration
   * @param config Email service configuration
   */
  constructor(config: EmailServiceConfig) {
    this.config = config;
    this.validateConfiguration(config);
  }

  /**
   * Initialize the email service asynchronously
   * This must be called after construction to initialize the Maileroo client
   */
  async initialize(): Promise<void> {
    if (!this.client) {
      this.initializeMailerooClient();
    }
    if (!this.fromAddress) {
      this.createSenderAddress();
    }
  }

  /**
   * Validate the email service configuration
   * @param config Configuration to validate
   * @throws EmailConfigurationError if configuration is invalid
   */
  private validateConfiguration(config: EmailServiceConfig): void {
    if (!config.mailerooApiKey) {
      throw new EmailConfigurationError('Maileroo API key is required');
    }

    if (!config.fromEmail) {
      throw new EmailConfigurationError('From email address is required');
    }

    if (!config.fromName) {
      throw new EmailConfigurationError('From name is required');
    }

    if (!config.templates) {
      throw new EmailConfigurationError('Template configuration is required');
    }

    if (!config.templates.individual || !config.templates.team || !config.templates.confirmation) {
      throw new EmailConfigurationError('All template IDs (individual, team, confirmation) are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(config.fromEmail)) {
      throw new EmailConfigurationError(`Invalid from email format: ${config.fromEmail}`);
    }

    logger.info('Email service configuration validated successfully');
  }

  /**
   * Initialize the Maileroo client with API key
   * @throws EmailConfigurationError if client initialization fails
   */
  private initializeMailerooClient(): void {
    try {
      this.client = new MailerooClient(this.config.mailerooApiKey);
      logger.info('Maileroo client initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to initialize Maileroo client');
      throw new EmailConfigurationError(
        `Failed to initialize Maileroo client: ${errorMessage}`,
        { originalError: error }
      );
    }
  }

  /**
   * Create sender EmailAddress object
   * @throws EmailConfigurationError if EmailAddress creation fails
   */
  private createSenderAddress(): void {
    try {
      this.fromAddress = new EmailAddress(this.config.fromEmail, this.config.fromName);
      logger.info({
        email: this.config.fromEmail,
        name: this.config.fromName
      }, 'Sender email address created successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to create sender EmailAddress');
      throw new EmailConfigurationError(
        `Failed to create sender EmailAddress: ${errorMessage}`,
        { originalError: error }
      );
    }
  }

  /**
   * Get the template ID for a specific email type
   * @param emailType Type of email (individual, team, confirmation)
   * @returns Template ID for the email type
   * @throws EmailConfigurationError if email type is invalid
   */
  public getTemplateId(emailType: 'individual' | 'team' | 'confirmation'): number {
    const templateId = this.config.templates[emailType];
    if (!templateId) {
      throw new EmailConfigurationError(`No template ID configured for email type: ${emailType}`);
    }
    return templateId;
  }

  /**
   * Create EmailAddress object for recipient
   * @param email Recipient email address
   * @param name Optional recipient name
   * @returns EmailAddress object
   * @throws EmailConfigurationError if EmailAddress creation fails
   */
  public createRecipientAddress(email: string, name?: string): EmailAddress {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new EmailConfigurationError(`Invalid recipient email format: ${email}`);
      }

      if (!this.client) {
        throw new EmailConfigurationError('Email service not initialized. Call initialize() first.');
      }

      return new EmailAddress(email, name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        email,
        name,
        error: errorMessage
      }, 'Failed to create recipient EmailAddress');
      throw new EmailConfigurationError(
        `Failed to create recipient EmailAddress: ${errorMessage}`,
        { originalError: error, email, name }
      );
    }
  }

  /**
   * Get the Maileroo client instance
   * @returns MailerooClient instance
   * @throws EmailConfigurationError if client is not initialized
   */
  public getClient(): MailerooClient {
    if (!this.client) {
      throw new EmailConfigurationError('Email service not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Get the sender EmailAddress
   * @returns Sender EmailAddress object
   * @throws EmailConfigurationError if sender address is not created
   */
  public getSenderAddress(): EmailAddress {
    if (!this.fromAddress) {
      throw new EmailConfigurationError('Email service not initialized. Call initialize() first.');
    }
    return this.fromAddress;
  }

  /**
   * Get the email service configuration
   * @returns Email service configuration
   */
  public getConfig(): EmailServiceConfig {
    return { ...this.config }; // Return a copy to prevent modification
  }

  /**
   * Test the email service configuration by attempting to initialize all components
   * @returns Promise<boolean> True if configuration is valid and client is ready
   * @throws EmailConfigurationError if configuration test fails
   */
  public async testConfiguration(): Promise<boolean> {
    try {
      // Ensure the service is initialized
      if (!this.client || !this.fromAddress) {
        await this.initialize();
      }

      // Test that all components are properly initialized
      if (!this.client) {
        throw new EmailConfigurationError('Maileroo client not initialized');
      }

      if (!this.fromAddress) {
        throw new EmailConfigurationError('Sender address not created');
      }

      // Test template IDs are accessible
      this.getTemplateId('individual');
      this.getTemplateId('team');
      this.getTemplateId('confirmation');

      logger.info('Email service configuration test passed');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Email service configuration test failed');
      throw error;
    }
  }

  /**
   * Validate template data to ensure all required fields are present
   * @param templateData Template data to validate
   * @param templateType Type of template (individual, team, confirmation)
   * @throws TemplateDataError if template data is invalid
   */
  private validateTemplateData(templateData: Record<string, any>, templateType: 'individual' | 'team' | 'confirmation'): void {
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
    const missing = required.filter(field => !(field in templateData) || templateData[field] === null || templateData[field] === undefined);

    if (missing.length > 0) {
      throw new TemplateDataError(
        `Missing required template data fields for ${templateType} template: ${missing.join(', ')}`,
        { templateType, missingFields: missing, providedData: Object.keys(templateData) }
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

      // Validate each team member has required fields
      templateData.team_members.forEach((member: any, index: number) => {
        if (!member || typeof member !== 'object') {
          throw new TemplateDataError(`Team member at index ${index} must be a valid object`);
        }

        const memberRequiredFields = ['member_name', 'member_discipline', 'is_captain'];
        const memberMissing = memberRequiredFields.filter(field => !(field in member));

        if (memberMissing.length > 0) {
          throw new TemplateDataError(
            `Team member at index ${index} missing required fields: ${memberMissing.join(', ')}`
          );
        }
      });
    }

    logger.debug({
      templateType,
      fieldCount: Object.keys(templateData).length
    }, 'Template data validation passed');
  }

  /**
   * Apply default values to template data to prevent rendering errors
   * @param templateData Template data to process
   * @param templateType Type of template
   * @returns Template data with default values applied
   */
  private applyTemplateDataDefaults(templateData: Record<string, any>, templateType: 'individual' | 'team' | 'confirmation'): Record<string, any> {
    const processedData = { ...templateData };

    // Apply default values for common fields
    const defaults: Record<string, any> = {
      event_name: processedData.event_name || 'Event',
      event_date: processedData.event_date || 'TBD',
      event_time: processedData.event_time || 'TBD',
      event_location: processedData.event_location || 'TBD',
      payment_amount: processedData.payment_amount || '0',
      bank_account: processedData.bank_account || 'TBD'
    };

    // Apply template-specific defaults
    if (templateType === 'individual') {
      defaults.participant_id = processedData.participant_id || 'N/A';
      defaults.participant_name = processedData.participant_name || 'Participant';
      defaults.reservation_id = processedData.reservation_id || 'N/A';
    } else if (templateType === 'team') {
      defaults.team_name = processedData.team_name || 'Team';
      defaults.team_id = processedData.team_id || 'N/A';
      defaults.team_members_count = processedData.team_members_count || 0;
      defaults.team_members = processedData.team_members || [];
      defaults.reservation_id = processedData.reservation_id || 'N/A';
    } else if (templateType === 'confirmation') {
      defaults.participant_id = processedData.participant_id || 'N/A';
      defaults.confirmation_number = processedData.confirmation_number || 'N/A';
      defaults.transfer_reference = processedData.transfer_reference || 'N/A';
      defaults.payment_date = processedData.payment_date || 'N/A';
    }

    // Merge defaults with provided data (provided data takes precedence)
    return { ...defaults, ...processedData };
  }

  /**
   * Send a templated email using Maileroo SDK
   * @param emailRequest Email request containing recipient, subject, template ID, and template data
   * @returns Promise<string> Reference ID from Maileroo for tracking
   * @throws EmailConfigurationError if service is not initialized
   * @throws TemplateDataError if template data is invalid
   * @throws MailerooApiError if email sending fails
   */
  public async sendTemplatedEmail(emailRequest: EmailRequest): Promise<string> {
    const startTime = Date.now();

    try {
      // Ensure service is initialized
      if (!this.client || !this.fromAddress) {
        throw new EmailConfigurationError('Email service not initialized. Call initialize() first.');
      }

      // Validate email request
      if (!emailRequest) {
        throw new TemplateDataError('Email request is required');
      }

      if (!emailRequest.to || !emailRequest.to.email) {
        throw new TemplateDataError('Recipient email address is required');
      }

      if (!emailRequest.subject) {
        throw new TemplateDataError('Email subject is required');
      }

      if (!emailRequest.templateId) {
        throw new TemplateDataError('Template ID is required');
      }

      if (!emailRequest.templateData) {
        throw new TemplateDataError('Template data is required');
      }

      // Determine template type based on template ID
      let templateType: 'individual' | 'team' | 'confirmation';
      if (emailRequest.templateId === this.config.templates.individual) {
        templateType = 'individual';
      } else if (emailRequest.templateId === this.config.templates.team) {
        templateType = 'team';
      } else if (emailRequest.templateId === this.config.templates.confirmation) {
        templateType = 'confirmation';
      } else {
        throw new TemplateDataError(`Unknown template ID: ${emailRequest.templateId}`);
      }

      // Validate and process template data
      this.validateTemplateData(emailRequest.templateData, templateType);
      const processedTemplateData = this.applyTemplateDataDefaults(emailRequest.templateData, templateType);

      // Create recipient EmailAddress
      const recipientAddress = this.createRecipientAddress(emailRequest.to.email, emailRequest.to.name);

      // Log email sending attempt
      logger.info({
        recipient: emailRequest.to.email,
        recipientName: emailRequest.to.name,
        subject: emailRequest.subject,
        templateId: emailRequest.templateId,
        templateType,
        reservationId: processedTemplateData.reservation_id
      }, 'Attempting to send templated email');

      // Call Maileroo sendTemplatedEmail
      const referenceId = await this.client.sendTemplatedEmail({
        from: this.fromAddress,
        to: recipientAddress,
        subject: emailRequest.subject,
        template_id: emailRequest.templateId,
        template_data: processedTemplateData
      });

      const duration = Date.now() - startTime;

      // Log successful email sending
      logger.info({
        recipient: emailRequest.to.email,
        subject: emailRequest.subject,
        templateId: emailRequest.templateId,
        templateType,
        referenceId,
        duration,
        reservationId: processedTemplateData.reservation_id
      }, 'Email sent successfully');

      return referenceId;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Handle different types of errors
      if (error instanceof EmailConfigurationError || error instanceof TemplateDataError) {
        // Re-throw configuration and template data errors as-is
        logger.error({
          recipient: emailRequest?.to?.email,
          subject: emailRequest?.subject,
          templateId: emailRequest?.templateId,
          error: error.message,
          duration,
          reservationId: emailRequest?.templateData?.reservation_id
        }, 'Email sending failed due to configuration or template data error');
        throw error;
      }

      // Handle Maileroo API errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRetryable = this.isRetryableError(error);

      logger.error({
        recipient: emailRequest?.to?.email,
        subject: emailRequest?.subject,
        templateId: emailRequest?.templateId,
        error: errorMessage,
        retryable: isRetryable,
        duration,
        reservationId: emailRequest?.templateData?.reservation_id,
        originalError: error
      }, 'Email sending failed due to Maileroo API error');

      throw new MailerooApiError(
        `Failed to send templated email: ${errorMessage}`,
        isRetryable,
        {
          originalError: error,
          recipient: emailRequest?.to?.email,
          templateId: emailRequest?.templateId,
          duration
        }
      );
    }
  }

  /**
   * Determine if an error is retryable based on error type and message
   * @param error Error to analyze
   * @returns boolean indicating if the error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network-related errors are typically retryable
    if (error?.code === 'ECONNRESET' ||
      error?.code === 'ENOTFOUND' ||
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ECONNREFUSED') {
      return true;
    }

    // HTTP status codes that indicate retryable errors
    if (error?.response?.status) {
      const status = error.response.status;
      // 5xx server errors and 429 rate limiting are retryable
      if (status >= 500 || status === 429) {
        return true;
      }
      // 4xx client errors (except rate limiting) are not retryable
      if (status >= 400 && status < 500) {
        return false;
      }
    }

    // Maileroo-specific error messages that indicate retryable conditions
    const errorMessage = error?.message?.toLowerCase() || '';
    if (errorMessage.includes('rate limit') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('service unavailable') ||
      errorMessage.includes('temporary')) {
      return true;
    }

    // Authentication and validation errors are not retryable
    if (errorMessage.includes('authentication') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden')) {
      return false;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Create an EmailRequest object for a specific template type
   * @param templateType Type of template (individual, team, confirmation)
   * @param recipientEmail Recipient email address
   * @param recipientName Optional recipient name
   * @param subject Email subject
   * @param templateData Template data for the email
   * @returns EmailRequest object ready for sending
   * @throws EmailConfigurationError if template type is invalid
   */
  public createEmailRequest(
    templateType: 'individual' | 'team' | 'confirmation',
    recipientEmail: string,
    recipientName: string | undefined,
    subject: string,
    templateData: Record<string, any>
  ): EmailRequest {
    const templateId = this.getTemplateId(templateType);

    return {
      to: {
        email: recipientEmail,
        name: recipientName
      },
      subject,
      templateId,
      templateData
    };
  }

  /**
   * Send an email with automatic template type detection and validation
   * @param templateType Type of template to use
   * @param recipientEmail Recipient email address
   * @param recipientName Optional recipient name
   * @param subject Email subject
   * @param templateData Template data for the email
   * @returns Promise<EmailProcessingResult> Result of the email sending operation
   */
  public async sendEmail(
    templateType: 'individual' | 'team' | 'confirmation',
    recipientEmail: string,
    recipientName: string | undefined,
    subject: string,
    templateData: Record<string, any>
  ): Promise<EmailProcessingResult> {
    try {
      const emailRequest = this.createEmailRequest(templateType, recipientEmail, recipientName, subject, templateData);
      const referenceId = await this.sendTemplatedEmail(emailRequest);

      return {
        success: true,
        referenceId,
        retryable: false
      };
    } catch (error) {
      const isRetryable = error instanceof MailerooApiError ? error.retryable : false;

      return {
        success: false,
        error: {
          code: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error instanceof Error && 'details' in error ? (error as any).details : undefined
        },
        retryable: isRetryable
      };
    }
  }
}
/**
 * Factory function to create and initialize an EmailService instance
 * @param config Email service configuration
 * @returns Promise<EmailService> Initialized email service instance
 */
export async function createEmailService(config: EmailServiceConfig): Promise<EmailService> {
  const service = new EmailService(config);
  await service.initialize();
  return service;
}
