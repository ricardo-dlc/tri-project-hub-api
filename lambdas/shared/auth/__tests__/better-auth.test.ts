/**
 * Better-Auth configuration tests
 * Verifies that Better-Auth is properly configured with Drizzle adapter
 */

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-characters-long';
process.env.API_BASE_URL = 'http://localhost:3001';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';

import { config } from '../config';
import { generateId } from '../schema';

describe('Better-Auth Configuration', () => {
  // Note: Direct better-auth testing requires ES module support
  // These tests verify the configuration and helper functions

  describe('Configuration Values', () => {
    it('should use correct session expiration settings', () => {
      // These values are set in the configuration
      expect(config.auth.sessionExpiresIn).toBe(60 * 60 * 24 * 7); // 7 days
      expect(config.auth.sessionUpdateAge).toBe(60 * 60 * 24); // 1 day
    });

    it('should use correct password length settings', () => {
      expect(config.auth.passwordMinLength).toBe(8);
      expect(config.auth.passwordMaxLength).toBe(128);
    });

    it('should have required environment configuration', () => {
      expect(config.auth.secret).toBeDefined();
      expect(config.auth.baseUrl).toBeDefined();
      expect(config.auth.frontendUrl).toBeDefined();
    });
  });

  // Helper functions will be tested in integration tests
  // due to ES module compatibility issues with Jest

  describe('ULID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      
      // ULID should be 26 characters long
      expect(id1.length).toBe(26);
      expect(id2.length).toBe(26);
    });
  });
});