import { Duration } from 'aws-cdk-lib';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import type { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import type { LambdaFactory, StageConfig } from '../../types/infrastructure';
import type { EmailNotificationQueue } from '../queue/email-notification-queue';
import { getEmailNotificationConfig, validateEmailNotificationConfig, type EmailNotificationConfig } from './configs/email-notification-config';

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
  /** Optional environment configuration override (uses stage-specific config if not provided) */
  environment?: EmailNotificationConfig;
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

    try {
      // Get stage-specific email configuration or use provided override
      const emailConfig = environment || getEmailNotificationConfig(stageConfig);

      // Validate email configuration
      validateEmailNotificationConfig(emailConfig);

      // Create the email processor Lambda function
      this.function = this.createEmailProcessorFunction(
        lambdaFactory,
        stageConfig,
        emailQueue,
        emailConfig
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
   * @param emailConfig Email notification configuration
   * @returns NodejsFunction instance
   */
  private createEmailProcessorFunction(
    lambdaFactory: LambdaFactory,
    stageConfig: StageConfig,
    emailQueue: EmailNotificationQueue,
    emailConfig: EmailNotificationConfig
  ): NodejsFunction {
    // Build entry path for the email processor handler
    const entryPath = 'lambdas/features/notifications/handlers/emailProcessor.ts';

    // Create environment variables for the Lambda function
    const functionEnvironment = {
      STAGE: stageConfig.stageName,
      IS_PRODUCTION: stageConfig.isProduction.toString(),
      EMAIL_QUEUE_URL: emailQueue.getQueueUrl(),
      MAILEROO_API_KEY: emailConfig.mailerooApiKey,
      FROM_EMAIL: emailConfig.fromEmail,
      FROM_NAME: emailConfig.fromName,
      INDIVIDUAL_TEMPLATE_ID: emailConfig.individualTemplateId,
      TEAM_TEMPLATE_ID: emailConfig.teamTemplateId,
      CONFIRMATION_TEMPLATE_ID: emailConfig.confirmationTemplateId,
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
