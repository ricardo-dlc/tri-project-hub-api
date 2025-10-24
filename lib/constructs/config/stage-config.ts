import { StageConfig, StageConfigProps } from '../../types/infrastructure';

/**
 * StageConfiguration class manages stage-specific configurations and resource naming
 * to enable multiple deployments within the same AWS account.
 */
export class StageConfiguration {
  public readonly config: StageConfig;

  // Valid stage names for validation
  private static readonly VALID_STAGE_NAMES = [
    'dev',
    'test',
    'staging',
    'prod',
    'production',
  ];

  // Reserved resource names that should not be used
  private static readonly RESERVED_NAMES = [
    'aws',
    'amazon',
    'cdk',
    'cloudformation',
    'lambda',
    'api',
    'dynamodb',
  ];

  // Maximum length for resource names (AWS limits)
  private static readonly MAX_RESOURCE_NAME_LENGTH = 64;

  constructor(props?: StageConfigProps) {
    const stage = props?.stage || 'dev';
    const projectName = props?.projectName || 'tri-project-hub';

    // Validate stage name
    this.validateStageName(stage);

    // Validate project name
    this.validateProjectName(projectName);

    // Determine if this is a production environment
    const isProduction = stage === 'prod' || stage === 'production';

    // Create resource prefix for consistent naming
    const resourcePrefix = `${projectName}-${stage}`;

    // Load CORS origins from environment variable
    const corsOriginsEnv = process.env.CORS_ALLOWED_ORIGINS;
    const corsOrigins = corsOriginsEnv
      ? corsOriginsEnv.split(',').map((origin) => origin.trim())
      : ['*']; // Default to allow all if not specified

    // Initialize config first
    this.config = {
      stageName: stage,
      isProduction,
      resourcePrefix,
      tableName: '', // Will be set below
      apiName: '', // Will be set below
      corsOrigins,
    };

    // Now set the table and API names using the initialized config
    this.config.tableName = this.getTableName('events');
    this.config.apiName = this.getApiName('api');
  }

  /**
   * Validate stage name against allowed values and naming conventions
   * @param stage The stage name to validate
   * @throws Error if stage name is invalid
   */
  private validateStageName(stage: string): void {
    if (!stage || typeof stage !== 'string') {
      throw new Error('Stage name must be a non-empty string');
    }

    // Check if stage name contains only valid characters (alphanumeric and hyphens)
    if (!/^[a-z0-9-]+$/.test(stage)) {
      throw new Error(
        'Stage name must contain only lowercase letters, numbers, and hyphens'
      );
    }

    // Check stage name length
    if (stage.length < 2 || stage.length > 20) {
      throw new Error('Stage name must be between 2 and 20 characters long');
    }

    // Check if stage name starts or ends with hyphen
    if (stage.startsWith('-') || stage.endsWith('-')) {
      throw new Error('Stage name cannot start or end with a hyphen');
    }

    // Warn if using non-standard stage name (but don't throw error for flexibility)
    if (!StageConfiguration.VALID_STAGE_NAMES.includes(stage)) {
      console.warn(
        `Warning: '${stage}' is not a standard stage name. Consider using: ${StageConfiguration.VALID_STAGE_NAMES.join(
          ', '
        )}`
      );
    }
  }

  /**
   * Validate project name against naming conventions
   * @param projectName The project name to validate
   * @throws Error if project name is invalid
   */
  private validateProjectName(projectName: string): void {
    if (!projectName || typeof projectName !== 'string') {
      throw new Error('Project name must be a non-empty string');
    }

    // Check if project name contains only valid characters
    if (!/^[a-z0-9-]+$/.test(projectName)) {
      throw new Error(
        'Project name must contain only lowercase letters, numbers, and hyphens'
      );
    }

    // Check project name length
    if (projectName.length < 2 || projectName.length > 30) {
      throw new Error('Project name must be between 2 and 30 characters long');
    }

    // Check if project name starts or ends with hyphen
    if (projectName.startsWith('-') || projectName.endsWith('-')) {
      throw new Error('Project name cannot start or end with a hyphen');
    }

    // Check for reserved names
    if (StageConfiguration.RESERVED_NAMES.includes(projectName.toLowerCase())) {
      throw new Error(
        `Project name '${projectName}' is reserved and cannot be used`
      );
    }
  }

  /**
   * Validate resource name to prevent conflicts and ensure AWS compliance
   * @param resourceName The resource name to validate
   * @throws Error if resource name is invalid
   */
  private validateResourceName(resourceName: string): void {
    if (!resourceName || typeof resourceName !== 'string') {
      throw new Error('Resource name must be a non-empty string');
    }

    // Check resource name length
    if (resourceName.length > StageConfiguration.MAX_RESOURCE_NAME_LENGTH) {
      throw new Error(
        `Resource name '${resourceName}' exceeds maximum length of ${StageConfiguration.MAX_RESOURCE_NAME_LENGTH} characters`
      );
    }

    // Check if resource name contains only valid characters for AWS resources
    if (!/^[a-zA-Z0-9-_]+$/.test(resourceName)) {
      throw new Error(
        'Resource name must contain only letters, numbers, hyphens, and underscores'
      );
    }

    // Check if resource name starts with a letter
    if (!/^[a-zA-Z]/.test(resourceName)) {
      throw new Error('Resource name must start with a letter');
    }

    // Check for reserved names in the resource name
    const lowerResourceName = resourceName.toLowerCase();
    for (const reserved of StageConfiguration.RESERVED_NAMES) {
      if (lowerResourceName.includes(reserved)) {
        console.warn(
          `Warning: Resource name '${resourceName}' contains reserved word '${reserved}'`
        );
      }
    }
  }

  /**
   * Generate a stage-aware resource name with consistent naming convention
   * @param baseName The base name for the resource
   * @returns Stage-aware resource name
   * @throws Error if the resulting resource name is invalid
   */
  getResourceName(baseName: string): string {
    if (!baseName || typeof baseName !== 'string') {
      throw new Error('Base name must be a non-empty string');
    }

    // Normalize base name to lowercase and replace invalid characters
    const normalizedBaseName = baseName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');

    // Remove consecutive hyphens and trim hyphens from ends
    const cleanBaseName = normalizedBaseName
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!cleanBaseName) {
      throw new Error(
        `Base name '${baseName}' results in empty resource name after normalization`
      );
    }

    const resourceName = `${this.config.resourcePrefix}-${cleanBaseName}`;

    // Validate the final resource name
    this.validateResourceName(resourceName);

    return resourceName;
  }

  /**
   * Generate a stage-aware table name with DynamoDB-specific validation
   * @param baseName The base table name
   * @returns Stage-aware table name
   * @throws Error if the resulting table name is invalid
   */
  getTableName(baseName: string): string {
    const tableName = this.getResourceName(baseName);

    // Additional DynamoDB-specific validation
    if (tableName.length > 255) {
      throw new Error(
        `Table name '${tableName}' exceeds DynamoDB maximum length of 255 characters`
      );
    }

    // DynamoDB table names must match this pattern
    if (!/^[a-zA-Z0-9_.-]+$/.test(tableName)) {
      throw new Error(
        `Table name '${tableName}' contains invalid characters for DynamoDB`
      );
    }

    return tableName;
  }

  /**
   * Generate a stage-aware Lambda function name with Lambda-specific validation
   * @param functionName The base function name
   * @returns Stage-aware Lambda function name
   * @throws Error if the resulting function name is invalid
   */
  getLambdaName(functionName: string): string {
    const lambdaName = this.getResourceName(functionName);

    // Additional Lambda-specific validation
    if (lambdaName.length > 64) {
      throw new Error(
        `Lambda function name '${lambdaName}' exceeds maximum length of 64 characters`
      );
    }

    // Lambda function names have specific character requirements
    if (!/^[a-zA-Z0-9-_]+$/.test(lambdaName)) {
      throw new Error(
        `Lambda function name '${lambdaName}' contains invalid characters`
      );
    }

    return lambdaName;
  }

  /**
   * Generate a stage-aware API name with API Gateway-specific validation
   * @param baseName The base API name
   * @returns Stage-aware API name
   * @throws Error if the resulting API name is invalid
   */
  getApiName(baseName: string): string {
    const apiName = this.getResourceName(baseName);

    // Additional API Gateway-specific validation
    if (apiName.length > 128) {
      throw new Error(
        `API name '${apiName}' exceeds API Gateway maximum length of 128 characters`
      );
    }

    return apiName;
  }

  /**
   * Check if a resource name would conflict with existing naming patterns
   * @param baseName The base name to check
   * @param resourceType The type of resource (for context in error messages)
   * @returns True if the name is safe to use, throws error if conflicts detected
   */
  validateResourceNameConflict(
    baseName: string,
    resourceType: string = 'resource'
  ): boolean {
    try {
      // Try to generate the resource name to see if it would be valid
      const resourceName = this.getResourceName(baseName);

      // Check for potential conflicts with AWS service names
      const awsServicePrefixes = ['aws-', 'amazon-', 'cloudformation-', 'cdk-'];
      for (const prefix of awsServicePrefixes) {
        if (resourceName.toLowerCase().startsWith(prefix)) {
          throw new Error(
            `${resourceType} name '${resourceName}' conflicts with AWS service naming pattern '${prefix}'`
          );
        }
      }

      // Check for conflicts with common CDK construct names
      const cdkPatterns = ['-construct', '-stack', '-app'];
      for (const pattern of cdkPatterns) {
        if (resourceName.toLowerCase().includes(pattern)) {
          console.warn(
            `Warning: ${resourceType} name '${resourceName}' contains CDK pattern '${pattern}' which may cause confusion`
          );
        }
      }

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Resource name conflict detected for ${resourceType}: ${errorMessage}`
      );
    }
  }

  /**
   * Get all generated resource names for this stage configuration
   * Useful for debugging and validation
   * @returns Object containing all generated resource names
   */
  getAllResourceNames(): Record<string, string> {
    return {
      stage: this.config.stageName,
      resourcePrefix: this.config.resourcePrefix,
      tableName: this.config.tableName,
      apiName: this.config.apiName,
      // Generate some common resource names for reference
      sampleLambda: this.getLambdaName('sample-function'),
      sampleTable: this.getTableName('sample-table'),
      sampleApi: this.getApiName('sample-api'),
    };
  }
}
