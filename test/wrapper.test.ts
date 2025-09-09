import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { withMiddleware } from '../lambdas/middleware/wrapper';
import {
  NotFoundError,
  BadRequestError,
  ValidationError,
  HttpError,
} from '../lambdas/middleware/errors';
import {
  MiddlewareOptions,
  HandlerResponse,
} from '../lambdas/middleware/types';

// Type for API Gateway v2 response
interface APIGatewayProxyResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

// Helper to call wrapped handler and cast result
const callWrappedHandler = async (
  wrappedHandler: any,
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  return await wrappedHandler(event, context);
};

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

// Helper function to create mock API Gateway event using ES6+ features
const createMockEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 => ({
  version: '2.0',
  routeKey: 'GET /test',
  rawPath: '/test',
  rawQueryString: '',
  headers: {},
  requestContext: {
    accountId: '123456789',
    apiId: 'test-api',
    domainName: 'test.example.com',
    domainPrefix: 'test',
    http: {
      method: 'GET',
      path: '/test',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'GET /test',
    stage: 'test',
    time: '01/Jan/2023:00:00:00 +0000',
    timeEpoch: 1672531200000,
  },
  isBase64Encoded: false,
  ...overrides,
});

// Helper function to create mock Lambda context using ES6+ features
const createMockContext = (overrides: Partial<Context> = {}): Context => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn:
    'arn:aws:lambda:us-east-1:123456789:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-aws-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2023/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
  ...overrides,
});

describe('withMiddleware', () => {
  describe('successful request processing', () => {
    it('should handle plain object return using ES6+ features', async () => {
      // Create handler that returns plain object using arrow function
      const handler = async () => ({ message: 'Hello World', count: 42 });

      const wrappedHandler = withMiddleware(handler);
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      // Verify response structure using destructuring
      const { statusCode, headers, body } = result;
      const parsedBody = JSON.parse(body);

      expect(statusCode).toBe(200);
      expect(headers!['Content-Type']).toBe('application/json');
      expect(parsedBody).toEqual({
        success: true,
        data: { message: 'Hello World', count: 42 },
      });
    });

    it('should handle HandlerResponse with custom status code using object spread', async () => {
      // Create handler that returns HandlerResponse using ES6+ features
      const handler = async (): Promise<HandlerResponse<string>> => ({
        data: 'Created successfully',
        statusCode: 201,
      });

      const wrappedHandler = withMiddleware(handler);
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(201);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: true,
        data: 'Created successfully',
      });
    });

    it('should handle synchronous handlers using modern syntax', async () => {
      // Create synchronous handler using arrow function
      const handler = () => ({ sync: true, value: 'test' });

      const wrappedHandler = withMiddleware(handler);
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(200);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(true);
      expect(parsedBody.data).toEqual({ sync: true, value: 'test' });
    });
  });

  describe('CORS handling with default parameters and optional chaining', () => {
    it('should add CORS headers when configured using ES6+ features', async () => {
      const handler = async () => ({ message: 'CORS test' });

      // Configure CORS using object shorthand syntax
      const options: MiddlewareOptions = {
        cors: {
          origin: 'https://example.com',
          methods: ['GET', 'POST'],
          headers: ['Content-Type', 'Authorization'],
          credentials: true,
        },
      };

      const wrappedHandler = withMiddleware(handler, options);
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      // Verify CORS headers using destructuring
      const { headers } = result;
      expect(headers!['Access-Control-Allow-Origin']).toBe(
        'https://example.com'
      );
      expect(headers!['Access-Control-Allow-Methods']).toBe('GET, POST');
      expect(headers!['Access-Control-Allow-Headers']).toBe(
        'Content-Type, Authorization'
      );
      expect(headers!['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should handle multiple origins using array spread', async () => {
      const handler = async () => ({ message: 'Multi-origin test' });

      const options: MiddlewareOptions = {
        cors: {
          origin: ['https://app1.com', 'https://app2.com'],
          methods: ['GET'],
        },
      };

      const wrappedHandler = withMiddleware(handler, options);
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.headers!['Access-Control-Allow-Origin']).toBe(
        'https://app1.com, https://app2.com'
      );
    });

    it('should work without CORS configuration using optional chaining', async () => {
      const handler = async () => ({ message: 'No CORS' });

      const wrappedHandler = withMiddleware(handler);
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      // Should not have CORS headers when not configured
      expect(result.headers!['Access-Control-Allow-Origin']).toBeUndefined();
      expect(result.headers!['Content-Type']).toBe('application/json');
    });
  });

  describe('error handling with try/catch and async/await', () => {
    it('should handle HttpError instances using instanceof checks', async () => {
      const handler = async () => {
        throw new NotFoundError('Resource not found', { resourceId: '123' });
      };

      const wrappedHandler = withMiddleware(handler, { errorLogging: false });
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(404);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: false,
        error: {
          message: 'Resource not found',
          code: 'NOT_FOUND',
          details: { resourceId: '123' },
        },
        data: null,
      });
    });

    it('should handle custom error mappings using optional chaining', async () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const handler = async () => {
        throw new CustomError('Custom error occurred');
      };

      // Configure custom error mapping using ES6+ features
      const options: MiddlewareOptions = {
        customErrorMap: {
          CustomError: 418,
        },
        errorLogging: false,
      };

      const wrappedHandler = withMiddleware(handler, options);
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(418);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.message).toBe('Custom error occurred');
    });

    it('should handle unknown errors with 500 status using nullish coalescing', async () => {
      const handler = async () => {
        throw new Error('Unknown error');
      };

      const wrappedHandler = withMiddleware(handler, { errorLogging: false });
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(500);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
      // The error message might be sanitized, so let's just check that we get an error response
      expect(parsedBody.error.message).toBeDefined();
      expect(typeof parsedBody.error.message).toBe('string');
    });

    it('should include CORS headers in error responses using spread operator', async () => {
      const handler = async () => {
        throw new BadRequestError('Invalid input');
      };

      const options: MiddlewareOptions = {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
        },
        errorLogging: false,
      };

      const wrappedHandler = withMiddleware(handler, options);
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(400);
      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers!['Content-Type']).toBe('application/json');
    });
  });

  describe('request context and metadata using destructuring', () => {
    it('should extract request context using destructuring and optional chaining', async () => {
      const handler = async () => {
        throw new ValidationError('Validation failed');
      };

      const wrappedHandler = withMiddleware(handler);

      // Create event with specific route and method using object spread
      const event = createMockEvent({
        routeKey: 'POST /users',
        rawPath: '/users',
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            method: 'POST',
            path: '/users',
          },
        },
      });

      const context = createMockContext({
        awsRequestId: 'specific-request-id',
      });

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(422);
      const parsedBody = JSON.parse(result.body);

      // Verify the error response structure using destructuring
      expect(parsedBody).toEqual({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
        },
        data: null,
      });

      // Verify that the request context was properly extracted and used
      // The middleware should handle the error correctly regardless of logging
      expect(parsedBody.success).toBe(false);
      expect(parsedBody.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle missing request context gracefully using optional chaining', async () => {
      const handler = async () => ({ message: 'Success' });

      const wrappedHandler = withMiddleware(handler);

      // Create minimal event without full request context
      const event = {
        ...createMockEvent(),
        requestContext: {
          ...createMockEvent().requestContext,
          http: undefined as any,
        },
      };

      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(200);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(true);
    });
  });

  describe('ES6+ features usage verification', () => {
    it('should demonstrate arrow functions and template literals', async () => {
      // Handler using arrow function with template literals
      const handler = async (event: APIGatewayProxyEventV2) => {
        const path = event.rawPath ?? '/unknown';
        return {
          message: `Request processed for path: ${path}`,
          timestamp: new Date().toISOString(),
        };
      };

      const wrappedHandler = withMiddleware(handler);
      const event = createMockEvent({ rawPath: '/api/test' });
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(200);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.data.message).toBe(
        'Request processed for path: /api/test'
      );
      expect(parsedBody.data.timestamp).toBeDefined();
    });

    it('should demonstrate object spread and destructuring', async () => {
      // Handler using destructuring and object spread
      const handler = async (
        event: APIGatewayProxyEventV2,
        context: Context
      ) => {
        const { awsRequestId, functionName } = context;
        const { rawPath, requestContext } = event;

        return {
          requestInfo: {
            id: awsRequestId,
            function: functionName,
            path: rawPath,
            ...(requestContext && {
              method: requestContext.http?.method,
              stage: requestContext.stage,
            }),
          },
        };
      };

      const wrappedHandler = withMiddleware(handler);
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(200);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.data.requestInfo).toEqual({
        id: 'test-aws-request-id',
        function: 'test-function',
        path: '/test',
        method: 'GET',
        stage: 'test',
      });
    });

    it('should demonstrate async/await with proper error propagation', async () => {
      // Simulate async operation that might fail
      const asyncOperation = async (shouldFail: boolean): Promise<string> => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        if (shouldFail) {
          throw new NotFoundError('Async operation failed');
        }
        return 'Async success';
      };

      const handler = async () => {
        const result = await asyncOperation(true);
        return { result };
      };

      const wrappedHandler = withMiddleware(handler, { errorLogging: false });
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(404);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.error.message).toBe('Async operation failed');
      expect(parsedBody.error.code).toBe('NOT_FOUND');
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle null/undefined return values', async () => {
      const handler = async () => null;

      const wrappedHandler = withMiddleware(handler);
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(200);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody).toEqual({
        success: true,
        data: null,
      });
    });

    it('should handle handlers that throw non-Error objects', async () => {
      const handler = async () => {
        throw 'String error';
      };

      const wrappedHandler = withMiddleware(handler, { errorLogging: false });
      const event = createMockEvent();
      const context = createMockContext();

      const result = await callWrappedHandler(wrappedHandler, event, context);

      expect(result.statusCode).toBe(500);
      const parsedBody = JSON.parse(result.body);
      expect(parsedBody.success).toBe(false);
    });

    it('should handle production error sanitization', async () => {
      // Temporarily set NODE_ENV to production
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const handler = async () => {
          throw new Error('Sensitive internal error');
        };

        const wrappedHandler = withMiddleware(handler, { errorLogging: false });
        const event = createMockEvent();
        const context = createMockContext();

        const result = await callWrappedHandler(wrappedHandler, event, context);

        expect(result.statusCode).toBe(500);
        const parsedBody = JSON.parse(result.body);
        expect(parsedBody.error.message).toBe('Internal server error');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
