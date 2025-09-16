// Main middleware wrapper function
export { withMiddleware } from './wrapper';

// Type definitions
export type {
  CorsOptions,
  ErrorMapping,
  ErrorResponse,
  HandlerResponse,
  MiddlewareHandler,
  MiddlewareOptions,
  ProcessingResult,
  RequestContext,
  StandardResponse,
  SuccessResponse,
} from './types';

// Error classes
export {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  HttpError,
  NotAuthorizedError,
  NotFoundError,
  ValidationError,
} from './errors';

// Response formatting utilities
export {
  formatErrorResponse,
  formatSuccessResponse,
  generateCorsHeaders,
  isHandlerResponse,
} from './response-formatter';

// Error handling utilities
export {
  classifyError,
  getErrorStatusCode,
  logError,
  handleError,
  sanitizeError,
  aggregateErrors,
  shouldRetryError,
} from './error-handler';

// Auth and database utilities
export {
  db,
  client,
  checkDatabaseConnection,
  closeDatabaseConnection,
  config,
  authConfig,
  databaseConfig,
} from './auth';

export type {
  DatabaseConfig,
  AuthConfig,
  AppConfig,
} from './auth';
