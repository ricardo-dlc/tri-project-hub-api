/**
 * Authentication and database configuration
 * Centralizes all environment variable handling for the auth system
 */

export interface DatabaseConfig {
  url: string;
  maxConnections: number;
  idleTimeout: number;
  connectTimeout: number;
}

export interface AuthConfig {
  secret: string;
  baseUrl: string;
  frontendUrl: string;
  sessionExpiresIn: number;
  sessionUpdateAge: number;
  passwordMinLength: number;
  passwordMaxLength: number;
}

export interface AppConfig {
  database: DatabaseConfig;
  auth: AuthConfig;
  nodeEnv: string;
  isProduction: boolean;
  isDevelopment: boolean;
}

// Validate required environment variables
const validateEnvVar = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

// Parse integer with default value
const parseIntWithDefault = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Configuration object
export const config: AppConfig = {
  database: {
    url: validateEnvVar('DATABASE_URL', process.env.DATABASE_URL),
    maxConnections: parseIntWithDefault(process.env.DB_MAX_CONNECTIONS, 10),
    idleTimeout: parseIntWithDefault(process.env.DB_IDLE_TIMEOUT, 20),
    connectTimeout: parseIntWithDefault(process.env.DB_CONNECT_TIMEOUT, 10),
  },
  auth: {
    secret: validateEnvVar('BETTER_AUTH_SECRET', process.env.BETTER_AUTH_SECRET),
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    sessionExpiresIn: parseIntWithDefault(process.env.SESSION_EXPIRES_IN, 60 * 60 * 24 * 7), // 7 days
    sessionUpdateAge: parseIntWithDefault(process.env.SESSION_UPDATE_AGE, 60 * 60 * 24), // 1 day
    passwordMinLength: parseIntWithDefault(process.env.PASSWORD_MIN_LENGTH, 8),
    passwordMaxLength: parseIntWithDefault(process.env.PASSWORD_MAX_LENGTH, 128),
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  get isProduction() {
    return this.nodeEnv === 'production';
  },
  get isDevelopment() {
    return this.nodeEnv === 'development';
  },
};

// Export individual configs for convenience
export const { database: databaseConfig, auth: authConfig } = config;