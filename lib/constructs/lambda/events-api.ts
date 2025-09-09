import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import { ApiRoute, StageConfig, LambdaFactory } from '../../types/infrastructure';

/**
 * Properties for EventsApi construct
 */
export interface EventsApiProps {
  /** DynamoDB table for events data */
  eventsTable: Table;
  /** Lambda factory for creating functions */
  lambdaFactory: LambdaFactory;
  /** Stage configuration for naming and environment setup */
  stageConfig: StageConfig;
}

/**
 * EventsApi construct groups all events-related Lambda functions and their API routes.
 * This construct manages the Lambda functions for events operations and provides
 * route configurations for the HTTP API construct.
 */
export class EventsApi extends Construct {
  public readonly functions: {
    getEvents: NodejsFunction;
    getEventBySlug: NodejsFunction;
  };

  constructor(scope: Construct, id: string, props: EventsApiProps) {
    super(scope, id);

    const { eventsTable, lambdaFactory, stageConfig } = props;

    // Validate required props with detailed error messages
    if (!eventsTable) {
      throw new Error('EventsTable is required for EventsApi construct');
    }

    if (!lambdaFactory) {
      throw new Error('LambdaFactory is required for EventsApi construct');
    }

    if (!stageConfig) {
      throw new Error('StageConfiguration is required for EventsApi construct');
    }

    try {
      // Create Lambda functions using the factory with stage-aware configuration
      this.functions = {
        getEvents: this.createGetEventsFunction(
          eventsTable,
          lambdaFactory,
          stageConfig
        ),
        getEventBySlug: this.createGetEventBySlugFunction(
          eventsTable,
          lambdaFactory,
          stageConfig
        ),
      };

      // Grant read permissions to the events table directly
      // Since we now receive the Table instance directly, we grant permissions here
      eventsTable.grantReadData(this.functions.getEvents);
      eventsTable.grantReadData(this.functions.getEventBySlug);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create EventsApi construct: ${errorMessage}`);
    }
  }

  /**
   * Create the getEvents Lambda function using the factory with stage-aware configuration
   * @param eventsTable The DynamoDB Table instance
   * @param lambdaFactory The Lambda factory instance
   * @param stageConfig The stage configuration for naming and environment setup
   * @returns NodejsFunction for getEvents
   */
  private createGetEventsFunction(
    eventsTable: Table,
    lambdaFactory: LambdaFactory,
    stageConfig: StageConfig
  ): NodejsFunction {
    // Validate entry point exists
    const entryPath = path.join(
      __dirname,
      '../../../lambdas/events/getEvents.ts'
    );

    try {
      // Create stage-aware environment variables
      const stageAwareEnvironment = {
        EVENTS_TABLE_NAME: eventsTable.tableName,
        STAGE: stageConfig.stageName,
        IS_PRODUCTION: stageConfig.isProduction.toString(),
      };

      return lambdaFactory.createApiFunction({
        functionName: 'getEvents',
        entry: entryPath,
        environment: stageAwareEnvironment,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create getEvents Lambda function: ${errorMessage}`
      );
    }
  }

  /**
   * Create the getEventBySlug Lambda function using the factory with stage-aware configuration
   * @param eventsTable The DynamoDB Table instance
   * @param lambdaFactory The Lambda factory instance
   * @param stageConfig The stage configuration for naming and environment setup
   * @returns NodejsFunction for getEventBySlug
   */
  private createGetEventBySlugFunction(
    eventsTable: Table,
    lambdaFactory: LambdaFactory,
    stageConfig: StageConfig
  ): NodejsFunction {
    // Validate entry point exists
    const entryPath = path.join(
      __dirname,
      '../../../lambdas/events/getEventBySlug.ts'
    );

    try {
      // Create stage-aware environment variables
      const stageAwareEnvironment = {
        EVENTS_TABLE_NAME: eventsTable.tableName,
        STAGE: stageConfig.stageName,
        IS_PRODUCTION: stageConfig.isProduction.toString(),
      };

      return lambdaFactory.createApiFunction({
        functionName: 'getEventBySlug',
        entry: entryPath,
        environment: stageAwareEnvironment,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create getEventBySlug Lambda function: ${errorMessage}`
      );
    }
  }

  /**
   * Get API route configurations for the events endpoints
   * @returns Array of ApiRoute configurations
   */
  getRoutes(): ApiRoute[] {
    return [
      {
        path: '/events',
        method: HttpMethod.GET,
        lambda: this.functions.getEvents,
        integrationName: 'EventsIntegration',
      },
      {
        path: '/events/slug/{slug}',
        method: HttpMethod.GET,
        lambda: this.functions.getEventBySlug,
        integrationName: 'EventsSlugIntegration',
      },
    ];
  }
}
