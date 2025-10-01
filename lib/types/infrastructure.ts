import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { StageConfiguration } from '../constructs/config/stage-config';

/**
 * Configuration for Lambda function creation
 */
export interface LambdaConfig {
  /** Name of the Lambda function */
  functionName: string;
  /** Entry point file path for the Lambda function */
  entry: string;
  /** Environment variables for the Lambda function */
  environment?: Record<string, string>;
  /** Timeout duration for the Lambda function */
  timeout?: Duration;
  /** Memory size in MB for the Lambda function */
  memorySize?: number;
  /** Handler function name (defaults to 'handler') */
  handler?: string;
}

/**
 * Configuration for API route definition
 */
export interface ApiRoute {
  /** API path (e.g., '/events', '/events/{slug}') */
  path: string;
  /** HTTP method for the route */
  method: HttpMethod;
  /** Lambda function to integrate with this route */
  lambda: IFunction;
  /** Optional custom name for the integration */
  integrationName?: string;
}

/**
 * Overall stack configuration options
 */
export interface StackConfiguration {
  /** Deployment stage (e.g., 'dev', 'prod') */
  stage?: string;
  /** Project name for resource naming */
  projectName?: string;
  /** Custom table name override */
  tableName?: string;
  /** Custom API name override */
  apiName?: string;
  /** Environment identifier */
  environment?: string;
}

/**
 * Stage-specific configuration settings
 */
export interface StageConfig {
  /** Name of the deployment stage */
  stageName: string;
  /** Whether this is a production environment */
  isProduction: boolean;
  /** Prefix to use for resource naming */
  resourcePrefix: string;
  /** Stage-aware table name */
  tableName: string;
  /** Stage-aware API name */
  apiName: string;
}

/**
 * Properties for StageConfiguration construct
 */
export interface StageConfigProps {
  /** Stage name (defaults to 'dev' if not provided) */
  stage?: string;
  /** Project name for resource naming (defaults to 'tri-project-hub') */
  projectName?: string;
}

/**
 * Interface for LambdaFactory class
 */
export interface LambdaFactory {
  /** Create a standard Lambda function with the given configuration */
  createFunction(config: LambdaConfig): NodejsFunction;
  /** Create an API-optimized Lambda function with the given configuration */
  createApiFunction(config: LambdaConfig): NodejsFunction;
}

/**
 * Properties for LambdaFactory construct
 */
export interface LambdaFactoryProps {
  /** Stage configuration for naming and environment setup */
  stageConfig: StageConfiguration;
  /** Default environment variables for all Lambda functions */
  defaultEnvironment?: Record<string, string>;
  /** Default timeout for Lambda functions */
  defaultTimeout?: Duration;
  /** Default memory size for Lambda functions */
  defaultMemorySize?: number;
}

/**
 * Properties for EventsTable construct
 */
export interface EventsTableProps {
  /** Stage configuration for table naming */
  stageConfig: StageConfig;
  /** Custom table name (will be made stage-aware) */
  tableName?: string;
  /** Removal policy for the table */
  removalPolicy?: RemovalPolicy;
}

/**
 * Properties for HttpApiConstruct
 */
export interface HttpApiProps {
  /** Stage configuration for API naming */
  stageConfig: StageConfig;
  /** Custom API name (will be made stage-aware) */
  apiName?: string;
  /** Initial routes to add to the API */
  routes?: ApiRoute[];
}

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

export type TablePermission = 'read' | 'write' | 'readWrite';

export interface TableAccess {
  tableName: string;
  permission?: TablePermission;
  environmentVariable: string;
}

export interface LambdaCreationConfig {
  functionName: string;
  handlerPath: string;
  route: {
    path: string;
    method: HttpMethod;
    integrationName: string;
  };
  environment?: Record<string, string>;
  tables?: TableAccess[];
}

