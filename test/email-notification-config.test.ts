import { getEmailNotificationConfig, validateEmailNotificationConfig, getAllStageConfigurations, getSenderConfig } from '../lib/constructs/lambda/configs/email-notification-config';
import { EnvLoader } from '../lib/constructs/lambda/configs/env-loader';
import type { StageConfig } from '../lib/types/infrastructure';

describe('Email Notification Configuration', () => {
  // Mock stage configurations for testing
  const createMockStageConfig = (stageName: string): StageConfig => ({
    stageName,
    isProduction: stageName === 'prod' || stageName === 'production',
    resourcePrefix: `tri-project-hub-${stageName}`,
    tableName: `tri-project-hub-${stageName}-events`,
    apiName: `tri-project-hub-${stageName}-api`,
  });

  beforeEach(() => {
    // Reset environment loader before each test
    EnvLoader.reset();
    // Clear any existing environment variables
    delete process.env.MAILEROO_API_KEY;
    delete process.env.FROM_EMAIL;
    delete process.env.FROM_NAME;
    delete process.env.INDIVIDUAL_TEMPLATE_ID;
    delete process.env.TEAM_TEMPLATE_ID;
    delete process.env.CONFIRMATION_TEMPLATE_ID;
  });

  describe('getEmailNotificationConfig', () => {
    it('should return dev configuration for dev stage', () => {
      const stageConfig = createMockStageConfig('dev');
      const config = getEmailNotificationConfig(stageConfig);

      // Should use fallback values when no env file exists
      expect(config.individualTemplateId).toBe('1001');
      expect(config.teamTemplateId).toBe('1002');
      expect(config.confirmationTemplateId).toBe('1003');
      expect(config.fromEmail).toBe('noreply-dev@triprojecthub.com');
      expect(config.fromName).toBe('Tri Project Hub (Development)');
    });

    it('should return prod configuration for prod stage', () => {
      const stageConfig = createMockStageConfig('prod');
      const config = getEmailNotificationConfig(stageConfig);

      // Should use fallback values when no env file exists
      expect(config.individualTemplateId).toBe('2001');
      expect(config.teamTemplateId).toBe('2002');
      expect(config.confirmationTemplateId).toBe('2003');
      expect(config.fromEmail).toBe('noreply@triprojecthub.com');
      expect(config.fromName).toBe('Tri Project Hub');
    });

    it('should load environment variables for unknown stages', () => {
      // Create a mock stage config for a non-existent stage
      const stageConfig = createMockStageConfig('unknown-stage');
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const config = getEmailNotificationConfig(stageConfig);

      // Should fallback to dev configuration
      expect(config.individualTemplateId).toBe('1001');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No email notification configuration found for stage 'unknown-stage'")
      );

      consoleSpy.mockRestore();
    });

    it('should fallback to dev configuration for unknown stage', () => {
      const stageConfig = createMockStageConfig('unknown');
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const config = getEmailNotificationConfig(stageConfig);

      expect(config.individualTemplateId).toBe('1001');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No email notification configuration found for stage 'unknown'")
      );

      consoleSpy.mockRestore();
    });
  });

  describe('validateEmailNotificationConfig', () => {
    const validConfig = {
      mailerooApiKey: 'test-api-key',
      fromEmail: 'test@example.com',
      fromName: 'Test Sender',
      individualTemplateId: '1001',
      teamTemplateId: '1002',
      confirmationTemplateId: '1003',
    };

    it('should pass validation for valid configuration', () => {
      expect(() => validateEmailNotificationConfig(validConfig)).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const invalidConfig = { ...validConfig, mailerooApiKey: '' };

      expect(() => validateEmailNotificationConfig(invalidConfig)).toThrow(
        'Missing required email notification configuration fields: mailerooApiKey'
      );
    });

    it('should throw error for invalid email format', () => {
      const invalidConfig = { ...validConfig, fromEmail: 'invalid-email' };

      expect(() => validateEmailNotificationConfig(invalidConfig)).toThrow(
        'Invalid email format for fromEmail: invalid-email'
      );
    });

    it('should throw error for non-numeric template IDs', () => {
      const invalidConfig = { ...validConfig, individualTemplateId: 'not-a-number' };

      expect(() => validateEmailNotificationConfig(invalidConfig)).toThrow(
        'individualTemplateId must be a valid number: not-a-number'
      );
    });

    it('should accept numeric string template IDs', () => {
      const configWithNumericStrings = {
        ...validConfig,
        individualTemplateId: '123',
        teamTemplateId: '456',
        confirmationTemplateId: '789',
      };

      expect(() => validateEmailNotificationConfig(configWithNumericStrings)).not.toThrow();
    });
  });

  describe('getAllStageConfigurations', () => {
    it('should return all stage configurations', () => {
      const allConfigs = getAllStageConfigurations();

      expect(allConfigs).toHaveProperty('dev');
      expect(allConfigs).toHaveProperty('test');
      expect(allConfigs).toHaveProperty('staging');
      expect(allConfigs).toHaveProperty('prod');
      expect(allConfigs).toHaveProperty('production');

      // Verify each config has required properties
      Object.values(allConfigs).forEach(config => {
        expect(config).toHaveProperty('mailerooApiKey');
        expect(config).toHaveProperty('fromEmail');
        expect(config).toHaveProperty('fromName');
        expect(config).toHaveProperty('individualTemplateId');
        expect(config).toHaveProperty('teamTemplateId');
        expect(config).toHaveProperty('confirmationTemplateId');
      });
    });

    it('should have different template IDs for different stages', () => {
      const allConfigs = getAllStageConfigurations();

      // Dev should use 1000 range (fallback values)
      expect(allConfigs.dev.individualTemplateId).toBe('1001');

      // Test should use 1100 range
      expect(allConfigs.test.individualTemplateId).toBe('1101');

      // Staging should use 1200 range
      expect(allConfigs.staging.individualTemplateId).toBe('1201');

      // Prod should use 2000 range (fallback values)
      expect(allConfigs.prod.individualTemplateId).toBe('2001');
      expect(allConfigs.production.individualTemplateId).toBe('2001');
    });

    it('should use noreply email addresses for all stages', () => {
      const allConfigs = getAllStageConfigurations();

      Object.entries(allConfigs).forEach(([stage, config]) => {
        expect(config.fromEmail).toMatch(/^noreply/);
        
        // Non-production stages should have stage identifier
        if (stage !== 'prod' && stage !== 'production') {
          expect(config.fromEmail).toContain(`-${stage}@`);
        } else {
          // Production stages should use clean noreply address
          expect(config.fromEmail).toBe('noreply@triprojecthub.com');
        }
      });
    });
  });

  describe('getSenderConfig', () => {
    it('should return correct sender config for each stage', () => {
      const devSender = getSenderConfig('dev');
      expect(devSender.fromEmail).toBe('noreply-dev@triprojecthub.com');
      expect(devSender.fromName).toBe('Tri Project Hub (Development)');

      const testSender = getSenderConfig('test');
      expect(testSender.fromEmail).toBe('noreply-test@triprojecthub.com');
      expect(testSender.fromName).toBe('Tri Project Hub (Test)');

      const stagingSender = getSenderConfig('staging');
      expect(stagingSender.fromEmail).toBe('noreply-staging@triprojecthub.com');
      expect(stagingSender.fromName).toBe('Tri Project Hub (Staging)');

      const prodSender = getSenderConfig('prod');
      expect(prodSender.fromEmail).toBe('noreply@triprojecthub.com');
      expect(prodSender.fromName).toBe('Tri Project Hub');
    });

    it('should fallback to dev config for unknown stage', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const unknownSender = getSenderConfig('unknown');
      expect(unknownSender.fromEmail).toBe('noreply-dev@triprojecthub.com');
      expect(unknownSender.fromName).toBe('Tri Project Hub (Development)');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No sender configuration found for stage 'unknown'")
      );

      consoleSpy.mockRestore();
    });

    it('should handle case-insensitive stage names', () => {
      const upperCaseSender = getSenderConfig('PROD');
      expect(upperCaseSender.fromEmail).toBe('noreply@triprojecthub.com');
      expect(upperCaseSender.fromName).toBe('Tri Project Hub');
    });
  });

  describe('validateEmailNotificationConfig', () => {
    const validConfig = {
      mailerooApiKey: 'test-api-key',
      fromEmail: 'noreply@example.com',
      fromName: 'Test Sender',
      individualTemplateId: '1001',
      teamTemplateId: '1002',
      confirmationTemplateId: '1003',
    };

    it('should warn for non-noreply email addresses', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const configWithRegularEmail = { ...validConfig, fromEmail: 'support@example.com' };

      validateEmailNotificationConfig(configWithRegularEmail);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("does not follow noreply pattern")
      );

      consoleSpy.mockRestore();
    });

    it('should not warn for noreply email addresses', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      validateEmailNotificationConfig(validConfig);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
