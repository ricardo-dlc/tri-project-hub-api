/**
 * Drizzle ORM schema definitions for authentication tables
 * Implements PostgreSQL schema with ULID primary keys and proper constraints
 */

import { boolean, index, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { ulid } from 'ulid';

/**
 * Generate ULID for primary keys
 * ULIDs are lexicographically sortable and URL-safe
 */
export const generateId = (): string => ulid();

/**
 * Users table - stores core user information
 * Requirements: 6.4, 6.5 - ULID primary keys and proper constraints
 * Note: Field names must match Better-Auth expectations
 */
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  name: text('name'),
  image: text('image'),
  role: text('role').default('user').notNull(), // 'user', 'organizer', 'admin'
  password: text('password_hash').notNull(), // Better-Auth expects 'password' field name
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ([
  // Indexes for performance
  index('users_email_idx').on(table.email),
  index('users_role_idx').on(table.role),
  index('users_created_at_idx').on(table.createdAt),
]));

/**
 * Accounts table - stores OAuth and external provider account information
 * Requirements: 6.4, 6.5 - ULID primary keys and proper constraints
 */
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'email', 'oauth'
  provider: text('provider').notNull(), // 'credentials', 'google', 'github', etc.
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ([
  // Indexes for performance and uniqueness
  index('accounts_user_id_idx').on(table.userId),
  index('accounts_provider_idx').on(table.provider),
  index('accounts_provider_account_idx').on(table.provider, table.providerAccountId),
]));

/**
 * Sessions table - stores user session information
 * Requirements: 6.4, 6.5 - ULID primary keys and proper constraints
 */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  sessionToken: text('session_token').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ([
  // Indexes for performance
  index('sessions_session_token_idx').on(table.sessionToken),
  index('sessions_user_id_idx').on(table.userId),
  index('sessions_expires_idx').on(table.expires),
]));

/**
 * Verification tokens table - stores email verification and password reset tokens
 * Requirements: 6.4, 6.5 - proper constraints and compound primary key
 */
export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(), // email or user ID
  token: text('token').notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ([
  // Compound primary key as per better-auth requirements
  primaryKey({ columns: [table.identifier, table.token] }),
  // Indexes for performance
  index('verification_tokens_identifier_idx').on(table.identifier),
  index('verification_tokens_expires_idx').on(table.expires),
]));

/**
 * Type definitions inferred from schema
 * These types can be used throughout the application for type safety
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;

/**
 * User role enum for type safety
 */
export type UserRole = 'user' | 'organizer' | 'admin';

/**
 * Sanitized user type (without password hash)
 * Used for API responses and client-side operations
 */
export type SafeUser = Omit<User, 'password'>;

/**
 * Export all tables for use with Drizzle ORM
 */
export const authSchema = {
  users,
  accounts,
  sessions,
  verificationTokens,
};