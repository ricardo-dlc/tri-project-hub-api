import {
  classifyError,
  getErrorStatusCode,
  logError,
  handleError,
  sanitizeError,
  aggregateErrors,
  shouldRetryError,
} from '../lambdas/middleware/error-handler';
import {
  HttpError,
  NotFoundError,
  NotAuthorizedError,
  BadRequestError,
  ValidationError,
} from '../lambdas/middleware/errors';
import { MiddlewareOptions } from '../lambdas/middleware/types';

// Mock console methods for testing logging
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation();

beforeEach(() => {
  mockConsoleError.mockClear();
  mockConsoleWarn.mockClear();
  mockConsoleInfo.mockClear();
});

afterAll(() => {
  mockConsoleError.mockRestore();
  mockConsoleWarn.mockRestore();
  mockConsoleInfo.mockRestore();
});

describe('Error Classification Logic', () => {
  describe('classifyError using arrow functions and instanceof checks', () => {
    it('should classify HttpError instances as "http"', () => {
      const notFoundError = new NotFoundError('Resource not found');
      const validationError = new ValidationError('Invalid data');
      
      expect(classifyError(notFoundError)).toBe('http');
      expect(classifyError(validationError)).toBe('http');
    });

    it('should classify custom errors with statusCode as "custom"', () => {
      class CustomError extends Error {
        statusCode = 418;
      }
      
      const customError = new CustomError('Custom error');
      expect(classifyError(customError)).toBe('custom');
    });

    it('should classify unknown errors as "unknown"', () => {
      const genericError = new Error('Generic error');
      const typeError = new TypeError('Type error');
      
      expect(classifyError(genericError)).toBe('unknown');
      expect(classifyError(typeError)).toBe('unknown');
    });

    it('should handle errors with non-numeric statusCode property', () => {
      class InvalidCustomError extends Error {
        statusCode = 'invalid';
      }
      
      const invalidError = new InvalidCustomError('Invalid error');
      expect(classifyError(invalidError)).toBe('unknown');
    });
  });
});

describe('Error-to-Status-Code Mapping System', () => {
  describe('getErrorStatusCode using optional chaining and nullish coalescing', () => {
    it('should return HttpError status codes directly', () => {
      const notFoundError = new NotFoundError('Not found');
      const unauthorizedError = new NotAuthorizedError('Unauthorized');
      const badRequestError = new BadRequestError('Bad request');
      
      expect(getErrorStatusCode(notFoundError)).toBe(404);
      expect(getErrorStatusCode(unauthorizedError)).toBe(401);
      expect(getErrorStatusCode(badRequestError)).toBe(400);
    });

    it('should use custom error mappings with optional chaining', () => {
      class CustomBusinessError extends Error {}
      class AnotherCustomError extends Error {}
      
      const customErrorMap = {
        CustomBusinessError: 422,
        AnotherCustomError: 409,
      };
      
      const businessError = new CustomBusinessError('Business logic error');
      const anotherError = new AnotherCustomError('Another error');
      
      expect(getErrorStatusCode(businessError, customErrorMap)).toBe(422);
      expect(getErrorStatusCode(anotherError, customErrorMap)).toBe(409);
    });

    it('should fall back to default mappings using nullish coalescing', () => {
      // Create errors with names that match default mappings
      class NotFoundError extends Error {}
      class ValidationError extends Error {}
      
      const notFoundError = new NotFoundError('Not found');
      const validationError = new ValidationError('Validation failed');
      
      expect(getErrorStatusCode(notFoundError)).toBe(404);
      expect(getErrorStatusCode(validationError)).toBe(422);
    });

    it('should default to 500 for unknown errors using nullish coalescing', () => {
      const unknownError = new Error('Unknown error');
      const typeError = new TypeError('Type error');
      
      expect(getErrorStatusCode(unknownError)).toBe(500);
      expect(getErrorStatusCode(typeError)).toBe(500);
    });

    it('should prioritize custom mappings over default mappings', () => {
      class NotFoundError extends Error {}
      
      const customErrorMap = {
        NotFoundError: 418, // Override default 404
      };
      
      const notFoundError = new NotFoundError('Custom not found');
      expect(getErrorStatusCode(notFoundError, customErrorMap)).toBe(418);
    });
  });
});

describe('Error Logging Functionality', () => {
  describe('logError using template literals and destructuring', () => {
    it('should log server errors (5xx) with error level', () => {
      const error = new Error('Server error');
      const context = {
        statusCode: 500,
        executionTime: 150,
        requestId: 'req-123',
        path: '/api/test',
        method: 'GET',
      };
      
      logError(error, context);
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        '🚨 Server Error (500):',
        expect.objectContaining({
          message: 'Server error',
          name: 'Error',
          statusCode: 500,
          executionTime: 150,
          requestId: 'req-123',
          path: '/api/test',
          method: 'GET',
        })
      );
    });

    it('should log client errors (4xx) with warn level', () => {
      const error = new BadRequestError('Invalid input');
      const context = {
        statusCode: 400,
        executionTime: 50,
        requestId: 'req-456',
      };
      
      logError(error, context);
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '⚠️ Client Error (400):',
        expect.objectContaining({
          message: 'Invalid input',
          name: 'BadRequestError',
          statusCode: 400,
          executionTime: 50,
          requestId: 'req-456',
          code: 'BAD_REQUEST',
        })
      );
    });

    it('should log other errors with info level', () => {
      const error = new Error('Info error');
      const context = {
        statusCode: 200,
        executionTime: 25,
      };
      
      logError(error, context);
      
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        'ℹ️ Error (200):',
        expect.objectContaining({
          message: 'Info error',
          statusCode: 200,
          executionTime: 25,
        })
      );
    });

    it('should include HttpError details using spread operator', () => {
      const details = { field: 'email', value: 'invalid' };
      const error = new ValidationError('Validation failed', details);
      const context = {
        statusCode: 422,
        executionTime: 75,
      };
      
      logError(error, context);
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '⚠️ Client Error (422):',
        expect.objectContaining({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
        })
      );
    });

    it('should handle optional context properties using destructuring', () => {
      const error = new Error('Test error');
      const context = {
        statusCode: 500,
        executionTime: 100,
        // Missing optional properties: requestId, path, method
      };
      
      logError(error, context);
      
      const loggedObject = mockConsoleError.mock.calls[0][1];
      expect(loggedObject).not.toHaveProperty('requestId');
      expect(loggedObject).not.toHaveProperty('path');
      expect(loggedObject).not.toHaveProperty('method');
      expect(loggedObject).toHaveProperty('statusCode', 500);
      expect(loggedObject).toHaveProperty('executionTime', 100);
    });

    it('should include stack trace when available', () => {
      const error = new Error('Error with stack');
      const context = {
        statusCode: 500,
        executionTime: 100,
      };
      
      logError(error, context);
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        '🚨 Server Error (500):',
        expect.objectContaining({
          stack: expect.stringContaining('Error with stack'),
        })
      );
    });
  });
});

describe('Enhanced Error Handling Function', () => {
  describe('handleError using ES6+ features', () => {
    const defaultOptions: MiddlewareOptions = {
      errorLogging: true,
    };

    it('should handle HttpError with proper status code mapping', () => {
      const error = new NotFoundError('Resource not found');
      const context = {
        requestId: 'req-123',
        executionTime: 50,
      };
      
      const result = handleError(error, defaultOptions, context);
      
      expect(result).toEqual({
        statusCode: 404,
        error,
        headers: {},
        metadata: {
          errorType: 'http',
          classification: 'http',
          requestId: 'req-123',
          executionTime: 50,
        },
      });
    });

    it('should handle custom errors with custom mapping', () => {
      class BusinessError extends Error {}
      
      const options: MiddlewareOptions = {
        errorLogging: true,
        customErrorMap: {
          BusinessError: 422,
        },
      };
      
      const error = new BusinessError('Business logic error');
      const context = {
        path: '/api/business',
        method: 'POST',
        executionTime: 100,
      };
      
      const result = handleError(error, options, context);
      
      expect(result.statusCode).toBe(422);
      expect(result.error).toBe(error);
      expect(result.metadata).toEqual({
        errorType: 'unknown',
        classification: 'unknown',
        path: '/api/business',
        method: 'POST',
        executionTime: 100,
      });
    });

    it('should handle unknown errors with default 500 status', () => {
      const error = new TypeError('Type error');
      const context = {
        requestId: 'req-456',
        executionTime: 25,
      };
      
      const result = handleError(error, defaultOptions, context);
      
      expect(result.statusCode).toBe(500);
      expect(result.error).toBe(error);
    });

    it('should skip logging when errorLogging is false', () => {
      const options: MiddlewareOptions = {
        errorLogging: false,
      };
      
      const error = new Error('Test error');
      const context = {
        executionTime: 50,
      };
      
      handleError(error, options, context);
      
      expect(mockConsoleError).not.toHaveBeenCalled();
      expect(mockConsoleWarn).not.toHaveBeenCalled();
      expect(mockConsoleInfo).not.toHaveBeenCalled();
    });

    it('should handle missing context gracefully', () => {
      const error = new NotFoundError('Not found');
      
      const result = handleError(error, defaultOptions);
      
      expect(result.statusCode).toBe(404);
      expect(result.error).toBe(error);
      expect(result).not.toHaveProperty('metadata');
    });
  });
});

describe('Error Sanitization', () => {
  describe('sanitizeError for production environments', () => {
    it('should return original HttpError in production', () => {
      const error = new NotFoundError('Resource not found');
      const sanitized = sanitizeError(error, true);
      
      expect(sanitized).toBe(error);
    });

    it('should sanitize generic errors in production', () => {
      const error = new Error('Sensitive database connection failed');
      const sanitized = sanitizeError(error, true);
      
      expect(sanitized).not.toBe(error);
      expect(sanitized.message).toBe('Internal server error');
    });

    it('should return original error in development', () => {
      const error = new Error('Detailed error message');
      const sanitized = sanitizeError(error, false);
      
      expect(sanitized).toBe(error);
    });
  });
});

describe('Error Aggregation', () => {
  describe('aggregateErrors for batch operations', () => {
    it('should handle empty error array', () => {
      const result = aggregateErrors([]);
      
      expect(result.message).toBe('No errors to aggregate');
    });

    it('should return single error unchanged', () => {
      const error = new NotFoundError('Single error');
      const result = aggregateErrors([error]);
      
      expect(result).toBe(error);
    });

    it('should aggregate multiple errors using template literals', () => {
      const error1 = new BadRequestError('Invalid email');
      const error2 = new ValidationError('Missing required field');
      const error3 = new Error('Generic error');
      
      const result = aggregateErrors([error1, error2, error3]);
      
      expect(result.message).toBe(
        'Multiple errors occurred:\n' +
        '1. Invalid email\n' +
        '2. Missing required field\n' +
        '3. Generic error'
      );
      
      expect((result as any).errors).toEqual([error1, error2, error3]);
      expect((result as any).count).toBe(3);
    });
  });
});

describe('Error Retry Logic', () => {
  describe('shouldRetryError helper', () => {
    it('should not retry client errors (4xx)', () => {
      const clientError = new BadRequestError('Bad request');
      
      expect(shouldRetryError(clientError, 1)).toBe(false);
      expect(shouldRetryError(clientError, 0)).toBe(false);
    });

    it('should retry server errors within max attempts', () => {
      const serverError = new Error('Server error');
      
      expect(shouldRetryError(serverError, 0, 3)).toBe(true);
      expect(shouldRetryError(serverError, 1, 3)).toBe(true);
      expect(shouldRetryError(serverError, 2, 3)).toBe(true);
    });

    it('should not retry after max attempts exceeded', () => {
      const serverError = new Error('Server error');
      
      expect(shouldRetryError(serverError, 3, 3)).toBe(false);
      expect(shouldRetryError(serverError, 4, 3)).toBe(false);
    });

    it('should use default max retries of 3', () => {
      const serverError = new Error('Server error');
      
      expect(shouldRetryError(serverError, 2)).toBe(true);
      expect(shouldRetryError(serverError, 3)).toBe(false);
    });
  });
});

describe('ES6+ Features Usage in Error Handler', () => {
  it('should use arrow functions for error classification', () => {
    // Verify that classifyError is an arrow function by checking its properties
    expect(classifyError.prototype).toBeUndefined();
  });

  it('should use optional chaining in status code mapping', () => {
    const customErrorMap = undefined;
    const error = new Error('Test');
    
    // This should not throw even with undefined customErrorMap
    expect(() => getErrorStatusCode(error, customErrorMap)).not.toThrow();
    expect(getErrorStatusCode(error, customErrorMap)).toBe(500);
  });

  it('should use nullish coalescing for default values', () => {
    const error = new Error('Test');
    const context = {
      statusCode: 500,
      executionTime: 0, // Falsy but not null/undefined
    };
    
    // Should preserve falsy but defined values
    logError(error, context);
    
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        executionTime: 0, // Should be 0, not replaced by default
      })
    );
  });

  it('should use destructuring in context handling', () => {
    const error = new Error('Test');
    const fullContext = {
      statusCode: 400,
      executionTime: 100,
      requestId: 'req-123',
      path: '/test',
      method: 'GET',
      extraProperty: 'should not appear',
    };
    
    logError(error, fullContext);
    
    const loggedObject = mockConsoleWarn.mock.calls[0][1];
    expect(loggedObject).toHaveProperty('requestId', 'req-123');
    expect(loggedObject).toHaveProperty('path', '/test');
    expect(loggedObject).toHaveProperty('method', 'GET');
    expect(loggedObject).not.toHaveProperty('extraProperty');
  });

  it('should use spread operator for object manipulation', () => {
    const error = new ValidationError('Test', { field: 'email' });
    const options: MiddlewareOptions = { errorLogging: true };
    const context = {
      requestId: 'req-123',
      executionTime: 50,
    };
    
    const result = handleError(error, options, context);
    
    // Verify spread operator usage in metadata
    expect(result.metadata).toEqual({
      errorType: 'http',
      classification: 'http',
      requestId: 'req-123',
      executionTime: 50,
    });
  });

  it('should use template literals in error aggregation', () => {
    const errors = [
      new Error('First error'),
      new Error('Second error'),
    ];
    
    const result = aggregateErrors(errors);
    
    // Verify template literal usage
    expect(result.message).toMatch(/Multiple errors occurred:\n1\. .+\n2\. .+/);
  });
});