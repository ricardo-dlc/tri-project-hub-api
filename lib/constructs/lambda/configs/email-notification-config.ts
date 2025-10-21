import type { StageConfig } from '../../../types/infrastructure';
import { EnvLoader } from './env-loader';

/**
 * Email notification configuration interface
 * 
 * Sender Email Configuration Guidelines:
 * - Use noreply@ addresses to prevent replies to automated emails
 * - Non-production stages include stage identifier (e.g., noreply-dev@, noreply-test@)
 * - Production uses clean noreply@ address without stage identifier
 * - Display names include stage identification for non-production environments
 */
export interface EmailNotificationConfig {
  /** Maileroo API key for sending emails */
  mailerooApiKey: string;
  /** Sender email address */
  fromEmail: string;
  /** Sender display name */
  fromName: string;
  /** Template ID for individual registration emails */
  individualTemplateId: string;
  /** Template ID for team registration emails */
  teamTemplateId: string;
  /** Template ID for payment confirmation emails */
  confirmationTemplateId: string;
}

/**
 * Stage-specific email notification configurations
 * Uses consistent environment variable names across all stages
 * Stage-specific values are loaded via dotenv files (.env.dev, .env.prod, etc.)
 * 
 * Sender Email Configuration:
 * - All stages use noreply@ addresses to prevent replies
 * - Stage-specific prefixes for non-production environments
 * - Consistent display names with stage identification
 */
const stageConfigurations: Record<string, EmailNotificationConfig> = {
  dev: {
    mailerooApiKey: process.env.MAILEROO_API_KEY || '',
    fromEmail: process.env.FROM_EMAIL || 'noreply-dev@triprojecthub.com',
    fromName: process.env.FROM_NAME || 'Tri Project Hub (Development)',
    individualTemplateId: process.env.INDIVIDUAL_TEMPLATE_ID || '1001',
    teamTemplateId: process.env.TEAM_TEMPLATE_ID || '1002',
    confirmationTemplateId: process.env.CONFIRMATION_TEMPLATE_ID || '1003',
  },
  test: {
    mailerooApiKey: process.env.MAILEROO_API_KEY || '',
    fromEmail: process.env.FROM_EMAIL || 'noreply-test@triprojecthub.com',
    fromName: process.env.FROM_NAME || 'Tri Project Hub (Test)',
    individualTemplateId: process.env.INDIVIDUAL_TEMPLATE_ID || '1101',
    teamTemplateId: process.env.TEAM_TEMPLATE_ID || '1102',
    confirmationTemplateId: process.env.CONFIRMATION_TEMPLATE_ID || '1103',
  },
  staging: {
    mailerooApiKey: process.env.MAILEROO_API_KEY || '',
    fromEmail: process.env.FROM_EMAIL || 'noreply-staging@triprojecthub.com',
    fromName: process.env.FROM_NAME || 'Tri Project Hub (Staging)',
    individualTemplateId: process.env.INDIVIDUAL_TEMPLATE_ID || '1201',
    teamTemplateId: process.env.TEAM_TEMPLATE_ID || '1202',
    confirmationTemplateId: process.env.CONFIRMATION_TEMPLATE_ID || '1203',
  },
  prod: {
    mailerooApiKey: process.env.MAILEROO_API_KEY || '',
    fromEmail: process.env.FROM_EMAIL || 'noreply@triprojecthub.com',
    fromName: process.env.FROM_NAME || 'Tri Project Hub',
    individualTemplateId: process.env.INDIVIDUAL_TEMPLATE_ID || '2001',
    teamTemplateId: process.env.TEAM_TEMPLATE_ID || '2002',
    confirmationTemplateId: process.env.CONFIRMATION_TEMPLATE_ID || '2003',
  },
  production: {
    mailerooApiKey: process.env.MAILEROO_API_KEY || '',
    fromEmail: process.env.FROM_EMAIL || 'noreply@triprojecthub.com',
    fromName: process.env.FROM_NAME || 'Tri Project Hub',
    individualTemplateId: process.env.INDIVIDUAL_TEMPLATE_ID || '2001',
    teamTemplateId: process.env.TEAM_TEMPLATE_ID || '2002',
    confirmationTemplateId: process.env.CONFIRMATION_TEMPLATE_ID || '2003',
  },
};

/**
 * Get email notification configuration for a specific stage
 * @param stageConfig Stage configuration containing stage name
 * @returns Email notification configuration for the stage
 * @throws Error if stage is not supported
 */
export function getEmailNotificationConfig(stageConfig: StageConfig): EmailNotificationConfig {
  const stageName = stageConfig.stageName.toLowerCase();

  // Load environment variables for the specific stage
  EnvLoader.loadForStage(stageName);

  // Check if we have a specific configuration for this stage
  if (stageName in stageConfigurations) {
    return stageConfigurations[stageName];
  }

  // For unknown stages, use dev configuration as fallback
  console.warn(
    `No email notification configuration found for stage '${stageName}'. Using dev configuration as fallback.`
  );

  // Load dev environment variables for fallback
  EnvLoader.loadForStage('dev');
  return stageConfigurations.dev;
}

/**
 * Validate email notification configuration
 * @param config Email notification configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateEmailNotificationConfig(config: EmailNotificationConfig): void {
  const requiredFields: (keyof EmailNotificationConfig)[] = [
    'mailerooApiKey',
    'fromEmail',
    'fromName',
    'individualTemplateId',
    'teamTemplateId',
    'confirmationTemplateId'
  ];

  const missingFields = requiredFields.filter(field =>
    !config[field] || config[field].trim() === ''
  );

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required email notification configuration fields: ${missingFields.join(', ')}`
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(config.fromEmail)) {
    throw new Error(`Invalid email format for fromEmail: ${config.fromEmail}`);
  }

  // Validate that sender email follows noreply pattern for automated emails
  if (!config.fromEmail.toLowerCase().startsWith('noreply')) {
    console.warn(
      `Warning: Sender email '${config.fromEmail}' does not follow noreply pattern. ` +
      'Consider using noreply@ addresses for automated emails to prevent replies.'
    );
  }

  // Validate template IDs are numeric strings
  const templateIds = [
    config.individualTemplateId,
    config.teamTemplateId,
    config.confirmationTemplateId
  ];

  templateIds.forEach((templateId, index) => {
    const templateNames = ['individualTemplateId', 'teamTemplateId', 'confirmationTemplateId'];
    if (isNaN(parseInt(templateId, 10))) {
      throw new Error(`${templateNames[index]} must be a valid number: ${templateId}`);
    }
  });
}

/**
 * Get sender configuration for a specific stage
 * @param stageName Stage name to get sender configuration for
 * @returns Sender email configuration
 */
export function getSenderConfig(stageName: string): { fromEmail: string; fromName: string } {
  const normalizedStage = stageName.toLowerCase();

  if (normalizedStage in stageConfigurations) {
    const config = stageConfigurations[normalizedStage];
    return {
      fromEmail: config.fromEmail,
      fromName: config.fromName
    };
  }

  // Return dev configuration as fallback
  console.warn(
    `No sender configuration found for stage '${stageName}'. Using dev configuration as fallback.`
  );

  return {
    fromEmail: stageConfigurations.dev.fromEmail,
    fromName: stageConfigurations.dev.fromName
  };
}

/**
 * Get all available stage configurations for debugging
 * @returns Record of all stage configurations
 */
export function getAllStageConfigurations(): Record<string, EmailNotificationConfig> {
  return { ...stageConfigurations };
}
