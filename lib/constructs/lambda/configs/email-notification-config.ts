import type { StageConfig } from '../../../types/infrastructure';
import { EnvLoader } from './env-loader';

/**
 * Email notification configuration interface
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
 */
const stageConfigurations: Record<string, EmailNotificationConfig> = {
  dev: {
    mailerooApiKey: process.env.MAILEROO_API_KEY || '',
    fromEmail: process.env.FROM_EMAIL || 'noreply-dev@triprojecthub.com',
    fromName: process.env.FROM_NAME || 'Tri Project Hub (Dev)',
    individualTemplateId: process.env.INDIVIDUAL_TEMPLATE_ID || '1001',
    teamTemplateId: process.env.TEAM_TEMPLATE_ID || '1002',
    confirmationTemplateId: process.env.CONFIRMATION_TEMPLATE_ID || '1003',
  },
  prod: {
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
 * Get all available stage configurations for debugging
 * @returns Record of all stage configurations
 */
export function getAllStageConfigurations(): Record<string, EmailNotificationConfig> {
  return { ...stageConfigurations };
}
