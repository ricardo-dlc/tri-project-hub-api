import type { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import type { ApiRoute } from '../../types/infrastructure';
import type { EmailNotificationQueue } from '../queue/email-notification-queue';
import { registrationsApiLambdaConfigs } from './configs/registrations-api-config';
import { type DomainApiProps, GenericApi } from './generic-api';

/**
 * Properties for RegistrationsApi construct
 */
export interface RegistrationsApiProps extends DomainApiProps {
  /** Email notification queue for sending registration notifications (required) */
  emailQueue: EmailNotificationQueue;
}

/**
 * RegistrationsApi construct groups all registrations-related Lambda functions and their API routes.
 * This construct manages the Lambda functions for events operations and provides
 * route configurations for the HTTP API construct.
 */
export class RegistrationsApi extends Construct {
  public readonly functions: Record<string, NodejsFunction>;
  private readonly genericApi: GenericApi;

  constructor(scope: Construct, id: string, props: RegistrationsApiProps) {
    super(scope, id);

    const { emailQueue, ...genericApiProps } = props;

    // Create the generic API construct with registrations-specific configuration
    this.genericApi = new GenericApi(this, 'RegistrationsGenericApi', {
      ...genericApiProps,
      domain: 'registrations',
      lambdaConfigs: registrationsApiLambdaConfigs,
      emailQueue,
    });

    // Expose the functions for backward compatibility
    this.functions = this.genericApi.functions;

    // Grant SQS permissions to registration handlers (email queue is required)
    this.grantSqsPermissions(emailQueue);
  }

  /**
   * Grant SQS send message permissions to registration handlers
   * @param emailQueue Email notification queue
   */
  private grantSqsPermissions(emailQueue: EmailNotificationQueue): void {
    // Grant send message permissions to handlers that need to publish notifications
    const handlersNeedingSqs = [
      'createRegistration',
      'updatePaymentStatus'
    ];

    handlersNeedingSqs.forEach(handlerKey => {
      const handler = this.functions[handlerKey];
      if (handler) {
        emailQueue.grantSendMessages(handler);
      }
    });
  }

  /**
   * Get API route configurations for the events endpoints
   * @returns Array of ApiRoute configurations
   */
  getRoutes(): ApiRoute[] {
    return this.genericApi.getRoutes();
  }
}
