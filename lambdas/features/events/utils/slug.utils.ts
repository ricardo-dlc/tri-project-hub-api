import { logger } from '@/shared/logger';
import { EventEntity } from '@/features/events/models/event.model';

/**
 * Sanitizes a title to create a URL-friendly slug
 * @param title - The event title to convert to a slug
 * @returns A sanitized slug string
 */
export const sanitizeSlug = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    // Remove special characters except spaces and hyphens
    .replace(/[^a-z0-9\s-]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Replace spaces with hyphens
    .replace(/\s/g, '-')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
};

/**
 * Checks if a slug already exists in the database
 * @param slug - The slug to check for existence
 * @returns Promise<boolean> - True if slug exists, false otherwise
 */
export const slugExists = async (slug: string): Promise<boolean> => {
  try {
    logger.debug({ slug }, 'Checking if slug exists');

    const result = await EventEntity.query
      .SlugIndex({ slug })
      .go();

    const exists = result.data.length > 0;
    logger.debug({ slug, exists }, 'Slug existence check result');

    return exists;
  } catch (error) {
    logger.error({ slug, error }, 'Error checking slug existence');
    throw error;
  }
};

/**
 * Validates that a slug meets the required format
 * @param slug - The slug to validate
 * @returns boolean - True if valid, false otherwise
 */
export const isValidSlug = (slug: string): boolean => {
  // Slug should be lowercase, contain only letters, numbers, and hyphens
  // Should not start or end with hyphens, and should not have consecutive hyphens
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length > 0 && slug.length <= 100;
};

/**
 * Generates a unique slug from a title with collision detection
 * @param title - The event title to generate a slug from
 * @returns Promise<string> - A unique slug
 */
export const generateUniqueSlug = async (title: string): Promise<string> => {
  if (!title || typeof title !== 'string') {
    throw new Error('Title is required and must be a string');
  }

  logger.debug({ title }, 'Generating unique slug');

  // Create base slug from title
  const baseSlug = sanitizeSlug(title);

  if (!baseSlug) {
    throw new Error('Title must contain at least one alphanumeric character');
  }

  // Validate the base slug format
  if (!isValidSlug(baseSlug)) {
    throw new Error('Generated slug does not meet format requirements');
  }

  let uniqueSlug = baseSlug;
  let counter = 1;

  // Check for collisions and append counter if needed
  while (await slugExists(uniqueSlug)) {
    uniqueSlug = `${baseSlug}-${counter}`;
    counter++;

    // Prevent infinite loops with a reasonable limit
    if (counter > 1000) {
      throw new Error('Unable to generate unique slug after 1000 attempts');
    }
  }

  logger.debug({ title, baseSlug, uniqueSlug, attempts: counter }, 'Generated unique slug');

  return uniqueSlug;
};
