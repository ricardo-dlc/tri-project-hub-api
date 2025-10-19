/**
 * Email service implementation using Maileroo SDK
 */

import { EmailAddress, MailerooClient } from 'maileroo-sdk';
import { logger } from '../../../shared/logger';
import { EmailConfigurationError } from '../errors/notification.errors';
import { EmailServiceConfig } from '../types/email.types';

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