import { Duration } from 'aws-cdk-lib';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import type { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import type { LambdaFactory, StageConfig } from '../../types/infrastructure';
import type { EmailNotificationQueue } from '../queue/email-notification-queue';

/**
 * Properties for EmailProcessor construct
 */
export interface EmailProcessorProps {
  /** Lambda factory for creating functions */
  lambdaFactory: LambdaFactory;
  /** Stage configuration for naming and environment setup */
  stageConfig: StageConfig;
  /** Email notification queue to process messages from */
  emailQueue: EmailNotificationQueue;
  /** Environment variables for Maileroo configuration */
  environment: {
    /** Maileroo API key for sending emails */
    mailerooApiKey: string;
    /** Sender email address */
    fromEmail: string;
    /** Sender display name */
    fromName: string;
    /** Template ID for individual registration emails */
    individualTemplateId: string;
    /** Template ID for team registration emails */
    teamTemplateId: string;
    /** Template ID for payment confirmation emails */
    confirmationTemplateId: string;
  };
}

/**
 * EmailProcessor construct creates and configures the Lambda function
 * that processes SQS messages for email notifications.
 * 
 * This construct:
 * - Creates the email processor Lambda function using the factory pattern
 * - Configures environment variables for Maileroo integration
 * - Sets up SQS trigger with appropriate batch size and concurrency
 * - Grants necessary IAM permissions for SQS message processing
 * - Follows stage-aware resource naming conventions
 */
export class EmailProcessor extends Construct {
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, props: EmailProcessorProps) {
    super(scope, id);

    const { lambdaFactory, stageConfig, emailQueue, environment } = props;

    // Validate required props
    if (!lambdaFactory) {
      throw new Error('LambdaFactory is required for EmailProcessor construct');
    }

    if (!stageConfig) {
      throw new Error('StageConfiguration is required for EmailProcessor construct');
    }

    if (!emailQueue) {
      throw new Error('EmailNotificationQueue is required for EmailProcessor construct');
    }

    if (!environment) {
      throw new Error('Environment configuration is required for EmailProcessor construct');
    }

    // Validate environment variables
    this.validateEnvironment(environment);

    try {
      // Create the email processor Lambda function
      this.function = this.createEmailProcessorFunction(
        lambdaFactory,
        stageConfig,
        emailQueue,
        environment
      );

      // Configure SQS event source
      this.configureSqsEventSource(emailQueue);

      // Grant SQS permissions
      this.grantSqsPermissions(emailQueue);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create EmailProcessor construct: ${errorMessage}`);
    }
  }

  /**
   * Create the email processor Lambda function with proper configuration
   * @param lambdaFactory Lambda factory instance
   * @param stageConfig Stage configuration
   * @param emailQueue Email notification queue
   * @param environment Environment variables
   * @returns NodejsFunction instance
   */
  private createEmailProcessorFunction(
    lambdaFactory: LambdaFactory,
    stageConfig: StageConfig,
    emailQueue: EmailNotificationQueue,
    environment: EmailProcessorProps['environment']
  ): NodejsFunction {
    // Build entry path for the email processor handler
    const entryPath = 'lambdas/features/notifications/handlers/emailProcessor.ts';

    // Create environment variables for the Lambda function
    const functionEnvironment = {
      STAGE: stageConfig.stageName,
      IS_PRODUCTION: stageConfig.isProduction.toString(),
      EMAIL_QUEUE_URL: emailQueue.getQueueUrl(),
      MAILEROO_API_KEY: environment.mailerooApiKey,
      FROM_EMAIL: environment.fromEmail,
      FROM_NAME: environment.fromName,
      INDIVIDUAL_TEMPLATE_ID: environment.individualTemplateId,
      TEAM_TEMPLATE_ID: environment.teamTemplateId,
      CONFIRMATION_TEMPLATE_ID: environment.confirmationTemplateId,
    };

    // Create the Lambda function with email processor specific configuration
    const lambdaFunction = lambdaFactory.createFunction({
      functionName: 'email-processor',
      entry: entryPath,
      environment: functionEnvironment,
      timeout: Duration.seconds(60), // 60 seconds to handle email processing
      memorySize: 512, // 512 MB for email processing and Maileroo SDK
    });

    return lambdaFunction;
  }

  /**
   * Configure SQS event source for the Lambda function
   * @param emailQueue Email notification queue
   */
  private configureSqsEventSource(emailQueue: EmailNotificationQueue): void {
    // Configure SQS event source with appropriate settings
    const sqsEventSource = new SqsEventSource(emailQueue.queue, {
      batchSize: 10, // Process up to 10 messages per invocation
      maxBatchingWindow: Duration.seconds(5), // Wait up to 5 seconds to collect messages
      reportBatchItemFailures: true, // Enable partial batch failure reporting
    });

    // Add the SQS event source to the Lambda function
    this.function.addEventSource(sqsEventSource);

    // Set reserved concurrency to limit concurrent executions
    // This helps avoid overwhelming the Maileroo API
    this.function.addEnvironment('RESERVED_CONCURRENCY', '10');
  }

  /**
   * Grant necessary SQS permissions to the Lambda function
   * @param emailQueue Email notification queue
   */
  private grantSqsPermissions(emailQueue: EmailNotificationQueue): void {
    // Grant consume messages permission (includes ReceiveMessage, DeleteMessage, GetQueueAttributes)
    emailQueue.grantConsumeMessages(this.function);
  }

  /**
   * Validate environment configuration
   * @param environment Environment configuration to validate
   * @throws Error if environment configuration is invalid
   */
  private validateEnvironment(environment: EmailProcessorProps['environment']): void {
    const requiredFields = [
      'mailerooApiKey',
      'fromEmail',
      'fromName',
      'individualTemplateId',
      'teamTemplateId',
      'confirmationTemplateId'
    ];

    const missingFields = requiredFields.filter(field =>
      !environment[field as keyof typeof environment] ||
      environment[field as keyof typeof environment].trim() === ''
    );

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required environment fields: ${missingFields.join(', ')}`
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(environment.fromEmail)) {
      throw new Error(`Invalid email format for fromEmail: ${environment.fromEmail}`);
    }

    // Validate template IDs are numeric strings
    const templateIds = [
      environment.individualTemplateId,
      environment.teamTemplateId,
      environment.confirmationTemplateId
    ];

    templateIds.forEach((templateId, index) => {
      const templateNames = ['individualTemplateId', 'teamTemplateId', 'confirmationTemplateId'];
      if (isNaN(parseInt(templateId, 10))) {
        throw new Error(`${templateNames[index]} must be a valid number: ${templateId}`);
      }
    });
  }

  /**
   * Get the Lambda function for external access
   * @returns The email processor Lambda function
   */
  getFunction(): NodejsFunction {
    return this.function;
  }

  /**
   * Get the function name for monitoring and debugging
   * @returns The function name
   */
  getFunctionName(): string {
    return this.function.functionName;
  }

  /**
   * Get the function ARN for IAM policy configuration
   * @returns The function ARN
   */
  getFunctionArn(): string {
    return this.function.functionArn;
  }
}
