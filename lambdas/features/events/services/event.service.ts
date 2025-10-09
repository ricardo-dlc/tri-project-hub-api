import { ClerkUser } from '../../../shared/auth/clerk';
import { BadRequestError, NotFoundError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';
import { PaginationOptions } from '../../../shared/types/common.types';
import { executeWithPagination } from '../../../shared/utils/pagination';
import { generateULID } from '../../../shared/utils/ulid';
import { EventEntity } from '../models/event.model';
import { CreateEventData, EventItem, UpdateEventData } from '../types/event.types';
import {
  validateAndSanitizeAdminOnlyFields,
  validateEventOwnership,
  validateMaxParticipantsReduction,
  validateTeamEventCapacity
} from '../utils/event.utils';
import { generateUniqueSlug } from '../utils/slug.utils';
import { organizerService } from './organizer.service';

// Define the pagination result type locally since it's not exported from the utility
interface PaginatedEventsResult {
  data: EventItem[];
  pagination: {
    hasNextPage: boolean;
    nextToken: string | null;
    limit: number;
    count: number;
  };
}

export class EventService {
  /**
   * Creates a new event with automatic slug generation and organizer injection
   * @param data - Event creation data (organizerId optional - will be auto-injected)
   * @param creatorId - ID of the user creating the event
   * @param user - The authenticated user (for role checking)
   * @returns Promise<EventItem> - The created event
   */
  async createEvent(data: CreateEventData, creatorId: string, user?: ClerkUser): Promise<EventItem> {
    logger.debug({ data, creatorId, userRole: user?.role }, 'Creating new event');

    // Validate team event capacity
    validateTeamEventCapacity(data.isTeamEvent, data.maxParticipants, data.requiredParticipants);

    // Note: isFeatured is always set to false regardless of input data
    // Only admins can modify featured status through updates

    // Determine organizerId - auto-inject if not provided
    let organizerId: string;

    if (data.organizerId) {
      // Explicit organizerId provided - validate it exists and user has access
      logger.debug({ providedOrganizerId: data.organizerId }, 'Using provided organizerId');

      if (user?.role === 'admin') {
        // Admin can use any valid organizer ID
        await organizerService.getOrganizer(data.organizerId);
        organizerId = data.organizerId;
      } else {
        // Regular user - validate they own the organizer
        const organizer = await organizerService.validateOrganizerExists(data.organizerId, user);
        organizerId = organizer.organizerId;
      }
    } else {
      // Auto-inject organizerId by finding user's organizer
      logger.debug({ creatorId }, 'Auto-injecting organizerId for user');

      try {
        const organizer = await organizerService.getOrganizerByClerkId(creatorId);
        organizerId = organizer.organizerId;
        logger.debug({ autoInjectedOrganizerId: organizerId }, 'Successfully auto-injected organizerId');
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new BadRequestError(
            'No organizer profile found for user. Please create an organizer profile first or provide a valid organizerId.',
            { creatorId }
          );
        }
        throw error;
      }
    }

    // Generate unique slug from title
    const slug = await generateUniqueSlug(data.title);

    // Generate event ID
    const eventId = generateULID();
    const now = new Date().toISOString();

    try {
      const result = await EventEntity.create({
        id: eventId, // Primary key field
        eventId,
        creatorId,
        organizerId,
        title: data.title,
        slug, // Generated slug - immutable after creation
        type: data.type,
        date: data.date,
        isFeatured: false, // Always defaults to false - only admins can modify via updates
        isTeamEvent: data.isTeamEvent,
        isRelay: data.isRelay,
        requiredParticipants: data.requiredParticipants,
        maxParticipants: data.maxParticipants,
        currentParticipants: 0, // Always start at 0
        location: data.location,
        description: data.description,
        distance: data.distance,
        registrationFee: data.registrationFee,
        registrationDeadline: data.registrationDeadline,
        image: data.image,
        difficulty: data.difficulty,
        tags: data.tags || [],
        isEnabled: true, // Default to enabled
        createdAt: now,
        updatedAt: now,
      } as any).go();

      logger.info({ eventId, slug, title: data.title }, 'Event created successfully');

      return result.data as EventItem;
    } catch (error) {
      logger.error({ error, eventId }, 'Failed to create event');
      throw error;
    }
  }

  /**
   * Updates an existing event, preventing slug modification
   * @param eventId - ID of the event to update
   * @param data - Event update data
   * @param user - The authenticated user performing the update
   * @returns Promise<EventItem> - The updated event
   */
  async updateEvent(eventId: string, data: UpdateEventData, user: ClerkUser): Promise<EventItem> {
    logger.debug({ eventId, data, userId: user.id, userRole: user.role }, 'Updating event');

    // Get existing event first
    const existingEvent = await this.getEvent(eventId);

    // Validate ownership (admins can update any event)
    validateEventOwnership(existingEvent, user);



    // Validate maxParticipants cannot be lower than current registrations
    if (data.maxParticipants !== undefined) {
      validateMaxParticipantsReduction(data.maxParticipants, existingEvent.currentParticipants);
    }

    // Validate team event capacity if relevant fields are being updated
    // Note: isTeamEvent is immutable, so we only use the existing event's value
    const isTeamEvent = existingEvent.isTeamEvent;
    const maxParticipants = data.maxParticipants !== undefined ? data.maxParticipants : existingEvent.maxParticipants;
    const requiredParticipants = data.requiredParticipants !== undefined ? data.requiredParticipants : existingEvent.requiredParticipants;

    validateTeamEventCapacity(isTeamEvent, maxParticipants, requiredParticipants);

    const now = new Date().toISOString();

    // Prepare update data with timestamp
    const rawUpdateData = {
      ...data,
      updatedAt: now,
    };

    // Sanitize admin-only fields and silently ignored fields for non-admin users
    const adminOnlyFields = ['isFeatured'];
    const silentlyIgnoredFields = ['isTeamEvent', 'eventId', 'creatorId', 'organizerId', 'createdAt', 'currentParticipants', 'slug']; // Fields that are silently removed without error

    let updateData = validateAndSanitizeAdminOnlyFields(rawUpdateData, user, adminOnlyFields);

    // Remove silently ignored fields (like isTeamEvent which is immutable but should be silently ignored)
    silentlyIgnoredFields.forEach(field => {
      if (field in updateData) {
        logger.debug({
          userId: user.id,
          field,
          existingValue: existingEvent[field as keyof EventItem]
        }, `Removing ${field} from update data - field is immutable after creation`);
        delete (updateData as any)[field];
      }
    });

    try {
      const result = await EventEntity.update({ eventId }).set(updateData).go();

      logger.info({ eventId, updatedFields: Object.keys(updateData) }, 'Event updated successfully');

      return result.data as EventItem;
    } catch (error) {
      logger.error({ error, eventId, updateData }, 'Failed to update event');
      throw error;
    }
  }

  /**
   * Gets an event by ID
   * @param eventId - ID of the event to retrieve
   * @returns Promise<EventItem> - The event data
   */
  async getEvent(eventId: string): Promise<EventItem> {
    logger.debug({ eventId }, 'Getting event by ID');

    try {
      const result = await EventEntity.get({ eventId }).go();

      if (!result.data) {
        throw new NotFoundError('Event not found');
      }

      return result.data as EventItem;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error({ error, eventId }, 'Failed to get event');
      throw error;
    }
  }

  /**
   * Gets an event by slug
   * @param slug - Slug of the event to retrieve
   * @returns Promise<EventItem> - The event data
   */
  async getEventBySlug(slug: string): Promise<EventItem> {
    logger.debug({ slug }, 'Getting event by slug');

    try {
      const result = await EventEntity.query.SlugIndex({ slug }).go();

      if (!result.data || result.data.length === 0) {
        throw new NotFoundError('Event not found');
      }

      // Since slugs are unique, there should only be one result
      return result.data[0] as EventItem;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error({ error, slug }, 'Failed to get event by slug');
      throw error;
    }
  }

  /**
   * Lists events by creator ID with pagination
   * @param creatorId - ID of the creator
   * @param pagination - Pagination options
   * @returns Promise with paginated events
   */
  async listEventsByCreator(creatorId: string, pagination?: PaginationOptions): Promise<PaginatedEventsResult> {
    logger.debug({ creatorId, pagination }, 'Listing events by creator');

    try {
      const query = EventEntity.query
        .CreatorIndex({ creatorId })
        .where(({ isEnabled }, { eq }) => eq(isEnabled, true));

      const result = await executeWithPagination<EventItem>(query, {
        limit: pagination?.limit,
        nextToken: pagination?.nextToken,
        defaultLimit: pagination?.defaultLimit || 20,
      });

      logger.debug({ creatorId, count: result.data.length }, 'Events retrieved by creator successfully');
      return result as PaginatedEventsResult;
    } catch (error) {
      logger.error({ error, creatorId }, 'Failed to list events by creator');
      throw error;
    }
  }

  /**
   * Lists events by organizer ID with pagination
   * @param organizerId - ID of the organizer
   * @param pagination - Pagination options
   * @returns Promise with paginated events
   */
  async listEventsByOrganizer(organizerId: string, pagination?: PaginationOptions): Promise<PaginatedEventsResult> {
    logger.debug({ organizerId, pagination }, 'Listing events by organizer');

    try {
      const query = EventEntity.query
        .OrganizerIndex({ organizerId })
        .where(({ isEnabled }, { eq }) => eq(isEnabled, true));

      const result = await executeWithPagination<EventItem>(query, {
        limit: pagination?.limit,
        nextToken: pagination?.nextToken,
        defaultLimit: pagination?.defaultLimit || 20,
      });

      logger.debug({ organizerId, count: result.data.length }, 'Events retrieved by organizer successfully');
      return result as PaginatedEventsResult;
    } catch (error) {
      logger.error({ error, organizerId }, 'Failed to list events by organizer');
      throw error;
    }
  }
}

// Export singleton instance
export const eventService = new EventService();
