import { getEmailNotificationConfig, validateEmailNotificationConfig, getAllStageConfigurations } from '../lib/constructs/lambda/configs/email-notification-config';
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
      expect(config.fromName).toBe('Tri Project Hub (Dev)');
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
      expect(allConfigs).toHaveProperty('prod');

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

      // Prod should use 2000 range (fallback values)
      expect(allConfigs.prod.individualTemplateId).toBe('2001');
    });
  });
});
