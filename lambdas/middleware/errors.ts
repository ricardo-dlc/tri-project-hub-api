// Base error class using ES6 class syntax with modern features
export abstract class HttpError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = this.constructor.name;
  }

  // ES6+ method for error serialization using object spread
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    };
  }
}

// Specific error implementations using ES6 class syntax
export class NotFoundError extends HttpError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

export class NotAuthorizedError extends HttpError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';
}

export class ForbiddenError extends HttpError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';
}

export class BadRequestError extends HttpError {
  readonly statusCode = 400;
  readonly code = 'BAD_REQUEST';
}

export class ValidationError extends HttpError {
  readonly statusCode = 422;
  readonly code = 'VALIDATION_ERROR';
}

export class ConflictError extends HttpError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
}
