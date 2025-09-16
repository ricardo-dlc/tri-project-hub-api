import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from './config';
import * as schema from './schema';

// Import postgres using dynamic import to avoid module resolution issues
const postgres = require('postgres');

// Create PostgreSQL client with connection pooling
const client = postgres(config.database.url, {
  max: config.database.maxConnections,
  idle_timeout: config.database.idleTimeout,
  connect_timeout: config.database.connectTimeout,
});

// Initialize Drizzle ORM with PostgreSQL client and schema
export const db = drizzle(client, { schema });

// Export client for direct access if needed
export { client };

// Connection health check function
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

// Graceful shutdown function
export const closeDatabaseConnection = async (): Promise<void> => {
  try {
    await client.end();
    console.log('Database connection closed successfully');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
};