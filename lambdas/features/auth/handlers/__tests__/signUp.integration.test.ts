/**
 * Integration tests for user registration handler
 * Tests the complete handler flow with mocked dependencies
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { APIGatewayProxyEventV2, Context } from 'aws-lambda';

// Mock the auth service before importing
const mockAuthService = {
  isEmailAvailable: jest.fn(),
  signUp: jest.fn(),
};

jest.mock('../../services/auth.service', () => ({
  authService: mockAuthService,
}));

// Mock the wrapper to test handler logic directly
jest.mock('../../../shared/wrapper', () => ({
  withMiddleware: (handler: any, options?: any) => handler,
}));

// Import after mocking
const { signUpHandler } = require('../signUp');

// Mock context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2023/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
};

// Helper function to create mock event
const createMockEvent = (body: any): APIGatewayProxyEventV2 => ({
  version: '2.0',
  routeKey: 'POST /auth/signup',
  rawPath: '/auth/signup',
  rawQueryString: '',
  headers: {
    'content-type': 'application/json',
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    domainName: 'test.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'test',
    http: {
      method: 'POST',
      path: '/auth/signup',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    requestId: 'test-request-id',
    routeKey: 'POST /auth/signup',
    stage: 'test',
    time: '01/Jan/2023:00:00:00 +0000',
    timeEpoch: 1672531200000,
  },
  body: body ? JSON.stringify(body) : undefined,
  isBase64Encoded: false,
});

describe('signUpHandler Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  describe('Successful Registration Flow (Requirements 1.1, 1.5)', () => {
    it('should successfully process valid registration request', async () => {
      // Arrange
      const signUpData = {
        email: 'test@example.com',
        password: 'SecurePass123',
        name: 'Test User',
      };

      const mockAuthResult = {
        user: {
          id: 'user_01234567890123456789012345',
          email: 'test@example.com',
          emailVerified: false,
          name: 'Test User',
          image: null,
          role: 'user' as const,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
        },
        session: {
          id: 'session_01234567890123456789012345',
          sessionToken: 'mock-session-token',
          userId: 'user_01234567890123456789012345',
          expires: new Date('2023-01-08T00:00:00Z'),
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
        },
        token: 'mock-jwt-token',
      };

      mockAuthService.isEmailAvailable.mockResolvedValue(true);
      mockAuthService.signUp.mockResolvedValue(mockAuthResult);

      const event = createMockEvent(signUpData);

      // Act
      const result = await signUpHandler(event, mockContext);

      // Assert
      expect(mockAuthService.isEmailAvailable).toHaveBeenCalledWith('test@example.com');
      expect(mockAuthService.signUp).toHaveBeenCalledWith(signUpData);

      expect(result).toMatchObject({
        user: {
          id: 'user_01234567890123456789012345',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
        },
        token: 'mock-jwt-token',
        expiresAt: '2023-01-08T00:00:00.000Z',
      });

      // Verify sensitive data is excluded
      expect(result.user).not.toHaveProperty('emailVerified');
      expect(result).not.toHaveProperty('session');
    });
  });

  describe('Duplicate Email Handling (Requirement 1.2)', () => {
    it('should reject registration when email already exists', async () => {
      // Arrange
      const signUpData = {
        email: 'existing@example.com',
        password: 'SecurePass123',
        name: 'Test User',
      };

      mockAuthService.isEmailAvailable.mockResolvedValue(false);

      const event = createMockEvent(signUpData);

      // Act & Assert
      await expect(signUpHandler(event, mockContext)).rejects.toThrow('An account with this email already exists');
      expect(mockAuthService.isEmailAvailable).toHaveBeenCalledWith('existing@example.com');
      expect(mockAuthService.signUp).not.toHaveBeenCalled();
    });
  });

  describe('Request Body Validation', () => {
    it('should reject missing request body', async () => {
      // Arrange
      const event = createMockEvent(null);

      // Act & Assert
      await expect(signUpHandler(event, mockContext)).rejects.toThrow('Request body is required');
    });

    it('should reject invalid JSON', async () => {
      // Arrange
      const event = createMockEvent({});
      event.body = 'invalid-json{';

      // Act & Assert
      await expect(signUpHandler(event, mockContext)).rejects.toThrow('Invalid JSON in request body');
    });
  });

  describe('Service Error Handling', () => {
    it('should propagate auth service errors', async () => {
      // Arrange
      const signUpData = {
        email: 'test@example.com',
        password: 'SecurePass123',
        name: 'Test User',
      };

      mockAuthService.isEmailAvailable.mockResolvedValue(true);
      mockAuthService.signUp.mockRejectedValue(new Error('Database connection failed'));

      const event = createMockEvent(signUpData);

      // Act & Assert
      await expect(signUpHandler(event, mockContext)).rejects.toThrow('Database connection failed');
    });

    it('should handle email availability check errors', async () => {
      // Arrange
      const signUpData = {
        email: 'test@example.com',
        password: 'SecurePass123',
        name: 'Test User',
      };

      mockAuthService.isEmailAvailable.mockRejectedValue(new Error('Email service unavailable'));

      const event = createMockEvent(signUpData);

      // Act & Assert
      await expect(signUpHandler(event, mockContext)).rejects.toThrow('Email service unavailable');
    });
  });

  describe('Response Format Validation (Requirement 1.5)', () => {
    it('should return properly structured AuthResponse', async () => {
      // Arrange
      const signUpData = {
        email: 'test@example.com',
        password: 'SecurePass123',
      };

      const mockAuthResult = {
        user: {
          id: 'user_01234567890123456789012345',
          email: 'test@example.com',
          emailVerified: false,
          name: null,
          image: null,
          role: 'user' as const,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
        },
        session: {
          id: 'session_01234567890123456789012345',
          sessionToken: 'mock-session-token',
          userId: 'user_01234567890123456789012345',
          expires: new Date('2023-01-08T00:00:00Z'),
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
        },
        token: 'mock-jwt-token',
      };

      mockAuthService.isEmailAvailable.mockResolvedValue(true);
      mockAuthService.signUp.mockResolvedValue(mockAuthResult);

      const event = createMockEvent(signUpData);

      // Act
      const result = await signUpHandler(event, mockContext);

      // Assert - verify exact AuthResponse structure
      expect(result).toEqual({
        user: {
          id: 'user_01234567890123456789012345',
          email: 'test@example.com',
          name: null,
          image: null,
          role: 'user',
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
        },
        token: 'mock-jwt-token',
        expiresAt: '2023-01-08T00:00:00.000Z',
      });

      // Verify required fields are present
      expect(result.user.id).toBeDefined();
      expect(result.user.email).toBeDefined();
      expect(result.user.role).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });
  });
});