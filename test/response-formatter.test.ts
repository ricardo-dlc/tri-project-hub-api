import {
  formatSuccessResponse,
  formatErrorResponse,
  generateCorsHeaders,
  isHandlerResponse,
} from '../lambdas/shared/response-formatter';
import { HttpError, NotFoundError, ValidationError } from '../lambdas/shared/errors';

describe('Response Formatter Utilities', () => {
  describe('formatSuccessResponse', () => {
    it('should format success response with data using object shorthand syntax', () => {
      const data = { id: 1, name: 'Test' };
      const result = formatSuccessResponse(data);

      expect(result).toEqual({
        success: true,
        data: { id: 1, name: 'Test' },
      });
    });

    it('should format success response with data and message using spread operator', () => {
      const data = { id: 1, name: 'Test' };
      const message = 'Operation completed successfully';
      const result = formatSuccessResponse(data, message);

      expect(result).toEqual({
        success: true,
        data: { id: 1, name: 'Test' },
        message: 'Operation completed successfully',
      });
    });

    it('should handle null data', () => {
      const result = formatSuccessResponse(null);

      expect(result).toEqual({
        success: true,
        data: null,
      });
    });

    it('should handle undefined data', () => {
      const result = formatSuccessResponse(undefined);

      expect(result).toEqual({
        success: true,
        data: undefined,
      });
    });

    it('should handle array data', () => {
      const data = [1, 2, 3];
      const result = formatSuccessResponse(data);

      expect(result).toEqual({
        success: true,
        data: [1, 2, 3],
      });
    });

    it('should handle primitive data types', () => {
      expect(formatSuccessResponse('string')).toEqual({
        success: true,
        data: 'string',
      });

      expect(formatSuccessResponse(42)).toEqual({
        success: true,
        data: 42,
      });

      expect(formatSuccessResponse(true)).toEqual({
        success: true,
        data: true,
      });
    });
  });

  describe('formatErrorResponse', () => {
    it('should format generic error response using template literals and spread operator', () => {
      const error = new Error('Something went wrong');
      const result = formatErrorResponse(error);

      expect(result).toEqual({
        success: false,
        error: {
          message: 'Something went wrong',
        },
        data: null,
      });
    });

    it('should format HttpError response with code using destructuring', () => {
      const error = new NotFoundError('Resource not found');
      const result = formatErrorResponse(error);

      expect(result).toEqual({
        success: false,
        error: {
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
        data: null,
      });
    });

    it('should format HttpError response with details using spread operator', () => {
      const errorDetails = { field: 'email', value: 'invalid-email' };
      const error = new ValidationError('Invalid email format', errorDetails);
      const result = formatErrorResponse(error);

      expect(result).toEqual({
        success: false,
        error: {
          message: 'Invalid email format',
          code: 'VALIDATION_ERROR',
          details: { field: 'email', value: 'invalid-email' },
        },
        data: null,
      });
    });

    it('should handle HttpError without details', () => {
      const error = new NotFoundError('User not found');
      const result = formatErrorResponse(error);

      expect(result).toEqual({
        success: false,
        error: {
          message: 'User not found',
          code: 'NOT_FOUND',
        },
        data: null,
      });
    });

    it('should handle empty error message', () => {
      const error = new Error('');
      const result = formatErrorResponse(error);

      expect(result).toEqual({
        success: false,
        error: {
          message: '',
        },
        data: null,
      });
    });
  });

  describe('generateCorsHeaders', () => {
    it('should generate default CORS headers using default parameters', () => {
      const headers = generateCorsHeaders();

      expect(headers).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
    });

    it('should generate CORS headers with custom origin string', () => {
      const headers = generateCorsHeaders('https://example.com');

      expect(headers).toEqual({
        'Access-Control-Allow-Origin': 'https://example.com',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
    });

    it('should generate CORS headers with multiple origins using array join', () => {
      const origins = ['https://example.com', 'https://app.example.com'];
      const headers = generateCorsHeaders(origins);

      expect(headers).toEqual({
        'Access-Control-Allow-Origin': 'https://example.com, https://app.example.com',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
    });

    it('should generate CORS headers with custom methods', () => {
      const methods = ['GET', 'POST'];
      const headers = generateCorsHeaders('*', methods);

      expect(headers).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
    });

    it('should generate CORS headers with custom headers', () => {
      const customHeaders = ['Content-Type', 'X-API-Key'];
      const headers = generateCorsHeaders('*', undefined, customHeaders);

      expect(headers).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      });
    });

    it('should include credentials header when enabled using spread operator', () => {
      const headers = generateCorsHeaders('https://example.com', undefined, undefined, true);

      expect(headers).toEqual({
        'Access-Control-Allow-Origin': 'https://example.com',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      });
    });

    it('should not include credentials header when disabled', () => {
      const headers = generateCorsHeaders('https://example.com', undefined, undefined, false);

      expect(headers).toEqual({
        'Access-Control-Allow-Origin': 'https://example.com',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
    });

    it('should handle empty arrays for methods and headers', () => {
      const headers = generateCorsHeaders('*', [], []);

      expect(headers).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '',
        'Access-Control-Allow-Headers': '',
      });
    });
  });

  describe('isHandlerResponse', () => {
    it('should identify HandlerResponse objects using safe property access', () => {
      const handlerResponse = { data: { id: 1 }, statusCode: 201 };
      expect(isHandlerResponse(handlerResponse)).toBe(true);
    });

    it('should identify HandlerResponse objects without statusCode', () => {
      const handlerResponse = { data: { id: 1 } };
      expect(isHandlerResponse(handlerResponse)).toBe(true);
    });

    it('should reject plain objects without data property', () => {
      const plainObject = { id: 1, name: 'Test' };
      expect(isHandlerResponse(plainObject)).toBe(false);
    });

    it('should reject null values using optional chaining', () => {
      expect(isHandlerResponse(null)).toBe(false);
    });

    it('should reject undefined values', () => {
      expect(isHandlerResponse(undefined)).toBe(false);
    });

    it('should reject primitive values', () => {
      expect(isHandlerResponse('string')).toBe(false);
      expect(isHandlerResponse(42)).toBe(false);
      expect(isHandlerResponse(true)).toBe(false);
    });

    it('should reject arrays', () => {
      expect(isHandlerResponse([1, 2, 3])).toBe(false);
    });

    it('should handle objects with data property set to null', () => {
      const response = { data: null };
      expect(isHandlerResponse(response)).toBe(true);
    });

    it('should handle objects with data property set to undefined', () => {
      const response = { data: undefined };
      expect(isHandlerResponse(response)).toBe(true);
    });
  });
});