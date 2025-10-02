import type { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import type { ApiRoute } from '../../types/infrastructure';
import { registrationsApiLambdaConfigs } from './configs/registrations-api-config';
import { type DomainApiProps, GenericApi } from './generic-api';

/**
 * Properties for RegistrationsApi construct
 */
export interface RegistrationsApiProps extends DomainApiProps { }

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

    // Create the generic API construct with events-specific configuration
    this.genericApi = new GenericApi(this, 'RegistrationsGenericApi', {
      ...props,
      domain: 'registrations',
      lambdaConfigs: registrationsApiLambdaConfigs,
    });

    // Expose the functions for backward compatibility
    this.functions = this.genericApi.functions;
  }

  /**
   * Get API route configurations for the events endpoints
   * @returns Array of ApiRoute configurations
   */
  getRoutes(): ApiRoute[] {
    return this.genericApi.getRoutes();
  }
}
