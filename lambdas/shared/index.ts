// Main middleware wrapper function
export { withMiddleware } from './wrapper';

// Logging utilities
export { createFeatureLogger, createRequestLogger, logger } from './logger';

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
  SuccessResponse
} from './types';

// Error classes
export {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  HttpError,
  NotAuthorizedError,
  NotFoundError,
  ValidationError
} from './errors';

// Response formatting utilities
export {
  formatErrorResponse,
  formatSuccessResponse,
  generateCorsHeaders,
  isHandlerResponse
} from './response-formatter';

// Error handling utilities
export {
  aggregateErrors, classifyError,
  getErrorStatusCode, handleError, logError, sanitizeError, shouldRetryError
} from './error-handler';

// Authentication utilities
export {
  authenticateUser,
  extractTokenFromEvent, requireRole, verifyClerkToken
} from './auth/clerk';

export type { ClerkUser } from './auth/clerk';
export type { AuthenticatedEvent, AuthenticatedHandler } from './auth/middleware';

export { withAuth } from './auth/middleware';
