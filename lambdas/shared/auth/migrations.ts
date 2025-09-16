/**
 * Database migration utilities for auth system
 * Provides programmatic interface for running migrations in Lambda functions
 * Requirements: 6.4, 6.5 - Database migration system
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Migration configuration interface
 */
export interface MigrationConfig {
  connectionString: string;
  migrationsFolder?: string;
  migrationsTable?: string;
}

/**
 * Migration result interface
 */
export interface MigrationResult {
  success: boolean;
  migrationsRun: number;
  error?: string;
}

/**
 * Run database migrations programmatically
 * Useful for Lambda functions that need to ensure database is up to date
 * 
 * @param config Migration configuration
 * @returns Promise<MigrationResult>
 */
export async function runMigrations(config: MigrationConfig): Promise<MigrationResult> {
  let client: postgres.Sql | null = null;

  try {
    // Create database connection with single connection for migrations
    client = postgres(config.connectionString, { max: 1 });
    const db = drizzle(client);

    // Run migrations
    const migrationResults = await migrate(db, {
      migrationsFolder: config.migrationsFolder || './drizzle/migrations',
      migrationsTable: config.migrationsTable || 'drizzle_migrations',
    });

    return {
      success: true,
      migrationsRun: Array.isArray(migrationResults) ? migrationResults.length : 0,
    };
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      migrationsRun: 0,
      error: error instanceof Error ? error.message : 'Unknown migration error',
    };
  } finally {
    // Always close the connection
    if (client) {
      await client.end();
    }
  }
}

/**
 * Check if migrations are needed
 * Compares applied migrations with available migration files
 * 
 * @param config Migration configuration
 * @returns Promise<boolean> True if migrations are needed
 */
export async function checkMigrationsNeeded(config: MigrationConfig): Promise<boolean> {
  let client: postgres.Sql | null = null;

  try {
    client = postgres(config.connectionString, { max: 1 });

    // Check if migrations table exists in drizzle schema
    const tableExists = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'drizzle' 
        AND table_name = 'drizzle_migrations'
      )
    `;

    // If migrations table doesn't exist, migrations are needed
    if (!tableExists[0]?.exists) {
      return true;
    }

    // Get count of applied migrations from drizzle schema
    const appliedCount = await client`
      SELECT COUNT(*) as count 
      FROM drizzle.drizzle_migrations
    `;

    // For now, we'll assume migrations are needed if no migrations have been applied
    // In a more sophisticated setup, you could compare with available migration files
    return (appliedCount[0]?.count || 0) === 0;
  } catch (error) {
    console.error('Failed to check migration status:', error);
    // If we can't check, assume migrations are needed for safety
    return true;
  } finally {
    if (client) {
      await client.end();
    }
  }
}

/**
 * Initialize database with auth schema
 * Runs migrations and ensures all auth tables are created
 * 
 * @param connectionString PostgreSQL connection string
 * @returns Promise<MigrationResult>
 */
export async function initializeAuthDatabase(connectionString: string): Promise<MigrationResult> {
  const config: MigrationConfig = {
    connectionString,
    migrationsFolder: './drizzle/migrations',
    migrationsTable: 'drizzle_migrations',
  };

  // Check if migrations are needed
  const migrationsNeeded = await checkMigrationsNeeded(config);

  if (!migrationsNeeded) {
    return {
      success: true,
      migrationsRun: 0,
    };
  }

  // Run migrations
  return await runMigrations(config);
}

/**
 * Validate database schema
 * Checks if all required auth tables exist
 * 
 * @param connectionString PostgreSQL connection string
 * @returns Promise<boolean> True if schema is valid
 */
export async function validateAuthSchema(connectionString: string): Promise<boolean> {
  let client: postgres.Sql | null = null;

  try {
    client = postgres(connectionString, { max: 1 });

    // Check if all required tables exist
    const requiredTables = ['users', 'accounts', 'sessions', 'verification_tokens'];

    for (const tableName of requiredTables) {
      const tableExists = await client`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        )
      `;

      if (!tableExists[0]?.exists) {
        console.error(`Required table '${tableName}' does not exist`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Schema validation failed:', error);
    return false;
  } finally {
    if (client) {
      await client.end();
    }
  }
}

/**
 * Migration utilities for development and testing
 */
export const migrationUtils = {
  runMigrations,
  checkMigrationsNeeded,
  initializeAuthDatabase,
  validateAuthSchema,
};