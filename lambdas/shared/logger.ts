import pino from 'pino';

/**
 * Creates a configured pino logger instance for Lambda functions
 *
 * Features:
 * - Structured JSON logging
 * - Appropriate log levels based on environment
 * - Request context binding support
 * - Performance optimized for Lambda cold starts
 */
const createLogger = () => {
  const env = process.env.NODE_ENV || 'development';
  const isTest = env === 'test';
  const isDevelopment = env !== 'production' && !isTest;

  return pino({
    level: isTest
      ? 'silent'
      : process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: 'tri-project-hub-api',
      environment: process.env.STAGE || 'dev',
    },
  });
};


// Singleton logger instance
export const logger = createLogger();

/**
 * Creates a child logger with request context
 * Use this to add request-specific information to all logs
 *
 * @example
 * const reqLogger = createRequestLogger({
 *   requestId: context.awsRequestId,
 *   path: event.rawPath,
 *   method: event.requestContext.http.method
 * });
 * reqLogger.info('Processing request');
 */
export const createRequestLogger = (context: {
  requestId?: string;
  path?: string;
  method?: string;
  [key: string]: any;
}) => {
  return logger.child(context);
};

/**
 * Creates a child logger for a specific feature/module
 * Use this to namespace logs by feature area
 *
 * @example
 * const eventLogger = createFeatureLogger('events');
 * eventLogger.info('Fetching events');
 */
export const createFeatureLogger = (feature: string) => {
  return logger.child({ feature });
};

export default logger;
