import type { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import type { ApiRoute } from '../../types/infrastructure';
import { analyticsApiLambdaConfigs } from './configs/analytics-api-config';
import { type DomainApiProps, GenericApi } from './generic-api';

/**
 * Properties for AnalyticsApi construct
 */
export interface AnalyticsApiProps extends DomainApiProps { }

/**
 * AnalyticsApi construct groups all analytics-related Lambda functions and their API routes.
 * This construct manages the Lambda functions for analytics operations and provides
 * route configurations for the HTTP API construct.
 */
export class AnalyticsApi extends Construct {
  public readonly functions: Record<string, NodejsFunction>;
  private readonly genericApi: GenericApi;

  constructor(scope: Construct, id: string, props: AnalyticsApiProps) {
    super(scope, id);

    // Create the generic API construct with analytics-specific configuration
    this.genericApi = new GenericApi(this, 'AnalyticsGenericApi', {
      ...props,
      domain: 'analytics',
      lambdaConfigs: analyticsApiLambdaConfigs,
    });

    // Expose the functions for backward compatibility
    this.functions = this.genericApi.functions;
  }

  /**
   * Get API route configurations for the analytics endpoints
   * @returns Array of ApiRoute configurations
   */
  getRoutes(): ApiRoute[] {
    return this.genericApi.getRoutes();
  }
}
