import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Environment loader utility for stage-specific configuration
 * Loads environment variables from stage-specific .env files
 */
export class EnvLoader {
  private static loaded = false;
  private static currentStage: string | null = null;

  /**
   * Load environment variables for a specific stage
   * @param stage The deployment stage (dev, prod, etc.)
   */
  static loadForStage(stage: string): void {
    // Avoid loading multiple times for the same stage
    if (this.loaded && this.currentStage === stage) {
      return;
    }

    const normalizedStage = stage.toLowerCase();

    // Try to load stage-specific .env file first
    const stageEnvPath = path.resolve(process.cwd(), `.env.${normalizedStage}`);

    if (fs.existsSync(stageEnvPath)) {
      console.log(`Loading environment variables from .env.${normalizedStage}`);
      dotenv.config({ path: stageEnvPath });
    } else {
      console.warn(`Stage-specific environment file .env.${normalizedStage} not found`);

      // Fallback to default .env file
      const defaultEnvPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(defaultEnvPath)) {
        console.log('Loading environment variables from default .env file');
        dotenv.config({ path: defaultEnvPath });
      } else {
        console.warn('No .env files found, using system environment variables only');
      }
    }

    this.loaded = true;
    this.currentStage = normalizedStage;
  }

  /**
   * Reset the loader state (useful for testing)
   */
  static reset(): void {
    this.loaded = false;
    this.currentStage = null;
  }

  /**
   * Get the currently loaded stage
   */
  static getCurrentStage(): string | null {
    return this.currentStage;
  }

  /**
   * Check if environment variables are loaded
   */
  static isLoaded(): boolean {
    return this.loaded;
  }
}
