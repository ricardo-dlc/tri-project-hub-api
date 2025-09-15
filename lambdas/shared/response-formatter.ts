import { HttpError } from './errors';
import { ErrorResponse, SuccessResponse, HandlerResponse } from './types';

// Success response formatting using ES6+ features
export const formatSuccessResponse = <T>(
  data: T,
  message?: string
): SuccessResponse<T> => ({
  success: true,
  data,
  ...(message && { message }),
});

// Error response formatting using template literals and spread operator
export const formatErrorResponse = (error: Error): ErrorResponse => ({
  success: false,
  error: {
    message: error.message,
    ...(error instanceof HttpError && { code: error.code }),
    ...(error instanceof HttpError &&
      error.details && { details: error.details }),
  },
  data: null,
});

// Helper to check if result is a HandlerResponse
export const isHandlerResponse = <T>(
  result: T | HandlerResponse<T>
): result is HandlerResponse<T> => {
  return typeof result === 'object' && result !== null && 'data' in result;
};

// CORS header generation utility using ES6+ features and default parameters
export const generateCorsHeaders = (
  origin: string | string[] = '*',
  methods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  headers: string[] = ['Content-Type', 'Authorization'],
  credentials: boolean = false
): Record<string, string> => {
  const corsOrigin = Array.isArray(origin) ? origin.join(', ') : origin;

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': methods.join(', '),
    'Access-Control-Allow-Headers': headers.join(', '),
    ...(credentials && { 'Access-Control-Allow-Credentials': 'true' }),
  };
};
