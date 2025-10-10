import { ClerkUser } from '../../../shared/auth/clerk';
import { BadRequestError, ConflictError, NotFoundError } from '../../../shared/errors';
import { createFeatureLogger } from '../../../shared/logger';
import { generateOrganizerId } from '../../../shared/utils/ulid';
import { EventEntity } from '../models/event.model';
import { OrganizerEntity } from '../models/organizer.model';
import {
  CreateOrganizerData,
  OrganizerItem,
  UpdateOrganizerData,
  validateCreateOrganizerData,
  validateUpdateOrganizerData,
} from '../types/organizer.types';
import {
  isValidClerkId,
  sanitizeCreateOrganizerData,
  sanitizeUpdateOrganizerData,
  validateOrganizerOwnership,
} from '../utils/organizer.utils';

const logger = createFeatureLogger('organizer-service');

export class OrganizerService {

  /**
   * Validates that a Clerk ID is valid and present
   * @param clerkId - The Clerk ID to validate
   * @throws BadRequestError if Clerk ID is invalid
   */
  private validateClerkIdFormat(clerkId: string): void {
    if (!isValidClerkId(clerkId)) {
      throw new BadRequestError('Invalid Clerk ID format', { clerkId });
    }
  }

  /**
   * Creates a new organizer
   * @param data - The organizer creation data
   * @param user - The authenticated user
   * @returns Promise<OrganizerItem> - The created organizer
   * @throws ValidationError if data is invalid
   * @throws ConflictError if organizer already exists for this Clerk ID
   */
  async createOrganizer(data: CreateOrganizerData, user: ClerkUser): Promise<OrganizerItem> {
    logger.debug({ clerkId: user.id, data }, 'Creating organizer');

    // Validate Clerk ID format
    this.validateClerkIdFormat(user.id);

    // Sanitize and validate input data
    const sanitizedData = sanitizeCreateOrganizerData(data);
    validateCreateOrganizerData(sanitizedData);

    // Check if organizer already exists for this Clerk ID
    try {
      const existingOrganizer = await this.getOrganizerByClerkId(user.id);
      if (existingOrganizer) {
        logger.info({ clerkId: user.id, organizerId: existingOrganizer.organizerId }, 'Organizer already exists, returning existing');
        return existingOrganizer;
      }
    } catch (error) {
      // NotFoundError is expected if organizer doesn't exist
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }

    // Generate organizer ID and timestamps
    const organizerId = generateOrganizerId();
    const timestamp = new Date().toISOString();

    try {
      // Create organizer entity
      const result = await OrganizerEntity.create({
        organizerId,
        clerkId: user.id,
        name: sanitizedData.name,
        contact: sanitizedData.contact,
        website: sanitizedData.website,
        description: sanitizedData.description,
        createdAt: timestamp,
        updatedAt: timestamp,
      }).go();

      const createdOrganizer: OrganizerItem = {
        organizerId: result.data.organizerId as string,
        clerkId: result.data.clerkId as string,
        name: result.data.name as string,
        contact: result.data.contact as string,
        website: result.data.website as string | undefined,
        description: result.data.description as string | undefined,
        createdAt: result.data.createdAt as string,
        updatedAt: result.data.updatedAt as string,
      };

      logger.info({ organizerId, clerkId: user.id }, 'Organizer created successfully');
      return createdOrganizer;
    } catch (error) {
      logger.error({ error, clerkId: user.id }, 'Failed to create organizer');
      throw new Error(`Failed to create organizer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Updates an existing organizer
   * @param organizerId - The organizer ID to update
   * @param data - The organizer update data
   * @param user - The authenticated user
   * @returns Promise<OrganizerItem> - The updated organizer
   * @throws NotFoundError if organizer doesn't exist
   * @throws ForbiddenError if user doesn't own the organizer
   * @throws ValidationError if data is invalid
   */
  async updateOrganizer(organizerId: string, data: UpdateOrganizerData, user: ClerkUser): Promise<OrganizerItem> {
    logger.debug({ organizerId, clerkId: user.id, data }, 'Updating organizer');

    // Sanitize and validate input data
    const sanitizedData = sanitizeUpdateOrganizerData(data);
    validateUpdateOrganizerData(sanitizedData);

    // Get existing organizer
    const existingOrganizer = await this.getOrganizer(organizerId);

    // Validate ownership (admin can update any organizer)
    validateOrganizerOwnership(existingOrganizer, user);

    const timestamp = new Date().toISOString();

    try {
      // Build update object with only provided fields
      const updateData: any = {
        updatedAt: timestamp,
      };

      // Track fields to remove (when empty string is provided)
      const fieldsToRemove: ('website' | 'description')[] = [];

      if (sanitizedData.name !== undefined) {
        updateData.name = sanitizedData.name;
      }
      if (sanitizedData.contact !== undefined) {
        updateData.contact = sanitizedData.contact;
      }
      if (sanitizedData.website !== undefined) {
        if (sanitizedData.website === '') {
          // Empty string means remove the field
          fieldsToRemove.push('website');
        } else {
          updateData.website = sanitizedData.website;
        }
      }
      if (sanitizedData.description !== undefined) {
        if (sanitizedData.description === '') {
          // Empty string means remove the field
          fieldsToRemove.push('description');
        } else {
          updateData.description = sanitizedData.description;
        }
      }

      logger.debug({ organizerId, clerkId: user.id, updateData, fieldsToRemove }, 'Update data built');

      // Build the update query
      let updateQuery = OrganizerEntity.update({ organizerId }).set(updateData);

      // Remove fields if needed
      if (fieldsToRemove.length > 0) {
        updateQuery = updateQuery.remove(fieldsToRemove);
      }

      // Execute the update
      const result = await updateQuery.go();

      const updatedOrganizer: OrganizerItem = {
        organizerId: result.data.organizerId as string,
        clerkId: result.data.clerkId as string,
        name: result.data.name as string,
        contact: result.data.contact as string,
        website: result.data.website as string | undefined,
        description: result.data.description as string | undefined,
        createdAt: result.data.createdAt as string,
        updatedAt: result.data.updatedAt as string,
      };

      logger.info({ organizerId, clerkId: user.id }, 'Organizer updated successfully');
      return updatedOrganizer;
    } catch (error) {
      logger.error({ error, organizerId, clerkId: user.id }, 'Failed to update organizer');
      throw new Error(`Failed to update organizer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deletes an organizer
   * @param organizerId - The organizer ID to delete
   * @param user - The authenticated user
   * @throws NotFoundError if organizer doesn't exist
   * @throws ForbiddenError if user doesn't own the organizer
   * @throws ConflictError if organizer has associated events
   */
  async deleteOrganizer(organizerId: string, user: ClerkUser): Promise<void> {
    logger.debug({ organizerId, clerkId: user.id }, 'Deleting organizer');

    // Get existing organizer
    const existingOrganizer = await this.getOrganizer(organizerId);

    // Validate ownership (admin can delete any organizer)
    validateOrganizerOwnership(existingOrganizer, user);

    // Check for event dependencies
    await this.validateNoEventDependencies(organizerId);

    try {
      // Delete organizer entity
      await OrganizerEntity.delete({ organizerId }).go();

      logger.info({ organizerId, clerkId: user.id }, 'Organizer deleted successfully');
    } catch (error) {
      logger.error({ error, organizerId, clerkId: user.id }, 'Failed to delete organizer');
      throw new Error(`Failed to delete organizer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets an organizer by ID
   * @param organizerId - The organizer ID
   * @returns Promise<OrganizerItem> - The organizer
   * @throws NotFoundError if organizer doesn't exist
   */
  async getOrganizer(organizerId: string): Promise<OrganizerItem> {
    logger.debug({ organizerId }, 'Getting organizer by ID');

    try {
      const result = await OrganizerEntity.get({ organizerId }).go();

      if (!result.data) {
        throw new NotFoundError(`Organizer with ID ${organizerId} not found`);
      }

      const organizer: OrganizerItem = {
        organizerId: result.data.organizerId as string,
        clerkId: result.data.clerkId as string,
        name: result.data.name as string,
        contact: result.data.contact as string,
        website: result.data.website as string | undefined,
        description: result.data.description as string | undefined,
        createdAt: result.data.createdAt as string,
        updatedAt: result.data.updatedAt as string,
      };

      logger.debug({ organizerId }, 'Organizer retrieved successfully');
      return organizer;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error({ error, organizerId }, 'Failed to get organizer');
      throw new Error(`Failed to get organizer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets an organizer by Clerk ID
   * @param clerkId - The Clerk user ID
   * @returns Promise<OrganizerItem> - The organizer
   * @throws NotFoundError if organizer doesn't exist
   */
  async getOrganizerByClerkId(clerkId: string): Promise<OrganizerItem> {
    logger.debug({ clerkId }, 'Getting organizer by Clerk ID');

    // Validate Clerk ID format
    this.validateClerkIdFormat(clerkId);

    try {

      logger.debug({
        params: OrganizerEntity.query
          .ClerkIndex({ clerkId }).params(),
      }, "Query")

      const result = await OrganizerEntity.query
        .ClerkIndex({ clerkId })
        .go();

      if (!result.data || result.data.length === 0) {
        throw new NotFoundError(`Organizer with Clerk ID ${clerkId} not found`);
      }

      // Should only be one organizer per Clerk ID
      const organizerData = result.data[0];

      const organizer: OrganizerItem = {
        organizerId: organizerData.organizerId as string,
        clerkId: organizerData.clerkId as string,
        name: organizerData.name as string,
        contact: organizerData.contact as string,
        website: organizerData.website as string | undefined,
        description: organizerData.description as string | undefined,
        createdAt: organizerData.createdAt as string,
        updatedAt: organizerData.updatedAt as string,
      };

      logger.debug({ clerkId, organizerId: organizer.organizerId }, 'Organizer retrieved by Clerk ID successfully');
      return organizer;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error({ error, clerkId }, 'Failed to get organizer by Clerk ID');
      throw new Error(`Failed to get organizer by Clerk ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates that an organizer exists and is accessible to the user
   * @param organizerId - The organizer ID to validate
   * @param user - The authenticated user (optional, for ownership validation)
   * @returns Promise<OrganizerItem> - The organizer if valid
   * @throws NotFoundError if organizer doesn't exist
   * @throws ForbiddenError if user doesn't have access to the organizer (when user is provided)
   */
  async validateOrganizerExists(organizerId: string, user?: ClerkUser): Promise<OrganizerItem> {
    logger.debug({ organizerId, userId: user?.id }, 'Validating organizer exists');

    // Get the organizer (this will throw NotFoundError if it doesn't exist)
    const organizer = await this.getOrganizer(organizerId);

    // If user is provided, validate they have access to this organizer
    if (user) {
      // Admin users can access any organizer
      // Regular users can only access organizers they created
      if (user.role !== 'admin' && organizer.clerkId !== user.id) {
        logger.warn({ organizerId, userId: user.id, organizerClerkId: organizer.clerkId }, 'User does not have access to organizer');
        throw new NotFoundError(`Organizer with ID ${organizerId} not found`); // Don't reveal existence to unauthorized users
      }
    }

    logger.debug({ organizerId, userId: user?.id }, 'Organizer validation successful');
    return organizer;
  }

  /**
   * Validates that an organizer has no associated events
   * @param organizerId - The organizer ID to check
   * @throws ConflictError if organizer has associated events
   */
  private async validateNoEventDependencies(organizerId: string): Promise<void> {
    try {
      logger.debug({ organizerId }, 'Validating no event dependencies for organizer');

      // Query events by organizerId using the OrganizerIndex GSI
      const result = await EventEntity.query
        .OrganizerIndex({ organizerId })
        .go();

      if (result.data && result.data.length > 0) {
        const eventCount = result.data.length;
        const eventTitles = result.data.slice(0, 3).map(event => event.title).join(', ');
        const moreEvents = eventCount > 3 ? ` and ${eventCount - 3} more` : '';

        logger.warn({ organizerId, eventCount, eventTitles }, 'Cannot delete organizer with associated events');
        throw new ConflictError(
          `Cannot delete organizer. ${eventCount} event(s) are associated with this organizer: ${eventTitles}${moreEvents}.`,
          { organizerId, eventCount, events: result.data.map(e => ({ eventId: e.eventId, title: e.title })) }
        );
      }

      logger.debug({ organizerId }, 'No event dependencies found for organizer');
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      logger.error({ error, organizerId }, 'Failed to validate event dependencies');
      throw new Error(`Failed to validate event dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export a singleton instance for use across the application
export const organizerService = new OrganizerService();
