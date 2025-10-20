import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { StageConfiguration } from '../config/stage-config';

/**
 * Properties for EmailNotificationQueue construct
 */
export interface EmailNotificationQueueProps {
  /** Stage configuration for queue naming */
  stageConfig: StageConfiguration;
  /** Custom queue name (will be made stage-aware) */
  queueName?: string;
  /** Removal policy for the queues */
  removalPolicy?: RemovalPolicy;
  /** Visibility timeout for messages (defaults to 60 seconds) */
  visibilityTimeout?: Duration;
  /** Message retention period (defaults to 14 days) */
  messageRetentionPeriod?: Duration;
  /** Maximum receive count before sending to DLQ (defaults to 3) */
  maxReceiveCount?: number;
}

/**
 * EmailNotificationQueue construct encapsulates SQS queue configuration
 * for the email notification system including dead letter queue setup.
 *
 * This construct provides stage-aware queue naming to enable multiple
 * deployments within the same AWS account.
 */
export class EmailNotificationQueue extends Construct {
  public readonly queue: Queue;
  public readonly deadLetterQueue: Queue;

  constructor(scope: Construct, id: string, props: EmailNotificationQueueProps) {
    super(scope, id);

    const {
      stageConfig,
      queueName = 'email-notifications',
      removalPolicy = RemovalPolicy.DESTROY,
      visibilityTimeout = Duration.seconds(60),
      messageRetentionPeriod = Duration.days(14),
      maxReceiveCount = 3,
    } = props;

    // Generate stage-aware queue names
    const mainQueueName = stageConfig.getResourceName(queueName);
    const dlqName = stageConfig.getResourceName(`${queueName}-dlq`);

    // Create the dead letter queue first
    this.deadLetterQueue = new Queue(this, 'DeadLetterQueue', {
      queueName: dlqName,
      encryption: QueueEncryption.SQS_MANAGED,
      retentionPeriod: messageRetentionPeriod,
      removalPolicy,
    });

    // Create the main email notification queue
    this.queue = new Queue(this, 'Queue', {
      queueName: mainQueueName,
      encryption: QueueEncryption.SQS_MANAGED,
      visibilityTimeout,
      retentionPeriod: messageRetentionPeriod,
      removalPolicy,
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount,
      },
    });
  }

  /**
   * Grant send message permissions to a Lambda function
   * @param lambda The Lambda function to grant send permissions to
   */
  grantSendMessages(lambda: IFunction): void {
    this.queue.grantSendMessages(lambda);
  }

  /**
   * Grant consume message permissions to a Lambda function
   * @param lambda The Lambda function to grant consume permissions to
   */
  grantConsumeMessages(lambda: IFunction): void {
    this.queue.grantConsumeMessages(lambda);
  }

  /**
   * Grant full access (send and consume) to the queue for a Lambda function
   * @param lambda The Lambda function to grant full access to
   */
  grantFullAccess(lambda: IFunction): void {
    this.grantSendMessages(lambda);
    this.grantConsumeMessages(lambda);
  }

  /**
   * Get the queue URL for environment variable configuration
   * @returns The queue URL
   */
  getQueueUrl(): string {
    return this.queue.queueUrl;
  }

  /**
   * Get the queue ARN for IAM policy configuration
   * @returns The queue ARN
   */
  getQueueArn(): string {
    return this.queue.queueArn;
  }

  /**
   * Get the dead letter queue URL for monitoring and debugging
   * @returns The dead letter queue URL
   */
  getDeadLetterQueueUrl(): string {
    return this.deadLetterQueue.queueUrl;
  }

  /**
   * Get the dead letter queue ARN for IAM policy configuration
   * @returns The dead letter queue ARN
   */
  getDeadLetterQueueArn(): string {
    return this.deadLetterQueue.queueArn;
  }
}