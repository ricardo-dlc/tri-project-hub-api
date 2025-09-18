import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import { TriProjectHubApiStackEnvironment } from '../../tri-project-hub-api-stack';
import {
  ApiRoute,
  LambdaFactory,
  StageConfig,
} from '../../types/infrastructure';

/**
 * Properties for AuthApi construct
 */
export interface AuthApiProps {
  /** Lambda factory for creating functions */
  lambdaFactory: LambdaFactory;
  /** Stage configuration for naming and environment setup */
  stageConfig: StageConfig;
  environment?: TriProjectHubApiStackEnvironment;
}

/**
 * AuthApi construct groups all events-related Lambda functions and their API routes.
 * This construct manages the Lambda functions for events operations and provides
 * route configurations for the HTTP API construct.
 */
export class AuthApi extends Construct {
  public readonly functions: {
    signup: NodejsFunction;
  };

  constructor(scope: Construct, id: string, props: AuthApiProps) {
    super(scope, id);

    const { lambdaFactory, stageConfig, environment } = props;

    if (!lambdaFactory) {
      throw new Error('LambdaFactory is required for AuthApi construct');
    }

    if (!stageConfig) {
      throw new Error('StageConfiguration is required for AuthApi construct');
    }

    try {
      // Create Lambda functions using the factory with stage-aware configuration
      this.functions = {
        signup: this.createSignUpFunction(
          lambdaFactory,
          stageConfig,
          environment
        ),
      };

    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create AuthApi construct: ${errorMessage}`);
    }
  }

  /**
   * Create the signup Lambda function
   * @param eventsTable DynamoDB table for events data
   * @param lambdaFactory Lambda factory for creating functions
   * @param stageConfig Stage configuration for naming and environment setup
   * @returns Login Lambda function
   */
  private createSignUpFunction(
    lambdaFactory: LambdaFactory,
    stageConfig: StageConfig,
    environment?: TriProjectHubApiStackEnvironment
  ): NodejsFunction {
    // Validate entry point exists
    const entryPath = path.join(
      __dirname,
      '../../../lambdas/features/auth/handlers/signUp.ts'
    );

    try {
      // Create stage-aware environment variables
      const stageAwareEnvironment = {
        STAGE: stageConfig.stageName,
        IS_PRODUCTION: stageConfig.isProduction.toString(),
        DATABASE_URL: environment?.databaseUrl || '',
      };

      return lambdaFactory.createApiFunction({
        functionName: 'signUp',
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
   * Get API route configurations for the events endpoints
   * @returns Array of ApiRoute configurations
   */
  getRoutes(): ApiRoute[] {
    return [
      {
        path: '/auth/signup',
        method: HttpMethod.POST,
        lambda: this.functions.signup,
        integrationName: 'SignUpIntegration',
      },
    ];
  }
}
