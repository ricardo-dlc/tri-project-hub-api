/**
 * Auth services index
 * Exports all authentication service classes and instances
 */

// Service classes and instances
export { AuthService, authService } from './auth.service';
export { UserService, userService } from './user.service';
export { SessionService, sessionService } from './session.service';

// Error classes from auth service
export {
  AuthenticationError,
  ValidationError as AuthValidationError,
  UserExistsError,
  SessionExpiredError,
} from './auth.service';

// Error classes from user service
export {
  UserNotFoundError,
  UnauthorizedError as UserUnauthorizedError,
  ValidationError as UserValidationError,
} from './user.service';

// Error classes from session service
export {
  SessionNotFoundError,
  SessionExpiredError as SessionServiceExpiredError,
  UnauthorizedError as SessionUnauthorizedError,
  ValidationError as SessionValidationError,
} from './session.service';

// Type exports
export type { PasswordStrengthResult } from './auth.service';
export type { SessionWithUser } from './session.service';