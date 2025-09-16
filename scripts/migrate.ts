#!/usr/bin/env ts-node

/**
 * Database migration runner utility
 * Provides programmatic interface to run Drizzle migrations
 * Requirements: 6.4, 6.5 - Database migration system
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { readdir } from 'fs/promises';
import postgres from 'postgres';

/**
 * Migration runner class
 * Handles database migrations with proper error handling and logging
 */
export class MigrationRunner {
  private client: postgres.Sql;
  private db: ReturnType<typeof drizzle>;
  private migrationsPath: string;

  constructor(connectionString: string, migrationsPath = './drizzle/migrations') {
    this.client = postgres(connectionString, { max: 1 });
    this.db = drizzle(this.client);
    this.migrationsPath = migrationsPath;
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      console.log('🚀 Starting database migrations...');

      await migrate(this.db, {
        migrationsFolder: this.migrationsPath,
        migrationsTable: 'drizzle_migrations',
      });

      console.log('✅ Migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Check migration status
   */
  async getMigrationStatus(): Promise<{
    appliedMigrations: string[];
    pendingMigrations: string[];
  }> {
    try {
      // Get all migration files first
      const migrationFiles = await this.getMigrationFiles();

      // Check if migrations table exists (Drizzle uses 'drizzle' schema)
      const tableExists = await this.client`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'drizzle' 
          AND table_name = 'drizzle_migrations'
        )
      `;

      if (!tableExists[0]?.exists) {
        // No migrations table means no migrations have been applied
        return {
          appliedMigrations: [],
          pendingMigrations: migrationFiles,
        };
      }

      // Get the count of applied migrations from drizzle schema
      const appliedCount = await this.client`
        SELECT COUNT(*) as count FROM drizzle.drizzle_migrations
      `;

      const appliedMigrationsCount = parseInt(appliedCount[0]?.count || '0');

      // For Drizzle's system, we can't easily get the exact migration names
      // but we can determine how many have been applied vs how many files exist
      let appliedMigrations: string[] = [];
      let pendingMigrations: string[] = [];

      if (appliedMigrationsCount === 0) {
        // No migrations applied
        pendingMigrations = migrationFiles;
      } else if (appliedMigrationsCount >= migrationFiles.length) {
        // All migrations applied (or more, which shouldn't happen)
        appliedMigrations = migrationFiles;
        pendingMigrations = [];
      } else {
        // Some migrations applied, some pending
        // This is an approximation since we can't match hashes to filenames easily
        appliedMigrations = migrationFiles.slice(0, appliedMigrationsCount);
        pendingMigrations = migrationFiles.slice(appliedMigrationsCount);
      }

      return {
        appliedMigrations,
        pendingMigrations,
      };
    } catch (error) {
      console.error('❌ Failed to get migration status:', error);
      throw error;
    }
  }

  /**
   * Get list of migration files
   */
  private async getMigrationFiles(): Promise<string[]> {
    try {
      const files = await readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      console.error('❌ Failed to read migration files:', error);
      return [];
    }
  }

  /**
   * Validate database connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.client`SELECT 1`;
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
  }

  /**
   * Ensure migrations table exists (Drizzle will create it automatically)
   */
  async ensureMigrationsTable(): Promise<void> {
    try {
      // Check if migrations table exists in drizzle schema
      const tableExists = await this.client`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'drizzle' 
          AND table_name = 'drizzle_migrations'
        )
      `;

      if (tableExists[0]?.exists) {
        console.log('✅ Migrations table ready');
      } else {
        console.log('ℹ️  Migrations table will be created automatically by Drizzle');
      }
    } catch (error) {
      console.error('❌ Failed to check migrations table:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.client.end();
  }
}

/**
 * CLI interface for running migrations
 */
async function main() {
  const command = process.argv[2];

  // Show help without requiring DATABASE_URL
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(`
Usage: ts-node scripts/migrate.ts <command>

Commands:
  up, migrate    Run all pending migrations
  status         Show migration status

Environment Variables:
  DATABASE_URL   PostgreSQL connection string (required)

Examples:
  ts-node scripts/migrate.ts migrate
  ts-node scripts/migrate.ts status
    `);
    return;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const runner = new MigrationRunner(connectionString);

  try {
    // Validate connection first
    const isConnected = await runner.validateConnection();
    if (!isConnected) {
      process.exit(1);
    }

    // Ensure migrations table exists
    await runner.ensureMigrationsTable();

    switch (command) {
      case 'up':
      case 'migrate':
        await runner.runMigrations();
        break;

      case 'status':
        const status = await runner.getMigrationStatus();
        console.log('\n📊 Migration Status:');
        console.log(`Applied migrations: ${status.appliedMigrations.length}`);
        console.log(`Pending migrations: ${status.pendingMigrations.length}`);

        if (status.appliedMigrations.length > 0) {
          console.log('\n✅ Applied:');
          status.appliedMigrations.forEach(name => console.log(`  - ${name}`));
        }

        if (status.pendingMigrations.length > 0) {
          console.log('\n⏳ Pending:');
          status.pendingMigrations.forEach(name => console.log(`  - ${name}`));
        }
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log(`
Usage: ts-node scripts/migrate.ts <command>

Commands:
  up, migrate    Run all pending migrations
  status         Show migration status

Environment Variables:
  DATABASE_URL   PostgreSQL connection string (required)

Examples:
  ts-node scripts/migrate.ts migrate
  ts-node scripts/migrate.ts status
        `);
        process.exit(1);
        break;
    }
  } catch (error) {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}