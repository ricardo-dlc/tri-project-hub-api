import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  formatErrorResponse,
  formatSuccessResponse,
  generateCorsHeaders,
  isHandlerResponse,
} from './response-formatter';
import {
  MiddlewareHandler,
  MiddlewareOptions,
} from './types';
import { handleError, sanitizeError } from './error-handler';

// Main middleware function signature using ES6+ arrow function and async/await
export const withMiddleware =
  <T = any>(
    handler: MiddlewareHandler<T>,
    options: MiddlewareOptions = { formatResponse: true }
  ): APIGatewayProxyHandlerV2 =>
    async (event, context) => {
      const startTime = Date.now();

      try {
        // Execute the wrapped handler
        const result = await handler(event, context);

        // Check if result includes status code and headers
        const statusCode = isHandlerResponse(result)
          ? result.statusCode ?? 200
          : 200;
        const data = isHandlerResponse(result) ? result.data : result;
        const formatResponse = options.formatResponse;
        console.log('formatResponse', formatResponse);
        const customHeaders = isHandlerResponse(result) ? result.headers || {} : {};

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
        const response = formatResponse ? formatSuccessResponse(data) : data;
        console.log('body content', response);

        return {
          statusCode,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
            ...customHeaders, // Custom headers from handler (e.g., set-cookie)
          },
          body: JSON.stringify(response),
        };
      } catch (error) {
        const executionTime = Date.now() - startTime;

        // Extract request context using destructuring and optional chaining
        const requestContext = {
          requestId: context.awsRequestId,
          path: event.routeKey ?? event.rawPath,
          method: event.requestContext?.http?.method,
          executionTime
        };

        // Handle errors using the enhanced error handler
        const errorResult = handleError(error, options, requestContext);

        // Sanitize error for production if needed
        const sanitizedError = sanitizeError(
          errorResult.error!,
          process.env.NODE_ENV === 'production'
        );

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
        const response = formatErrorResponse(sanitizedError);

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
