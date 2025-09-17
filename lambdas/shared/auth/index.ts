/**
 * Auth module exports
 * Provides centralized access to authentication and database utilities
 */

export { db, client, checkDatabaseConnection, closeDatabaseConnection } from './database';
export { config, authConfig, databaseConfig } from './config';
export type { DatabaseConfig, AuthConfig, AppConfig } from './config';

// Schema exports
export {
  users,
  accounts,
  sessions,
  verificationTokens,
  authSchema,
  generateId,
} from './schema';

export type {
  User,
  NewUser,
  Account,
  NewAccount,
  Session,
  NewSession,
  VerificationToken,
  NewVerificationToken,
  UserRole,
  SafeUser,
} from './schema';

// Better-Auth configuration and utilities
export {
  auth,
  validateSessionToken,
  extractTokenFromHeader,
  createAuthContext,
  authConfig as betterAuthConfig,
} from './better-auth';

export type { Auth } from './better-auth';

// Migration utilities
export {
  runMigrations,
  checkMigrationsNeeded,
  initializeAuthDatabase,
  validateAuthSchema,
  migrationUtils,
} from './migrations';

export type {
  MigrationConfig,
  MigrationResult,
} from './migrations';