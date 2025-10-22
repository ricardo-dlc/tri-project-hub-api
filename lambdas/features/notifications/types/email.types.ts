/**
 * Email service configuration and template data types
 */

/**
 * Email service configuration interface
 */
export interface EmailServiceConfig {
  mailerooApiKey: string;
  fromEmail: string;
  fromName: string;
  templates: {
    individual: number;
    team: number;
    confirmation: number;
  };
}

/**
 * Email request interface for sending templated emails
 */
export interface EmailRequest {
  to: {
    email: string;
    name?: string;
  };
  subject: string;
  templateId: number;
  templateData: Record<string, any>;
}

/**
 * Template data for individual registration emails
 */
export interface IndividualTemplateData {
  event_name: string;
  event_date: string;
  event_time: string;
  event_location: string;
  participant_id: string;
  participant_name: string;
  payment_amount: string;
  bank_account: string;
  payment_reference: string;
  reservation_id: string;
}

/**
 * Template data for team registration emails
 */
export interface TeamTemplateData {
  event_name: string;
  event_date: string;
  event_time: string;
  event_location: string;
  team_name: string;
  team_id: string;
  team_members_count: number;
  team_members: Array<{
    member_name: string;
    member_discipline: string;
    is_captain: boolean;
  }>;
  payment_amount: string;
  bank_account: string;
  payment_reference: string;
  reservation_id: string;
}

/**
 * Template data for payment confirmation emails
 */
export interface ConfirmationTemplateData {
  event_name: string;
  event_date: string;
  event_time: string;
  event_location: string;
  participant_id: string;
  confirmation_number: string;
  payment_amount: string;
  transfer_reference: string;
  payment_date: string;
}

/**
 * Union type for all template data types
 */
export type TemplateData = IndividualTemplateData | TeamTemplateData | ConfirmationTemplateData;

/**
 * Email processing result interface
 */
export interface EmailProcessingResult {
  success: boolean;
  referenceId?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  retryable: boolean;
}

/**
 * Email log entry interface for logging email operations
 */
export interface EmailLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  messageId: string;
  reservationId: string;
  emailType: string;
  recipient: string;
  action: string;
  result?: {
    success: boolean;
    referenceId?: string;
    error?: string;
  };
  duration?: number;
}
