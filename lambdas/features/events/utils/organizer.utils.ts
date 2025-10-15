import { ClerkUser } from '@/shared/auth/clerk';
import { BadRequestError, ForbiddenError } from '@/shared/errors';
import { isValidOrganizerId } from '@/shared/utils/ulid';
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
 * @returns Sanitized website URL, empty string for clearing, or undefined if not provided
 */
export const sanitizeOrganizerWebsite = (website?: string): string | undefined => {
  if (website === undefined) return undefined;
  if (website === null) return undefined;

  const trimmed = website.trim();
  if (trimmed.length === 0) return ''; // Return empty string to allow clearing

  // Ensure URL has protocol
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
};

/**
 * Sanitize organizer description
 * @param description The description to sanitize
 * @returns Sanitized description, empty string for clearing, or undefined if not provided
 */
export const sanitizeOrganizerDescription = (description?: string): string | undefined => {
  if (description === undefined) return undefined;
  if (description === null) return undefined;

  const trimmed = description.trim();
  return trimmed.length === 0 ? '' : trimmed; // Return empty string to allow clearing
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

/**
 * Validates ownership of an organizer with admin override logic
 * @param organizer - The organizer to validate ownership for
 * @param user - The authenticated user
 * @throws ForbiddenError if user doesn't own the organizer and is not an admin
 */
export const validateOrganizerOwnership = (organizer: OrganizerItem, user: ClerkUser): void => {
  if (user.role !== 'admin' && organizer.clerkId !== user.id) {
    throw new ForbiddenError('You can only modify organizers you created');
  }
};

/**
 * Validates that an organizer ID is provided and has valid format
 * @param organizerId - The organizer ID to validate
 * @throws BadRequestError if organizer ID is invalid
 */
export const validateOrganizerIdFormat = (organizerId: string): void => {
  if (!organizerId || typeof organizerId !== 'string' || organizerId.trim().length === 0) {
    throw new BadRequestError('Organizer ID is required');
  }

  if (!isValidOrganizerId(organizerId)) {
    throw new BadRequestError('Invalid organizer ID format');
  }
};

/**
 * Validates that an organizer exists and is accessible to a user for event operations
 * This is a utility function that can be used by event services to validate organizer references
 * @param organizerId - The organizer ID to validate
 * @param user - The authenticated user
 * @param organizerService - The organizer service instance to use for validation
 * @returns Promise<OrganizerItem> - The validated organizer
 * @throws NotFoundError if organizer doesn't exist or user doesn't have access
 */
export const validateOrganizerForEventOperation = async (
  organizerId: string,
  user: ClerkUser,
  organizerService: { validateOrganizerExists: (organizerId: string, user?: ClerkUser) => Promise<OrganizerItem> }
): Promise<OrganizerItem> => {
  // First validate the format
  validateOrganizerIdFormat(organizerId);

  // Then validate existence and access
  return await organizerService.validateOrganizerExists(organizerId, user);
};
