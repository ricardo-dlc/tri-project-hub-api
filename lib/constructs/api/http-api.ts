import { Duration } from 'aws-cdk-lib';
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
  PayloadFormatVersion,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import {
  ApiRoute,
  HttpApiProps,
  StageConfig,
} from '../../types/infrastructure';

/**
 * HttpApiConstruct manages API Gateway HTTP API configuration and route definitions
 * with stage-aware naming and Lambda integrations.
 */
export class HttpApiConstruct extends Construct {
  public readonly api: HttpApi;
  private readonly stageConfig: StageConfig;
  private readonly routes: Map<string, ApiRoute> = new Map();

  constructor(scope: Construct, id: string, props: HttpApiProps) {
    super(scope, id);

    this.stageConfig = props.stageConfig;

    // Validate props
    this.validateProps(props);

    // Create the HTTP API with stage-aware naming
    const apiName = props.apiName || 'api';
    this.api = new HttpApi(this, 'HttpApi', {
      apiName: this.stageConfig.apiName || this.generateApiName(apiName),
      description: `HTTP API for ${this.stageConfig.stageName} stage`,
      // Enable CORS for browser-based applications
      corsPreflight: {
        allowOrigins: this.stageConfig.corsOrigins,
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        maxAge: Duration.seconds(this.stageConfig.isProduction ? 86400 : 300), // 24 hours for prod, 5 minutes for dev
      },
    });

    // Add initial routes if provided
    if (props.routes && props.routes.length > 0) {
      this.addRoutes(props.routes);
    }
  }

  /**
   * Validate the props passed to the construct
   * @param props The HttpApiProps to validate
   * @throws Error if props are invalid
   */
  private validateProps(props: HttpApiProps): void {
    if (!props.stageConfig) {
      throw new Error('StageConfig is required for HttpApiConstruct');
    }

    if (props.routes) {
      // Validate each route
      for (const route of props.routes) {
        this.validateRoute(route);
      }

      // Check for duplicate routes
      const routeKeys = props.routes.map((route) => this.getRouteKey(route));
      const duplicates = routeKeys.filter(
        (key, index) => routeKeys.indexOf(key) !== index
      );
      if (duplicates.length > 0) {
        throw new Error(`Duplicate routes detected: ${duplicates.join(', ')}`);
      }
    }
  }

  /**
   * Validate a single route configuration
   * @param route The ApiRoute to validate
   * @throws Error if route is invalid
   */
  private validateRoute(route: ApiRoute): void {
    if (!route.path || typeof route.path !== 'string') {
      throw new Error('Route path must be a non-empty string');
    }

    if (!route.path.startsWith('/')) {
      throw new Error(`Route path '${route.path}' must start with '/'`);
    }

    if (!route.method) {
      throw new Error(`Route method is required for path '${route.path}'`);
    }

    if (!route.lambda) {
      throw new Error(
        `Lambda function is required for route '${route.path} ${route.method}'`
      );
    }

    // Validate path parameters format
    const pathParamRegex = /\{[a-zA-Z][a-zA-Z0-9_]*\}/g;
    const pathParams = route.path.match(pathParamRegex);
    if (pathParams) {
      for (const param of pathParams) {
        // Check for valid parameter name (no special characters except underscore)
        const paramName = param.slice(1, -1); // Remove { and }
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(paramName)) {
          throw new Error(
            `Invalid path parameter '${param}' in route '${route.path}'. Parameter names must start with a letter and contain only letters, numbers, and underscores.`
          );
        }
      }
    }

    // Validate integration name if provided
    if (route.integrationName && typeof route.integrationName !== 'string') {
      throw new Error(
        `Integration name must be a string for route '${route.path} ${route.method}'`
      );
    }
  }

  /**
   * Generate a unique key for a route (used for duplicate detection)
   * @param route The ApiRoute to generate a key for
   * @returns Unique route key
   */
  private getRouteKey(route: ApiRoute): string {
    return `${route.method.toUpperCase()} ${route.path}`;
  }

  /**
   * Generate stage-aware API name
   * @param baseName The base API name
   * @returns Stage-aware API name
   */
  private generateApiName(baseName: string): string {
    return `${this.stageConfig.resourcePrefix}-${baseName}`;
  }

  /**
   * Generate integration name for a route
   * @param route The ApiRoute to generate integration name for
   * @returns Integration name
   */
  private generateIntegrationName(route: ApiRoute): string {
    if (route.integrationName) {
      return `${this.stageConfig.resourcePrefix}-${route.integrationName}`;
    }

    // Generate integration name from path and method
    const pathPart = route.path
      .replace(/[{}]/g, '') // Remove path parameter braces
      .replace(/[^a-zA-Z0-9]/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    const methodPart = route.method.toLowerCase();

    return `${this.stageConfig.resourcePrefix}-${methodPart}-${pathPart}-integration`;
  }

  /**
   * Add a single route to the API
   * @param route The ApiRoute configuration to add
   * @throws Error if route is invalid or already exists
   */
  addRoute(route: ApiRoute): void {
    // Validate the route
    this.validateRoute(route);

    const routeKey = this.getRouteKey(route);

    // Check for duplicate routes
    if (this.routes.has(routeKey)) {
      throw new Error(`Route '${routeKey}' already exists`);
    }

    // Create Lambda integration
    const integrationName = this.generateIntegrationName(route);
    const integration = new HttpLambdaIntegration(
      integrationName,
      route.lambda,
      {
        // Configure integration settings
        payloadFormatVersion: PayloadFormatVersion.VERSION_2_0, // Use the latest payload format
      }
    );

    // Add the route to the API
    this.api.addRoutes({
      path: route.path,
      methods: [route.method],
      integration,
    });

    // Store the route for tracking
    this.routes.set(routeKey, route);
  }

  /**
   * Add multiple routes to the API
   * @param routes Array of ApiRoute configurations to add
   * @throws Error if any route is invalid or conflicts with existing routes
   */
  addRoutes(routes: ApiRoute[]): void {
    if (!routes || routes.length === 0) {
      return;
    }

    // Validate all routes first before adding any
    for (const route of routes) {
      this.validateRoute(route);

      const routeKey = this.getRouteKey(route);
      if (this.routes.has(routeKey)) {
        throw new Error(`Route '${routeKey}' already exists`);
      }
    }

    // Check for duplicates within the new routes
    const routeKeys = routes.map((route) => this.getRouteKey(route));
    const duplicates = routeKeys.filter(
      (key, index) => routeKeys.indexOf(key) !== index
    );
    if (duplicates.length > 0) {
      throw new Error(`Duplicate routes in batch: ${duplicates.join(', ')}`);
    }

    // Add all routes
    for (const route of routes) {
      this.addRoute(route);
    }
  }

  /**
   * Get all currently configured routes
   * @returns Array of all configured routes
   */
  getRoutes(): ApiRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Get the number of configured routes
   * @returns Number of routes
   */
  getRouteCount(): number {
    return this.routes.size;
  }

  /**
   * Check if a specific route exists
   * @param path The route path
   * @param method The HTTP method
   * @returns True if the route exists
   */
  hasRoute(path: string, method: HttpMethod): boolean {
    const routeKey = `${method.toUpperCase()} ${path}`;
    return this.routes.has(routeKey);
  }

  /**
   * Get the API URL for this stage
   * @returns The API URL
   */
  getApiUrl(): string {
    return this.api.apiEndpoint;
  }

  /**
   * Get API information for debugging and monitoring
   * @returns Object containing API details
   */
  getApiInfo(): {
    apiId: string;
    apiName: string;
    apiEndpoint: string;
    stage: string;
    routeCount: number;
    routes: string[];
  } {
    return {
      apiId: this.api.apiId,
      apiName: this.stageConfig.apiName || 'unknown',
      apiEndpoint: this.api.apiEndpoint,
      stage: this.stageConfig.stageName,
      routeCount: this.routes.size,
      routes: Array.from(this.routes.keys()),
    };
  }
}
