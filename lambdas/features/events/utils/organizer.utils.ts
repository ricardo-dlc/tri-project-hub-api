import { isValidOrganizerId } from '../../../shared/utils/ulid';
import {
  CreateOrganizerData,
  OrganizerItem,
  UpdateOrganizerData,
  validateCreateOrganizerData as validateCreateData,
  validateUpdateOrganizerData as validateUpdateData
} from '../types/organizer.types';

/**
 * Validate Clerk ID format and presence
 * @param clerkId The Clerk user ID to validate
 * @returns True if valid Clerk ID
 */
export const isValidClerkId = (clerkId: string): boolean => {
  return typeof clerkId === 'string' && clerkId.trim().length > 0;
};

/**
 * Re-export validation functions from types for convenience
 */
export const validateCreateOrganizerData = validateCreateData;
export const validateUpdateOrganizerData = validateUpdateData;

/**
 * Validate complete organizer item structure
 * @param organizer The organizer item to validate
 * @returns True if valid organizer structure
 */
export const isValidOrganizerItem = (organizer: any): organizer is OrganizerItem => {
  return (
    typeof organizer === 'object' &&
    organizer !== null &&
    isValidOrganizerId(organizer.organizerId) &&
    isValidClerkId(organizer.clerkId) &&
    typeof organizer.name === 'string' &&
    organizer.name.trim().length > 0 &&
    typeof organizer.contact === 'string' &&
    organizer.contact.trim().length > 0 &&
    typeof organizer.createdAt === 'string' &&
    organizer.createdAt.trim().length > 0 &&
    typeof organizer.updatedAt === 'string' &&
    organizer.updatedAt.trim().length > 0 &&
    (organizer.website === undefined || typeof organizer.website === 'string') &&
    (organizer.description === undefined || typeof organizer.description === 'string')
  );
};

/**
 * Sanitize organizer name by removing extra whitespace and special characters
 * @param name The name to sanitize
 * @returns Sanitized name
 */
export const sanitizeOrganizerName = (name: string): string => {
  return name.trim().replace(/\s+/g, ' ');
};

/**
 * Sanitize organizer contact information
 * @param contact The contact information to sanitize
 * @returns Sanitized contact
 */
export const sanitizeOrganizerContact = (contact: string): string => {
  return contact.trim();
};

/**
 * Sanitize organizer website URL
 * @param website The website URL to sanitize
 * @returns Sanitized website URL or undefined
 */
export const sanitizeOrganizerWebsite = (website?: string): string | undefined => {
  if (!website) return undefined;

  const trimmed = website.trim();
  if (trimmed.length === 0) return undefined;

  // Ensure URL has protocol
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
};

/**
 * Sanitize organizer description
 * @param description The description to sanitize
 * @returns Sanitized description or undefined
 */
export const sanitizeOrganizerDescription = (description?: string): string | undefined => {
  if (!description) return undefined;

  const trimmed = description.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

/**
 * Create a sanitized organizer data object for creation
 * @param data The raw organizer creation data
 * @returns Sanitized organizer creation data
 */
export const sanitizeCreateOrganizerData = (data: CreateOrganizerData): CreateOrganizerData => {
  return {
    name: sanitizeOrganizerName(data.name),
    contact: sanitizeOrganizerContact(data.contact),
    website: sanitizeOrganizerWebsite(data.website),
    description: sanitizeOrganizerDescription(data.description),
  };
};

/**
 * Create a sanitized organizer data object for updates
 * @param data The raw organizer update data
 * @returns Sanitized organizer update data
 */
export const sanitizeUpdateOrganizerData = (data: UpdateOrganizerData): UpdateOrganizerData => {
  const sanitized: UpdateOrganizerData = {};

  if (data.name !== undefined) {
    sanitized.name = sanitizeOrganizerName(data.name);
  }

  if (data.contact !== undefined) {
    sanitized.contact = sanitizeOrganizerContact(data.contact);
  }

  if (data.website !== undefined) {
    sanitized.website = sanitizeOrganizerWebsite(data.website);
  }

  if (data.description !== undefined) {
    sanitized.description = sanitizeOrganizerDescription(data.description);
  }

  return sanitized;
};
