import { APIGatewayProxyEventV2, Context } from 'aws-lambda';

// Handler response with optional status code
export interface HandlerResponse<T = any> {
  data: T;
  statusCode?: number;
}

// Handler type that returns plain objects or response objects
export type MiddlewareHandler<T = any> = (
  event: APIGatewayProxyEventV2,
  context: Context
) => Promise<T | HandlerResponse<T>> | T | HandlerResponse<T>;

// Configuration options for middleware
export interface MiddlewareOptions {
  cors?: CorsOptions;
  errorLogging?: boolean;
  customErrorMap?: Record<string, number>;
}

// CORS configuration interface
export interface CorsOptions {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}

// Standardized success response structure
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

// Standardized error response structure
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
  };
  data?: null;
}

// Combined response type
export type StandardResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// Request processing context
export interface RequestContext {
  event: APIGatewayProxyEventV2;
  context: Context;
  startTime: number;
}

// Processing result for internal middleware operations
export interface ProcessingResult<T> {
  data?: T;
  error?: Error;
  statusCode: number;
  headers: Record<string, string>;
  metadata?: {
    errorType?: string;
    classification?: string;
    requestId?: string;
    path?: string;
    method?: string;
    executionTime?: number;
  };
}

// Error mapping configuration
export interface ErrorMapping {
  errorClass: string;
  statusCode: number;
  defaultMessage?: string;
}
