import { HttpError } from './errors';
import { ErrorMapping, MiddlewareOptions, ProcessingResult } from './types';

// Default error mappings configuration using ES6+ features
const DEFAULT_ERROR_MAPPINGS: ErrorMapping[] = [
  { errorClass: 'NotFoundError', statusCode: 404 },
  { errorClass: 'NotAuthorizedError', statusCode: 401 },
  { errorClass: 'ForbiddenError', statusCode: 403 },
  { errorClass: 'BadRequestError', statusCode: 400 },
  { errorClass: 'ValidationError', statusCode: 422 },
  { errorClass: 'ConflictError', statusCode: 409 },
  // Auth-specific error mappings
  { errorClass: 'AuthenticationError', statusCode: 401 },
  { errorClass: 'AuthorizationError', statusCode: 403 },
  { errorClass: 'InvalidTokenError', statusCode: 401 },
  { errorClass: 'TooManyRequestsError', statusCode: 429 },
  { errorClass: 'UserExistsError', statusCode: 409 },
  { errorClass: 'UserNotFoundError', statusCode: 404 },
  { errorClass: 'SessionExpiredError', statusCode: 401 },
];

// Error classification logic using arrow functions and instanceof checks
export const classifyError = (error: any): 'http' | 'custom' | 'unknown' => {
  // Check if it's a known HttpError using instanceof
  if (error instanceof HttpError) {
    return 'http';
  }

  // Check if it's a custom error with statusCode property
  // Handle non-object errors safely
  if (error && typeof error === 'object' && error !== null) {
    try {
      if ('statusCode' in error && typeof error.statusCode === 'number') {
        return 'custom';
      }
    } catch (e) {
      // If 'in' operator fails, it's not a valid object
      return 'unknown';
    }
  }

  return 'unknown';
};

// Error-to-status-code mapping system using optional chaining and nullish coalescing
export const getErrorStatusCode = (
  error: any,
  customErrorMap?: Record<string, number>
): number => {
  // First check if it's an HttpError with built-in status code
  if (error instanceof HttpError) {
    return error.statusCode;
  }

  // Check custom error mappings using optional chaining and nullish coalescing
  const customMapping = customErrorMap?.[error?.constructor?.name];
  if (customMapping) {
    return customMapping;
  }

  // Check default error mappings using array find and optional chaining
  const defaultMapping = DEFAULT_ERROR_MAPPINGS.find(
    (mapping) => mapping.errorClass === error.constructor.name
  );

  return defaultMapping?.statusCode ?? 500;
};

// Error logging functionality using template literals and destructuring
export const logError = (
  error: Error,
  context: {
    statusCode: number;
    executionTime: number;
    requestId?: string;
    path?: string;
    method?: string;
  }
): void => {
  // Destructure context for cleaner access using ES6+ destructuring
  const { statusCode, executionTime, requestId, path, method } = context;

  // Create error details object using ES6+ features like spread operator
  const errorDetails = {
    message: error.message,
    name: error.name,
    statusCode,
    executionTime,
    ...(requestId && { requestId }),
    ...(path && { path }),
    ...(method && { method }),
    ...(error.stack && { stack: error.stack }),
    // Include HttpError specific details using optional chaining
    ...(error instanceof HttpError && {
      code: error.code,
      ...(error.details && { details: error.details }),
    }),
  };

  // Log with appropriate level based on status code using template literals
  if (statusCode >= 500) {
    console.error(`🚨 Server Error (${statusCode}):`, errorDetails);
  } else if (statusCode >= 400) {
    console.warn(`⚠️ Client Error (${statusCode}):`, errorDetails);
  } else {
    console.info(`ℹ️ Error (${statusCode}):`, errorDetails);
  }
};

// Enhanced error handling function using ES6+ features
export const handleError = (
  error: any,
  options: MiddlewareOptions,
  context?: {
    requestId?: string;
    path?: string;
    method?: string;
    executionTime?: number;
  }
): ProcessingResult<never> => {
  // Get status code using the mapping system
  const statusCode = getErrorStatusCode(error, options.customErrorMap);

  // Classify the error for better handling
  const errorType = classifyError(error);

  // Create processing result using object shorthand and spread operator
  const result: ProcessingResult<never> = {
    statusCode,
    error,
    headers: {},
    // Add error metadata using spread operator
    ...(context && {
      metadata: {
        errorType,
        classification: errorType,
        ...context,
      },
    }),
  };

  // Log error if enabled using nullish coalescing for default value
  if (options.errorLogging !== false && context) {
    logError(error, {
      statusCode,
      executionTime: context.executionTime ?? 0,
      requestId: context.requestId,
      path: context.path,
      method: context.method,
    });
  }

  return result;
};

// Error sanitization for production environments using ES6+ features
export const sanitizeError = (error: any, isProduction = false): Error => {
  // Convert non-Error objects to Error instances
  if (!(error instanceof Error)) {
    const errorMessage =
      typeof error === 'string' ? error : 'Unknown error occurred';
    error = new Error(errorMessage);
  }

  // In production, sanitize sensitive error information
  if (isProduction && !(error instanceof HttpError)) {
    return new Error('Internal server error');
  }

  // Return original error for development or HttpError instances
  return error;
};

// Error aggregation for batch operations using ES6+ features
export const aggregateErrors = (errors: Error[]): Error => {
  if (errors.length === 0) {
    return new Error('No errors to aggregate');
  }

  if (errors.length === 1) {
    return errors[0];
  }

  // Create aggregated error message using template literals and array methods
  const errorMessages = errors
    .map((error, index) => `${index + 1}. ${error.message}`)
    .join('\n');

  const aggregatedError = new Error(
    `Multiple errors occurred:\n${errorMessages}`
  );

  // Add metadata using object spread
  (aggregatedError as any).errors = errors;
  (aggregatedError as any).count = errors.length;

  return aggregatedError;
};

// Error retry logic helper using ES6+ features
export const shouldRetryError = (
  error: Error,
  attempt: number,
  maxRetries = 3
): boolean => {
  // Don't retry client errors (4xx) or if max retries exceeded
  if (error instanceof HttpError && error.statusCode < 500) {
    return false;
  }

  return attempt < maxRetries;
};
