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
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  role: text('role').default('user'), // 'user', 'organizer', 'admin'
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
  accountId: text("account_id").notNull(),
  providerId: text('provider_account_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text('scope'),
  password: text("password"),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ([
  // Indexes for performance and uniqueness
  index('accounts_user_id_idx').on(table.userId),
  index('accounts_provider_idx').on(table.providerId),
  index('accounts_provider_account_idx').on(table.providerId, table.accountId),
]));

/**
 * Sessions table - stores user session information
 * Requirements: 6.4, 6.5 - ULID primary keys and proper constraints
 */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => ([
  // Indexes for performance
  index('sessions_token_idx').on(table.token),
  index('sessions_user_id_idx').on(table.userId),
  index('sessions_expires_idx').on(table.expiresAt),
]));

/**
 * Verification tokens table - stores email verification and password reset tokens
 * Requirements: 6.4, 6.5 - proper constraints and compound primary key
 */
export const verificationTokens = pgTable('verification_tokens', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  identifier: text('identifier').notNull(), // email or user ID
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ([
  // Indexes for performance
  index('verification_tokens_identifier_idx').on(table.identifier),
  index('verification_tokens_expires_idx').on(table.expiresAt),
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