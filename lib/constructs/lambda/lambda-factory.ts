import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { ILayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import {
  NodejsFunction,
  NodejsFunctionProps,
  OutputFormat,
} from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { LambdaConfig, LambdaFactoryProps } from '../../types/infrastructure';
import { StageConfiguration } from '../config/stage-config';

/**
 * LambdaFactory provides a standardized way to create Lambda functions with consistent
 * configurations, eliminating code duplication and ensuring stage-aware naming.
 */
export class LambdaFactory {
  private readonly scope: Construct;
  private readonly stageConfig: StageConfiguration;
  private readonly defaultEnvironment: Record<string, string>;
  private readonly defaultTimeout: Duration;
  private readonly defaultMemorySize: number;
  private readonly sharedLayer: ILayerVersion;

  // Default configurations for Lambda functions
  private static readonly DEFAULT_TIMEOUT = Duration.seconds(30);
  private static readonly DEFAULT_MEMORY_SIZE = 256;
  private static readonly DEFAULT_HANDLER = 'handler';
  private static readonly DEFAULT_RUNTIME = Runtime.NODEJS_22_X;

  // Validation constants
  private static readonly MIN_MEMORY_SIZE = 128;
  private static readonly MAX_MEMORY_SIZE = 10240;
  private static readonly MIN_TIMEOUT_SECONDS = 1;
  private static readonly MAX_TIMEOUT_SECONDS = 900; // 15 minutes

  constructor(scope: Construct, props: LambdaFactoryProps) {
    // Validate required parameters
    if (!scope) {
      throw new Error('Scope is required for LambdaFactory');
    }

    if (!props) {
      throw new Error('LambdaFactoryProps is required');
    }

    if (!props.stageConfig) {
      throw new Error('StageConfiguration is required in LambdaFactoryProps');
    }

    this.scope = scope;
    this.stageConfig = props.stageConfig;
    this.sharedLayer = props.sharedLayer;

    // Set defaults with validation
    this.defaultEnvironment = this.validateEnvironmentVariables(
      props.defaultEnvironment || {}
    );
    this.defaultTimeout = this.validateTimeout(
      props.defaultTimeout || LambdaFactory.DEFAULT_TIMEOUT
    );
    this.defaultMemorySize = this.validateMemorySize(
      props.defaultMemorySize || LambdaFactory.DEFAULT_MEMORY_SIZE
    );

    // Add stage-specific environment variables
    this.defaultEnvironment.STAGE = this.stageConfig.config.stageName;
    this.defaultEnvironment.IS_PRODUCTION =
      this.stageConfig.config.isProduction.toString();
  }

  /**
   * Create a standard Lambda function with the given configuration
   * @param config Lambda function configuration
   * @returns NodejsFunction instance
   */
  createFunction(config: LambdaConfig): NodejsFunction {
    this.validateLambdaConfig(config);

    const functionName = this.stageConfig.getLambdaName(config.functionName);
    const environment = this.mergeEnvironmentVariables(config.environment);

    const functionProps: NodejsFunctionProps = {
      functionName,
      entry: config.entry,
      handler: config.handler || LambdaFactory.DEFAULT_HANDLER,
      runtime: LambdaFactory.DEFAULT_RUNTIME,
      timeout: config.timeout || this.defaultTimeout,
      memorySize: config.memorySize || this.defaultMemorySize,
      environment,
      layers: [this.sharedLayer],
      bundling: {
        format: OutputFormat.ESM,
        target: 'node22',
        sourceMap: true,
        minify: this.stageConfig.config.isProduction,
        externalModules: ['@aws-sdk/*', '@clerk/*', 'electrodb', 'pino', 'ulid'],
      },
    };

    return new NodejsFunction(
      this.scope,
      `${config.functionName}Function`,
      functionProps
    );
  }

  /**
   * Create an API-optimized Lambda function with the given configuration
   * Includes API-specific defaults like shorter timeout and optimized memory
   * @param config Lambda function configuration
   * @returns NodejsFunction instance
   */
  createApiFunction(config: LambdaConfig): NodejsFunction {
    this.validateLambdaConfig(config);

    // API-specific defaults
    const apiTimeout = config.timeout || Duration.seconds(15); // Shorter timeout for API functions
    const apiMemorySize = config.memorySize || 512; // More memory for API functions

    const apiConfig: LambdaConfig = {
      ...config,
      timeout: apiTimeout,
      memorySize: apiMemorySize,
    };

    const lambda = this.createFunction(apiConfig);

    // Add API-specific environment variables
    lambda.addEnvironment('FUNCTION_TYPE', 'API');
    lambda.addEnvironment('API_TIMEOUT', apiTimeout.toSeconds().toString());

    // Apply removal policy to log group if it's a CfnResource
    try {
      lambda.logGroup.applyRemovalPolicy(this.stageConfig.config.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY);
    } catch (error) {
      // Log group might not be a CfnResource, skip applying removal policy
      console.warn(`Could not apply removal policy to log group for function ${config.functionName}: ${error}`);
    }

    return lambda;
  }

  /**
   * Validate Lambda configuration parameters
   * @param config Lambda configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateLambdaConfig(config: LambdaConfig): void {
    if (!config) {
      throw new Error('LambdaConfig is required');
    }

    if (!config.functionName || typeof config.functionName !== 'string') {
      throw new Error('Function name must be a non-empty string');
    }

    if (!config.entry || typeof config.entry !== 'string') {
      throw new Error('Entry point must be a non-empty string');
    }

    // Validate function name format
    if (!/^[a-zA-Z0-9-_]+$/.test(config.functionName)) {
      throw new Error(
        'Function name must contain only letters, numbers, hyphens, and underscores'
      );
    }

    // Validate entry point format (should be a file path)
    if (!config.entry.endsWith('.ts') && !config.entry.endsWith('.js')) {
      throw new Error(
        'Entry point must be a TypeScript (.ts) or JavaScript (.js) file'
      );
    }

    // Validate optional parameters if provided
    if (config.timeout !== undefined) {
      this.validateTimeout(config.timeout);
    }

    if (config.memorySize !== undefined) {
      this.validateMemorySize(config.memorySize);
    }

    if (config.handler !== undefined && typeof config.handler !== 'string') {
      throw new Error('Handler must be a string');
    }

    if (config.environment !== undefined) {
      this.validateEnvironmentVariables(config.environment);
    }
  }

  /**
   * Validate timeout duration
   * @param timeout Duration to validate
   * @returns Validated timeout duration
   * @throws Error if timeout is invalid
   */
  private validateTimeout(timeout: Duration): Duration {
    if (!timeout) {
      throw new Error('Timeout duration is required');
    }

    const timeoutSeconds = timeout.toSeconds();

    if (timeoutSeconds < LambdaFactory.MIN_TIMEOUT_SECONDS) {
      throw new Error(
        `Timeout must be at least ${LambdaFactory.MIN_TIMEOUT_SECONDS} second(s)`
      );
    }

    if (timeoutSeconds > LambdaFactory.MAX_TIMEOUT_SECONDS) {
      throw new Error(
        `Timeout cannot exceed ${LambdaFactory.MAX_TIMEOUT_SECONDS} seconds (15 minutes)`
      );
    }

    return timeout;
  }

  /**
   * Validate memory size
   * @param memorySize Memory size to validate
   * @returns Validated memory size
   * @throws Error if memory size is invalid
   */
  private validateMemorySize(memorySize: number): number {
    if (typeof memorySize !== 'number' || !Number.isInteger(memorySize)) {
      throw new Error('Memory size must be an integer');
    }

    if (memorySize < LambdaFactory.MIN_MEMORY_SIZE) {
      throw new Error(
        `Memory size must be at least ${LambdaFactory.MIN_MEMORY_SIZE} MB`
      );
    }

    if (memorySize > LambdaFactory.MAX_MEMORY_SIZE) {
      throw new Error(
        `Memory size cannot exceed ${LambdaFactory.MAX_MEMORY_SIZE} MB`
      );
    }

    // Memory size must be a multiple of 64 MB
    if (memorySize % 64 !== 0) {
      throw new Error('Memory size must be a multiple of 64 MB');
    }

    return memorySize;
  }

  /**
   * Validate environment variables
   * @param environment Environment variables to validate
   * @returns Validated environment variables
   * @throws Error if environment variables are invalid
   */
  private validateEnvironmentVariables(
    environment: Record<string, string>
  ): Record<string, string> {
    if (!environment || typeof environment !== 'object') {
      throw new Error('Environment variables must be an object');
    }

    const validated: Record<string, string> = {};

    for (const [key, value] of Object.entries(environment)) {
      // Validate environment variable key
      if (!key || typeof key !== 'string') {
        throw new Error('Environment variable keys must be non-empty strings');
      }

      if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
        throw new Error(
          `Environment variable key '${key}' must start with a letter or underscore and contain only uppercase letters, numbers, and underscores`
        );
      }

      // Validate environment variable value
      if (value === null || value === undefined) {
        throw new Error(
          `Environment variable '${key}' cannot be null or undefined`
        );
      }

      if (typeof value !== 'string') {
        throw new Error(`Environment variable '${key}' must be a string`);
      }

      // Check for reserved environment variable names
      const reservedNames = [
        'AWS_REGION',
        'AWS_DEFAULT_REGION',
        '_HANDLER',
        '_X_AMZN_TRACE_ID',
      ];
      if (reservedNames.includes(key)) {
        console.warn(
          `Warning: Environment variable '${key}' is reserved by AWS Lambda and may be overridden`
        );
      }

      validated[key] = value;
    }

    return validated;
  }

  /**
   * Merge function-specific environment variables with defaults
   * @param functionEnvironment Function-specific environment variables
   * @returns Merged environment variables
   */
  private mergeEnvironmentVariables(
    functionEnvironment?: Record<string, string>
  ): Record<string, string> {
    const merged = { ...this.defaultEnvironment };

    if (functionEnvironment) {
      const validated = this.validateEnvironmentVariables(functionEnvironment);

      // Check for conflicts and warn about overrides
      for (const [key, value] of Object.entries(validated)) {
        if (merged[key] && merged[key] !== value) {
          console.warn(
            `Warning: Function environment variable '${key}' overrides default value '${merged[key]}' with '${value}'`
          );
        }
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Get the current default configurations for debugging and validation
   * @returns Object containing current default configurations
   */
  getDefaultConfigurations(): {
    timeout: Duration;
    memorySize: number;
    environment: Record<string, string>;
    runtime: Runtime;
    handler: string;
  } {
    return {
      timeout: this.defaultTimeout,
      memorySize: this.defaultMemorySize,
      environment: { ...this.defaultEnvironment },
      runtime: LambdaFactory.DEFAULT_RUNTIME,
      handler: LambdaFactory.DEFAULT_HANDLER,
    };
  }

  /**
   * Get stage configuration for this factory
   * @returns Stage configuration
   */
  getStageConfig(): StageConfiguration {
    return this.stageConfig;
  }
}
