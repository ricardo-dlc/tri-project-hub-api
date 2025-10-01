import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import {
  ApiRoute,
  LambdaFactory,
  StageConfig,
} from '../../types/infrastructure';
import {
  eventsApiLambdaConfigs
} from './events-api-config';

/**
 * Properties for EventsApi construct
 */
export interface EventsApiProps {
  /** DynamoDB tables available for lambda functions */
  tables: Record<string, Table>;
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
  public readonly functions: Record<string, NodejsFunction>;
  private readonly lambdaConfigs = eventsApiLambdaConfigs;

  constructor(scope: Construct, id: string, props: EventsApiProps) {
    super(scope, id);

    const { tables, lambdaFactory, stageConfig } = props;

    // Validate required props with detailed error messages
    if (!tables || Object.keys(tables).length === 0) {
      throw new Error('At least one table is required for EventsApi construct');
    }

    if (!lambdaFactory) {
      throw new Error('LambdaFactory is required for EventsApi construct');
    }

    if (!stageConfig) {
      throw new Error('StageConfiguration is required for EventsApi construct');
    }

    try {
      // Create all Lambda functions using generic creation method
      this.functions = this.createLambdaFunctions(
        tables,
        lambdaFactory,
        stageConfig
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create EventsApi construct: ${errorMessage}`);
    }
  }

  /**
   * Create all Lambda functions using the configuration object
   * @param tables Available DynamoDB tables
   * @param lambdaFactory The Lambda factory instance
   * @param stageConfig The stage configuration for naming and environment setup
   * @returns Record of function names to NodejsFunction instances
   */
  private createLambdaFunctions(
    tables: Record<string, Table>,
    lambdaFactory: LambdaFactory,
    stageConfig: StageConfig
  ): Record<string, NodejsFunction> {
    const functions: Record<string, NodejsFunction> = {};

    // Create base stage-aware environment variables (shared by all functions)
    const baseEnvironment = {
      STAGE: stageConfig.stageName,
      IS_PRODUCTION: stageConfig.isProduction.toString(),
    };

    // Create each function based on configuration
    Object.entries(this.lambdaConfigs).forEach(([key, config]) => {
      try {
        const entryPath = path.join(
          __dirname,
          `../../../lambdas/features/events/handlers/${config.handlerPath}`
        );

        // Create table-specific environment variables based on permissions
        const tableEnvironment: Record<string, string> = {};
        config.tables?.forEach(tableAccess => {
          const table = tables[tableAccess.tableName];
          if (!table) {
            throw new Error(
              `Table '${tableAccess.tableName}' not found for function '${config.functionName}'`
            );
          }
          tableEnvironment[tableAccess.environmentVariable] = table.tableName;
        });

        // Merge all environment variables
        const functionEnvironment = {
          ...baseEnvironment,
          ...tableEnvironment,
          ...config.environment,
        };

        const lambdaFunction = lambdaFactory.createApiFunction({
          functionName: config.functionName,
          entry: entryPath,
          environment: functionEnvironment,
        });

        // Grant table permissions based on configuration
        config.tables?.forEach(tableAccess => {
          const table = tables[tableAccess.tableName];
          const permission = tableAccess.permission || 'read'; // Default to 'read' if not specified

          switch (permission) {
            case 'read':
              table.grantReadData(lambdaFunction);
              break;
            case 'write':
              table.grantWriteData(lambdaFunction);
              break;
            case 'readWrite':
              table.grantReadWriteData(lambdaFunction);
              break;
          }
        });

        functions[key] = lambdaFunction;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to create ${config.functionName} Lambda function: ${errorMessage}`
        );
      }
    });

    return functions;
  }

  /**
   * Get API route configurations for the events endpoints
   * @returns Array of ApiRoute configurations
   */
  getRoutes(): ApiRoute[] {
    return Object.entries(this.lambdaConfigs).map(([key, config]) => ({
      path: config.route.path,
      method: config.route.method,
      lambda: this.functions[key],
      integrationName: config.route.integrationName,
    }));
  }
}
