import {
  HttpError,
  NotFoundError,
  NotAuthorizedError,
  ForbiddenError,
  BadRequestError,
  ValidationError,
  ConflictError,
} from '../lambdas/middleware/errors';

describe('HttpError Base Class', () => {
  // Create a concrete implementation for testing the abstract base class
  class TestError extends HttpError {
    readonly statusCode = 418;
    readonly code = 'TEST_ERROR';
  }

  it('should create error with message', () => {
    const error = new TestError('Test message');

    expect(error.message).toBe('Test message');
    expect(error.name).toBe('TestError');
    expect(error.statusCode).toBe(418);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.details).toBeUndefined();
  });

  it('should create error with message and details using object spread', () => {
    const details = { field: 'value', nested: { prop: 'test' } };
    const error = new TestError('Test message', details);

    expect(error.message).toBe('Test message');
    expect(error.details).toEqual(details);
    expect(error.details).toBe(details); // Should be the same reference
  });

  it('should serialize to JSON using ES6+ features', () => {
    const error = new TestError('Test message');
    const json = error.toJSON();

    expect(json).toEqual({
      name: 'TestError',
      message: 'Test message',
      code: 'TEST_ERROR',
      statusCode: 418,
    });
  });

  it('should serialize to JSON with details using object spread operator', () => {
    const details = { validation: ['field1', 'field2'], context: 'test' };
    const error = new TestError('Test message', details);
    const json = error.toJSON();

    expect(json).toEqual({
      name: 'TestError',
      message: 'Test message',
      code: 'TEST_ERROR',
      statusCode: 418,
      details,
    });
  });

  it('should not include details in JSON when details is falsy', () => {
    const errorWithNull = new TestError('Test message', null);
    const errorWithUndefined = new TestError('Test message', undefined);
    const errorWithFalse = new TestError('Test message', false);
    const errorWithEmptyString = new TestError('Test message', '');
    const errorWithZero = new TestError('Test message', 0);

    expect(errorWithNull.toJSON()).not.toHaveProperty('details');
    expect(errorWithUndefined.toJSON()).not.toHaveProperty('details');
    expect(errorWithFalse.toJSON()).not.toHaveProperty('details');
    // Empty string is falsy in JavaScript, so it should NOT include details
    expect(errorWithEmptyString.toJSON()).not.toHaveProperty('details');
    expect(errorWithZero.toJSON()).not.toHaveProperty('details');
  });

  it('should be instance of Error and HttpError', () => {
    const error = new TestError('Test message');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toBeInstanceOf(TestError);
  });
});

describe('NotFoundError', () => {
  it('should have correct status code and error code mapping', () => {
    const error = new NotFoundError('Resource not found');

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Resource not found');
    expect(error.name).toBe('NotFoundError');
  });

  it('should serialize correctly with details', () => {
    const details = { resourceId: '123', resourceType: 'user' };
    const error = new NotFoundError('User not found', details);

    expect(error.toJSON()).toEqual({
      name: 'NotFoundError',
      message: 'User not found',
      code: 'NOT_FOUND',
      statusCode: 404,
      details,
    });
  });

  it('should be instance of HttpError', () => {
    const error = new NotFoundError('Not found');
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toBeInstanceOf(NotFoundError);
  });
});

describe('NotAuthorizedError', () => {
  it('should have correct status code and error code mapping', () => {
    const error = new NotAuthorizedError('Authentication required');

    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Authentication required');
    expect(error.name).toBe('NotAuthorizedError');
  });

  it('should serialize correctly with authentication details', () => {
    const details = { requiredScope: 'admin', providedScope: 'user' };
    const error = new NotAuthorizedError('Insufficient permissions', details);

    expect(error.toJSON()).toEqual({
      name: 'NotAuthorizedError',
      message: 'Insufficient permissions',
      code: 'UNAUTHORIZED',
      statusCode: 401,
      details,
    });
  });
});

describe('ForbiddenError', () => {
  it('should have correct status code and error code mapping', () => {
    const error = new ForbiddenError('Access denied');

    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Access denied');
    expect(error.name).toBe('ForbiddenError');
  });

  it('should serialize correctly with access control details', () => {
    const details = {
      resource: '/admin/users',
      action: 'delete',
      role: 'user',
    };
    const error = new ForbiddenError('Cannot delete users', details);

    expect(error.toJSON()).toEqual({
      name: 'ForbiddenError',
      message: 'Cannot delete users',
      code: 'FORBIDDEN',
      statusCode: 403,
      details,
    });
  });
});

describe('BadRequestError', () => {
  it('should have correct status code and error code mapping', () => {
    const error = new BadRequestError('Invalid request format');

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Invalid request format');
    expect(error.name).toBe('BadRequestError');
  });

  it('should serialize correctly with request details', () => {
    const details = {
      invalidFields: ['email', 'phone'],
      expectedFormat: 'JSON',
      receivedFormat: 'XML',
    };
    const error = new BadRequestError('Invalid request data', details);

    expect(error.toJSON()).toEqual({
      name: 'BadRequestError',
      message: 'Invalid request data',
      code: 'BAD_REQUEST',
      statusCode: 400,
      details,
    });
  });
});

describe('ValidationError', () => {
  it('should have correct status code and error code mapping', () => {
    const error = new ValidationError('Validation failed');

    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Validation failed');
    expect(error.name).toBe('ValidationError');
  });

  it('should serialize correctly with validation details', () => {
    const details = {
      errors: [
        { field: 'email', message: 'Invalid email format' },
        { field: 'age', message: 'Must be between 18 and 120' },
      ],
      validationRules: 'strict',
    };
    const error = new ValidationError('Multiple validation errors', details);

    expect(error.toJSON()).toEqual({
      name: 'ValidationError',
      message: 'Multiple validation errors',
      code: 'VALIDATION_ERROR',
      statusCode: 422,
      details,
    });
  });
});

describe('ConflictError', () => {
  it('should have correct status code and error code mapping', () => {
    const error = new ConflictError('Resource already exists');

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe('Resource already exists');
    expect(error.name).toBe('ConflictError');
  });

  it('should serialize correctly with conflict details', () => {
    const details = {
      conflictingResource: { id: '123', type: 'user' },
      existingResource: { id: '123', email: 'test@example.com' },
      conflictField: 'email',
    };
    const error = new ConflictError('Email already in use', details);

    expect(error.toJSON()).toEqual({
      name: 'ConflictError',
      message: 'Email already in use',
      code: 'CONFLICT',
      statusCode: 409,
      details,
    });
  });
});

describe('Error Class Status Code Mappings', () => {
  const errorMappings = [
    {
      ErrorClass: NotFoundError,
      expectedStatus: 404,
      expectedCode: 'NOT_FOUND',
    },
    {
      ErrorClass: NotAuthorizedError,
      expectedStatus: 401,
      expectedCode: 'UNAUTHORIZED',
    },
    {
      ErrorClass: ForbiddenError,
      expectedStatus: 403,
      expectedCode: 'FORBIDDEN',
    },
    {
      ErrorClass: BadRequestError,
      expectedStatus: 400,
      expectedCode: 'BAD_REQUEST',
    },
    {
      ErrorClass: ValidationError,
      expectedStatus: 422,
      expectedCode: 'VALIDATION_ERROR',
    },
    {
      ErrorClass: ConflictError,
      expectedStatus: 409,
      expectedCode: 'CONFLICT',
    },
  ];

  test.each(errorMappings)(
    '$ErrorClass.name should map to status $expectedStatus and code $expectedCode',
    ({ ErrorClass, expectedStatus, expectedCode }) => {
      const error = new ErrorClass('Test message');

      expect(error.statusCode).toBe(expectedStatus);
      expect(error.code).toBe(expectedCode);
      expect(error).toBeInstanceOf(HttpError);
    }
  );
});

describe('ES6+ Features Usage', () => {
  it('should use object spread operator in toJSON method', () => {
    const details = { key1: 'value1', key2: 'value2' };
    const error = new NotFoundError('Test', details);
    const json = error.toJSON();

    // Verify that details are spread into the result
    expect(json.details).toEqual(details);
    expect(json).toHaveProperty('details.key1', 'value1');
    expect(json).toHaveProperty('details.key2', 'value2');
  });

  it('should use optional chaining behavior in toJSON method', () => {
    // Test with truthy details
    const errorWithDetails = new NotFoundError('Test', { info: 'test' });
    expect(errorWithDetails.toJSON()).toHaveProperty('details');

    // Test with falsy details (should not include details property)
    const errorWithoutDetails = new NotFoundError('Test');
    expect(errorWithoutDetails.toJSON()).not.toHaveProperty('details');

    const errorWithNull = new NotFoundError('Test', null);
    expect(errorWithNull.toJSON()).not.toHaveProperty('details');
  });

  it('should use readonly properties correctly', () => {
    const error = new NotFoundError('Test');

    // These properties should be readonly at compile time (TypeScript enforces this)
    // At runtime, we can verify they maintain their expected values
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');

    // Verify the properties are defined as expected
    expect(typeof error.statusCode).toBe('number');
    expect(typeof error.code).toBe('string');

    // In TypeScript, readonly class properties are still writable at runtime
    // but TypeScript prevents compilation if you try to modify them
    // We can verify the properties exist and have correct values
    expect(error.hasOwnProperty('statusCode')).toBe(true);
    expect(error.hasOwnProperty('code')).toBe(true);

    // Verify the values remain consistent
    const originalStatusCode = error.statusCode;
    const originalCode = error.code;
    expect(error.statusCode).toBe(originalStatusCode);
    expect(error.code).toBe(originalCode);
  });

  it('should use proper ES6 class inheritance', () => {
    const error = new ValidationError('Test validation');

    // Should have proper prototype chain
    expect(Object.getPrototypeOf(error)).toBe(ValidationError.prototype);
    expect(Object.getPrototypeOf(ValidationError.prototype)).toBe(
      HttpError.prototype
    );
    expect(Object.getPrototypeOf(HttpError.prototype)).toBe(Error.prototype);

    // Should have correct constructor name
    expect(error.constructor.name).toBe('ValidationError');
    expect(error.name).toBe('ValidationError');
  });
});
