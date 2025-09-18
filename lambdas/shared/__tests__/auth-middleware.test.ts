/**
 * Unit tests for authentication middleware
 * Tests token extraction, validation, role-based access control, and rate limiting
 * Requirements: 4.1, 4.2, 5.1
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { type User, type Session, type SessionValidationResult } from '../../features/auth/types/auth.types';

// Mock the auth service module completely
jest.mock('../../features/auth/services/auth.service', () => ({
  authService: {
    validateSession: jest.fn(),
  },
}));

// Mock the better-auth module to avoid ES module issues
jest.mock('../../shared/auth/better-auth', () => ({
  auth: {
    api: {
      validateSession: jest.fn(),
    },
  },
}));

// Import after mocking
import {
  withAuth,
  withAuthRequired,
  withRole,
  withPermissions,
  getAuthenticatedUser,
  getAuthContext,
  AuthenticationError,
  type AuthenticatedEvent,
} from '../auth-middleware';
import { authService } from '../../features/auth/services/auth.service';

const mockAuthService = authService as jest.Mocked<typeof authService>;

// Mock data
const mockUser: User = {
  id: 'user_123',
  email: 'test@example.com',
  emailVerified: true,
  name: 'Test User',
  image: null,
  role: 'user',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockOrganizerUser: User = {
  ...mockUser,
  id: 'organizer_123',
  email: 'organizer@example.com',
  role: 'organizer',
};

const mockAdminUser: User = {
  ...mockUser,
  id: 'admin_123',
  email: 'admin@example.com',
  role: 'admin',
};

const mockSession: Session = {
  id: 'session_123',
  sessionToken: 'valid_token_123',
  userId: mockUser.id,
  expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'request-123',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2024/01/01/[$LATEST]stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
};

// Helper function to create mock API Gateway event
function createMockEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /test',
    rawPath: '/test',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'api123',
      domainName: 'api.example.com',
      domainPrefix: 'api',
      http: {
        method: 'GET',
        path: '/test',
        protocol: 'HTTP/1.1',
        sourceIp: '192.168.1.1',
        userAgent: 'test-agent',
      },
      requestId: 'request-123',
      routeKey: 'GET /test',
      stage: 'test',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
    isBase64Encoded: false,
    ...overrides,
  };
}

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to properly type handler results
  const callHandler = async (handler: any, event: APIGatewayProxyEventV2, context: Context): Promise<any> => {
    return handler(event, context);
  };

  describe('Token Extraction', () => {
    it('should extract token from Authorization header with Bearer prefix', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer valid_token_123' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockUser,
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withAuth(async (event: AuthenticatedEvent) => {
        expect(event.user).toEqual(mockUser);
        expect(event.session).toEqual(mockSession);
        return { success: true };
      });

      await callHandler(handler, event, mockContext);
      expect(mockAuthService.validateSession).toHaveBeenCalledWith('valid_token_123');
    });

    it('should extract token from Authorization header without Bearer prefix', async () => {
      const event = createMockEvent({
        headers: { authorization: 'valid_token_123' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockUser,
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withAuth(async (event: AuthenticatedEvent) => {
        return { success: true };
      });

      await callHandler(handler, event, mockContext);
      expect(mockAuthService.validateSession).toHaveBeenCalledWith('valid_token_123');
    });

    it('should handle case-insensitive Authorization header', async () => {
      const event = createMockEvent({
        headers: { Authorization: 'Bearer valid_token_123' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockUser,
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withAuth(async (event: AuthenticatedEvent) => {
        return { success: true };
      });

      await callHandler(handler, event, mockContext);
      expect(mockAuthService.validateSession).toHaveBeenCalledWith('valid_token_123');
    });

    it('should handle missing Authorization header', async () => {
      const event = createMockEvent();

      const handler = withAuth(async (event: AuthenticatedEvent) => {
        expect(event.user).toBeUndefined();
        expect(event.session).toBeUndefined();
        return { success: true };
      });

      await callHandler(handler, event, mockContext);
      expect(mockAuthService.validateSession).not.toHaveBeenCalled();
    });
  });

  describe('Authentication Validation', () => {
    it('should allow access when authentication is not required', async () => {
      const event = createMockEvent();

      const handler = withAuth(async (event: AuthenticatedEvent) => {
        return { message: 'success' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: { message: 'success' },
      });
    });

    it('should require authentication when auth.required is true', async () => {
      const event = createMockEvent();

      const handler = withAuth(
        async (event: AuthenticatedEvent) => {
          return { message: 'success' };
        },
        { auth: { required: true } }
      );

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('authentication token provided'),
        }),
      });
    });

    it('should authenticate valid token', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer valid_token_123' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockUser,
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withAuthRequired(async (event: AuthenticatedEvent) => {
        expect(event.user).toEqual(mockUser);
        expect(event.authContext).toEqual({
          user: mockUser,
          session: mockSession,
        });
        return { message: 'authenticated' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: { message: 'authenticated' },
      });
    });

    it('should reject invalid token', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer invalid_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: false,
        error: 'Invalid token',
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withAuthRequired(async (event: AuthenticatedEvent) => {
        return { message: 'should not reach here' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Invalid token'),
        }),
      });
    });

    it('should handle auth service errors', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer error_token' },
      });

      mockAuthService.validateSession.mockRejectedValue(new Error('Service error'));

      const handler = withAuthRequired(async (event: AuthenticatedEvent) => {
        return { message: 'should not reach here' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(401);
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow access for users with correct role', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer organizer_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockOrganizerUser,
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withRole('organizer', async (event: AuthenticatedEvent) => {
        return { message: 'organizer access granted' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: { message: 'organizer access granted' },
      });
    });

    it('should deny access for users with incorrect role', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer user_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockUser, // user role
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withRole('organizer', async (event: AuthenticatedEvent) => {
        return { message: 'should not reach here' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(403);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Access denied'),
        }),
      });
    });

    it('should allow access for multiple valid roles', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer admin_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockAdminUser,
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withRole(['organizer', 'admin'], async (event: AuthenticatedEvent) => {
        return { message: 'admin access granted' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Permission-Based Access Control', () => {
    it('should allow access for users with correct permissions', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer organizer_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockOrganizerUser,
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withPermissions('write:events', async (event: AuthenticatedEvent) => {
        return { message: 'write access granted' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(200);
    });

    it('should deny access for users without required permissions', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer user_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockUser, // user role - no write:events permission
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withPermissions('write:events', async (event: AuthenticatedEvent) => {
        return { message: 'should not reach here' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(403);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Missing permissions'),
        }),
      });
    });

    it('should handle multiple permissions', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer admin_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockAdminUser,
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withPermissions(
        ['read:events', 'write:events', 'admin:system'],
        async (event: AuthenticatedEvent) => {
          return { message: 'admin access granted' };
        }
      );

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const event = createMockEvent();

      const handler = withAuth(
        async (event: AuthenticatedEvent) => {
          return { message: 'success' };
        },
        {
          auth: {
            rateLimiting: {
              maxAttempts: 5,
              windowMs: 60000, // 1 minute
            },
          },
        }
      );

      // Make multiple requests within limit
      for (let i = 0; i < 3; i++) {
        const result = await callHandler(handler, event, mockContext);
        expect(result.statusCode).toBe(200);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      const event = createMockEvent();

      const handler = withAuth(
        async (event: AuthenticatedEvent) => {
          return { message: 'success' };
        },
        {
          auth: {
            rateLimiting: {
              maxAttempts: 2,
              windowMs: 60000, // 1 minute
            },
          },
        }
      );

      // Make requests up to limit
      await callHandler(handler, event, mockContext);
      await callHandler(handler, event, mockContext);

      // This should be blocked
      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(429);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Rate limit exceeded'),
        }),
      });
    });

    it('should use different rate limits for different clients', async () => {
      const event1 = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            sourceIp: '10.0.0.1', // Different IP to avoid conflicts with other tests
          },
        },
        headers: {
          'user-agent': 'client1-agent',
        },
      });

      const event2 = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          http: {
            ...createMockEvent().requestContext.http,
            sourceIp: '10.0.0.2', // Different IP
          },
        },
        headers: {
          'user-agent': 'client2-agent',
        },
      });

      const handler = withAuth(
        async (event: AuthenticatedEvent) => {
          return { message: 'success' };
        },
        {
          auth: {
            rateLimiting: {
              maxAttempts: 1,
              windowMs: 60000,
            },
          },
        }
      );

      // Both clients should be able to make one request
      const result1 = await callHandler(handler, event1, mockContext);
      const result2 = await callHandler(handler, event2, mockContext);

      expect(result1.statusCode).toBe(200);
      expect(result2.statusCode).toBe(200);

      // Second request from client 1 should be blocked
      const result3 = await callHandler(handler, event1, mockContext);
      expect(result3.statusCode).toBe(429);
    });
  });

  describe('Utility Functions', () => {
    it('should get authenticated user from event', () => {
      const event = createMockEvent() as AuthenticatedEvent;
      event.user = mockUser;

      const user = getAuthenticatedUser(event);
      expect(user).toEqual(mockUser);
    });

    it('should throw error when user is not authenticated', () => {
      const event = createMockEvent() as AuthenticatedEvent;

      expect(() => getAuthenticatedUser(event)).toThrow(AuthenticationError);
    });

    it('should get auth context from event', () => {
      const event = createMockEvent() as AuthenticatedEvent;
      const authContext = { user: mockUser, session: mockSession };
      event.authContext = authContext;

      const context = getAuthContext(event);
      expect(context).toEqual(authContext);
    });

    it('should throw error when auth context is not available', () => {
      const event = createMockEvent() as AuthenticatedEvent;

      expect(() => getAuthContext(event)).toThrow(AuthenticationError);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors properly', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer invalid_token' },
      });

      mockAuthService.validateSession.mockRejectedValue(
        new Error('Authentication failed')
      );

      const handler = withAuthRequired(async (event: AuthenticatedEvent) => {
        return { message: 'should not reach here' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(401);
    });

    it('should handle authorization errors properly', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer user_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockUser,
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withRole('admin', async (event: AuthenticatedEvent) => {
        return { message: 'should not reach here' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(403);
    });

    it('should handle rate limiting errors properly', async () => {
      const event = createMockEvent();

      const handler = withAuth(
        async (event: AuthenticatedEvent) => {
          return { message: 'success' };
        },
        {
          auth: {
            rateLimiting: {
              maxAttempts: 1,
              windowMs: 60000,
            },
          },
        }
      );

      // First request should succeed
      await callHandler(handler, event, mockContext);

      // Second request should be rate limited
      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(429);
    });
  });

  describe('Advanced RBAC Features', () => {
    it('should support requireAllPermissions=false for any permission matching', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer user_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockUser, // user role has 'read:events' but not 'write:events'
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withAuth(
        async (event: AuthenticatedEvent) => {
          return { message: 'access granted' };
        },
        {
          auth: {
            required: true,
            permissions: ['read:events', 'write:events'], // User has read but not write
            requireAllPermissions: false, // Should allow access with just read
          },
        }
      );

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(200);
    });

    it('should deny access when requireAllPermissions=false and user has no matching permissions', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer user_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockUser, // user role doesn't have admin permissions
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withAuth(
        async (event: AuthenticatedEvent) => {
          return { message: 'should not reach here' };
        },
        {
          auth: {
            required: true,
            permissions: ['admin:system', 'delete:users'], // User has neither
            requireAllPermissions: false,
          },
        }
      );

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(403);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Requires at least one of'),
        }),
      });
    });

    it('should support advanced RBAC config', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer organizer_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockOrganizerUser,
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withAuth(
        async (event: AuthenticatedEvent) => {
          return { message: 'rbac access granted' };
        },
        {
          auth: {
            required: true,
            rbac: {
              roles: ['organizer', 'admin'],
              permissions: ['write:events'],
              requireAll: true,
            },
          },
        }
      );

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(200);
    });

    it('should deny access with RBAC config when requirements not met', async () => {
      const event = createMockEvent({
        headers: { authorization: 'Bearer user_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockUser, // user role doesn't meet requirements
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const handler = withAuth(
        async (event: AuthenticatedEvent) => {
          return { message: 'should not reach here' };
        },
        {
          auth: {
            required: true,
            rbac: {
              roles: ['organizer', 'admin'],
              permissions: ['write:events'],
              requireAll: true,
            },
          },
        }
      );

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(403);
    });
  });

  describe('RBAC Utility Functions', () => {
    it('should check if user has specific role', () => {
      const { hasRole } = require('../auth-middleware');
      
      expect(hasRole(mockUser, 'user')).toBe(true);
      expect(hasRole(mockUser, 'admin')).toBe(false);
      expect(hasRole(mockAdminUser, 'admin')).toBe(true);
    });

    it('should check if user has any of specified roles', () => {
      const { hasAnyRole } = require('../auth-middleware');
      
      expect(hasAnyRole(mockUser, ['user', 'organizer'])).toBe(true);
      expect(hasAnyRole(mockUser, ['organizer', 'admin'])).toBe(false);
      expect(hasAnyRole(mockOrganizerUser, ['organizer', 'admin'])).toBe(true);
    });

    it('should check if user has specific permission', () => {
      const { hasPermission } = require('../auth-middleware');
      
      expect(hasPermission(mockUser, 'read:events')).toBe(true);
      expect(hasPermission(mockUser, 'write:events')).toBe(false);
      expect(hasPermission(mockOrganizerUser, 'write:events')).toBe(true);
      expect(hasPermission(mockAdminUser, 'admin:system')).toBe(true);
    });

    it('should check if user has all specified permissions', () => {
      const { hasAllPermissions } = require('../auth-middleware');
      
      expect(hasAllPermissions(mockUser, ['read:profile', 'read:events'])).toBe(true);
      expect(hasAllPermissions(mockUser, ['read:events', 'write:events'])).toBe(false);
      expect(hasAllPermissions(mockAdminUser, ['read:events', 'write:events', 'admin:system'])).toBe(true);
    });

    it('should check if user has any of specified permissions', () => {
      const { hasAnyPermission } = require('../auth-middleware');
      
      expect(hasAnyPermission(mockUser, ['read:events', 'write:events'])).toBe(true);
      expect(hasAnyPermission(mockUser, ['write:events', 'admin:system'])).toBe(false);
      expect(hasAnyPermission(mockOrganizerUser, ['write:events', 'admin:system'])).toBe(true);
    });

    it('should get all permissions for user role', () => {
      const { getUserPermissions } = require('../auth-middleware');
      
      const userPermissions = getUserPermissions(mockUser);
      expect(userPermissions).toContain('read:profile');
      expect(userPermissions).toContain('read:events');
      expect(userPermissions).not.toContain('write:events');

      const adminPermissions = getUserPermissions(mockAdminUser);
      expect(adminPermissions).toContain('admin:system');
      expect(adminPermissions).toContain('write:events');
    });

    it('should check if user can access resource with RBAC config', () => {
      const { canAccess } = require('../auth-middleware');
      
      const rbacConfig = {
        roles: ['organizer', 'admin'],
        permissions: ['write:events'],
        requireAll: true,
      };

      expect(canAccess(mockUser, rbacConfig)).toBe(false);
      expect(canAccess(mockOrganizerUser, rbacConfig)).toBe(true);
      expect(canAccess(mockAdminUser, rbacConfig)).toBe(true);
    });
  });

  describe('withRBAC Convenience Function', () => {
    it('should create RBAC-protected endpoint', async () => {
      const { withRBAC } = require('../auth-middleware');
      
      const event = createMockEvent({
        headers: { authorization: 'Bearer organizer_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockOrganizerUser,
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const rbacConfig = {
        roles: ['organizer', 'admin'],
        permissions: ['write:events'],
        requireAll: true,
      };

      const handler = withRBAC(rbacConfig, async (event: AuthenticatedEvent) => {
        return { message: 'RBAC protected endpoint accessed' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: { message: 'RBAC protected endpoint accessed' },
      });
    });

    it('should deny access to RBAC-protected endpoint when requirements not met', async () => {
      const { withRBAC } = require('../auth-middleware');
      
      const event = createMockEvent({
        headers: { authorization: 'Bearer user_token' },
      });

      const validationResult: SessionValidationResult = {
        valid: true,
        user: mockUser, // user role doesn't meet requirements
        session: mockSession,
      };

      mockAuthService.validateSession.mockResolvedValue(validationResult);

      const rbacConfig = {
        roles: ['organizer', 'admin'],
        permissions: ['write:events'],
        requireAll: true,
      };

      const handler = withRBAC(rbacConfig, async (event: AuthenticatedEvent) => {
        return { message: 'should not reach here' };
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(403);
    });
  });

  describe('Integration with Existing Middleware', () => {
    it('should maintain CORS headers from base middleware', async () => {
      const event = createMockEvent();

      const handler = withAuth(
        async (event: AuthenticatedEvent) => {
          return { message: 'success' };
        },
        {
          cors: {
            origin: 'https://example.com',
            methods: ['GET', 'POST'],
            credentials: true,
          },
        }
      );

      const result = await callHandler(handler, event, mockContext);
      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': 'https://example.com',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Credentials': 'true',
      });
    });

    it('should maintain error handling from base middleware', async () => {
      const event = createMockEvent();

      const handler = withAuth(async (event: AuthenticatedEvent) => {
        throw new Error('Test error');
      });

      const result = await callHandler(handler, event, mockContext);
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: 'Test error',
        }),
      });
    });
  });
});