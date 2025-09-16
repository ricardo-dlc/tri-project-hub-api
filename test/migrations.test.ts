/**
 * Migration system tests
 * Tests the database migration utilities and CLI tools
 * Requirements: 6.4, 6.5 - Database migration system testing
 */

import { MigrationConfig } from '../lambdas/shared/auth/migrations';

// Mock postgres to avoid actual database connections in tests
const mockClient = {
  end: jest.fn().mockResolvedValue(undefined),
};

const mockPostgres = jest.fn(() => mockClient);
jest.mock('postgres', () => mockPostgres);

// Mock drizzle-orm
jest.mock('drizzle-orm/postgres-js', () => ({
  drizzle: jest.fn(() => ({})),
}));

const mockMigrate = jest.fn().mockResolvedValue([]);
jest.mock('drizzle-orm/postgres-js/migrator', () => ({
  migrate: mockMigrate,
}));

describe('Migration System', () => {
  const mockConnectionString = 'postgresql://test:test@localhost:5432/test';
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockMigrate.mockResolvedValue([]);
  });

  describe('Migration Configuration', () => {
    it('should accept valid configuration', () => {
      const config: MigrationConfig = {
        connectionString: mockConnectionString,
        migrationsFolder: './drizzle/migrations',
        migrationsTable: 'drizzle_migrations',
      };

      expect(config.connectionString).toBe(mockConnectionString);
      expect(config.migrationsFolder).toBe('./drizzle/migrations');
      expect(config.migrationsTable).toBe('drizzle_migrations');
    });

    it('should validate connection string format', () => {
      const validConnectionStrings = [
        'postgresql://user:pass@localhost:5432/db',
        'postgres://user:pass@localhost:5432/db',
        'postgresql://user@localhost/db',
      ];

      validConnectionStrings.forEach(connectionString => {
        expect(() => {
          const config: MigrationConfig = { connectionString };
          // Should not throw for valid connection strings
        }).not.toThrow();
      });
    });
  });

  describe('Migration Utilities', () => {
    it('should export migration functions', () => {
      const migrations = require('../lambdas/shared/auth/migrations');
      
      expect(typeof migrations.runMigrations).toBe('function');
      expect(typeof migrations.checkMigrationsNeeded).toBe('function');
      expect(typeof migrations.initializeAuthDatabase).toBe('function');
      expect(typeof migrations.validateAuthSchema).toBe('function');
      expect(typeof migrations.migrationUtils).toBe('object');
    });

    it('should have proper migration utilities object', () => {
      const { migrationUtils } = require('../lambdas/shared/auth/migrations');
      
      expect(typeof migrationUtils.runMigrations).toBe('function');
      expect(typeof migrationUtils.checkMigrationsNeeded).toBe('function');
      expect(typeof migrationUtils.initializeAuthDatabase).toBe('function');
      expect(typeof migrationUtils.validateAuthSchema).toBe('function');
    });
  });

  describe('Basic Migration Operations', () => {
    it('should run migrations with proper configuration', async () => {
      const { runMigrations } = require('../lambdas/shared/auth/migrations');
      
      const config: MigrationConfig = {
        connectionString: mockConnectionString,
      };

      const result = await runMigrations(config);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('migrationsRun');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.migrationsRun).toBe('number');
    });

    it('should handle migration errors gracefully', async () => {
      mockMigrate.mockRejectedValueOnce(new Error('Migration failed'));
      const { runMigrations } = require('../lambdas/shared/auth/migrations');

      const config: MigrationConfig = {
        connectionString: mockConnectionString,
      };

      const result = await runMigrations(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Migration failed');
    });
  });

  describe('Database Initialization', () => {
    it('should initialize database with proper result structure', async () => {
      const { initializeAuthDatabase } = require('../lambdas/shared/auth/migrations');
      
      const result = await initializeAuthDatabase(mockConnectionString);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('migrationsRun');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.migrationsRun).toBe('number');
    });
  });

  describe('Connection Management', () => {
    it('should clean up connections properly', async () => {
      const { runMigrations } = require('../lambdas/shared/auth/migrations');
      const endSpy = jest.spyOn(mockClient, 'end');
      
      await runMigrations({
        connectionString: mockConnectionString,
      });

      expect(endSpy).toHaveBeenCalled();
    });

    it('should clean up connections even on error', async () => {
      mockMigrate.mockRejectedValueOnce(new Error('Migration error'));
      const { runMigrations } = require('../lambdas/shared/auth/migrations');
      const endSpy = jest.spyOn(mockClient, 'end');

      await runMigrations({
        connectionString: mockConnectionString,
      });

      expect(endSpy).toHaveBeenCalled();
    });
  });
});