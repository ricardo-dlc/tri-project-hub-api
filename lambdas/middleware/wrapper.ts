import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { HttpError } from './errors';
import {
  formatErrorResponse,
  formatSuccessResponse,
  generateCorsHeaders,
  isHandlerResponse,
} from './response-formatter';
import {
  MiddlewareHandler,
  MiddlewareOptions,
  ProcessingResult,
} from './types';

// Error handling using ES6+ features: arrow functions, optional chaining, destructuring
const handleError = (
  error: Error,
  options: MiddlewareOptions
): ProcessingResult<never> => {
  // Check if it's a known HttpError using instanceof
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      error,
      headers: {},
    };
  }

  // Check custom error mappings using optional chaining and nullish coalescing
  const customMapping = options.customErrorMap?.[error.constructor.name];
  if (customMapping) {
    return {
      statusCode: customMapping,
      error,
      headers: {},
    };
  }

  // Default to 500 for unknown errors using object shorthand
  return {
    statusCode: 500,
    error: new Error('Internal server error'),
    headers: {},
  };
};

// Main middleware function signature using ES6+ arrow function and async/await
export const withMiddleware =
  <T = any>(
    handler: MiddlewareHandler<T>,
    options: MiddlewareOptions = {}
  ): APIGatewayProxyHandlerV2 =>
  async (event, context) => {
    const startTime = Date.now();

    try {
      // Execute the wrapped handler
      const result = await handler(event, context);

      // Check if result includes status code
      const statusCode = isHandlerResponse(result) ? (result.statusCode ?? 200) : 200;
      const data = isHandlerResponse(result) ? result.data : result;

      // Generate CORS headers if configured
      const corsHeaders = options.cors
        ? generateCorsHeaders(
            options.cors.origin,
            options.cors.methods,
            options.cors.headers,
            options.cors.credentials
          )
        : {};

      // Format success response
      const response = formatSuccessResponse(data);

      return {
        statusCode,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
        body: JSON.stringify(response),
      };
    } catch (error) {
      // Handle errors using the error handler
      const errorResult = handleError(error as Error, options);

      // Log error if enabled
      if (options.errorLogging !== false) {
        console.error('Lambda middleware error:', {
          error: errorResult.error?.message,
          statusCode: errorResult.statusCode,
          executionTime: Date.now() - startTime,
        });
      }

      // Generate CORS headers for error responses too
      const corsHeaders = options.cors
        ? generateCorsHeaders(
            options.cors.origin,
            options.cors.methods,
            options.cors.headers,
            options.cors.credentials
          )
        : {};

      // Format error response
      const response = formatErrorResponse(
        errorResult.error!,
        errorResult.statusCode
      );

      return {
        statusCode: errorResult.statusCode,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
          ...errorResult.headers,
        },
        body: JSON.stringify(response),
      };
    }
  };
