import { ClerkUser } from '../../../shared/auth/clerk';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';
import { generateULID } from '../../../shared/utils/ulid';
import { EventEntity } from '../models/event.model';
import { CreateEventData, EventItem, UpdateEventData } from '../types/event.types';
import { generateUniqueSlug } from '../utils/slug.utils';
import { organizerService } from './organizer.service';

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
    this.validateTeamEventCapacity(data.isTeamEvent, data.maxParticipants, data.requiredParticipants);

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

    // Prevent slug modification
    if ('slug' in data) {
      throw new BadRequestError('Event slug cannot be modified after creation');
    }

    // Get existing event
    const existingEvent = await this.getEvent(eventId);

    // Validate maxParticipants cannot be lower than current registrations
    if (data.maxParticipants !== undefined && data.maxParticipants < existingEvent.currentParticipants) {
      throw new BadRequestError(
        `Cannot reduce maxParticipants (${data.maxParticipants}) below current registrations (${existingEvent.currentParticipants}). ` +
        `Minimum allowed value: ${existingEvent.currentParticipants}`,
        {
          requestedMaxParticipants: data.maxParticipants,
          currentParticipants: existingEvent.currentParticipants,
          minimumAllowed: existingEvent.currentParticipants
        }
      );
    }

    // Validate team event capacity if relevant fields are being updated
    // Note: isTeamEvent is immutable, so we only use the existing event's value
    const isTeamEvent = existingEvent.isTeamEvent;
    const maxParticipants = data.maxParticipants !== undefined ? data.maxParticipants : existingEvent.maxParticipants;
    const requiredParticipants = data.requiredParticipants !== undefined ? data.requiredParticipants : existingEvent.requiredParticipants;

    this.validateTeamEventCapacity(isTeamEvent, maxParticipants, requiredParticipants);

    // Validate ownership (admins can update any event)
    if (user.role !== 'admin' && existingEvent.creatorId !== user.id) {
      throw new ForbiddenError('You can only update events you created');
    }

    const now = new Date().toISOString();

    // Prepare update data, excluding immutable fields
    const updateData = {
      ...data,
      updatedAt: now,
    };

    // Remove any fields that shouldn't be updated
    delete (updateData as any).eventId;
    delete (updateData as any).creatorId;
    delete (updateData as any).slug;
    delete (updateData as any).createdAt;
    delete (updateData as any).currentParticipants; // This should be managed separately

    // Remove isTeamEvent field (immutable after creation)
    if ('isTeamEvent' in updateData) {
      logger.debug({ userId: user.id, existingIsTeamEvent: existingEvent.isTeamEvent }, 'Removing isTeamEvent from update data - field is immutable after creation');
      delete (updateData as any).isTeamEvent;
    }

    // Remove isFeatured field for non-admin users (silently ignore)
    if (user.role !== 'admin' && 'isFeatured' in updateData) {
      logger.debug({ userId: user.id, userRole: user.role }, 'Removing isFeatured from update data - only admins can modify featured status');
      delete (updateData as any).isFeatured;
    }

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
   * Validates team event capacity requirements
   * @param isTeamEvent - Whether the event is a team event
   * @param maxParticipants - Maximum number of participants
   * @param requiredParticipants - Required participants per team
   * @throws BadRequestError if validation fails
   */
  private validateTeamEventCapacity(isTeamEvent: boolean, maxParticipants: number, requiredParticipants: number): void {
    if (isTeamEvent && maxParticipants % requiredParticipants !== 0) {
      const suggestedMax = Math.floor(maxParticipants / requiredParticipants) * requiredParticipants;
      const nextValidMax = suggestedMax + requiredParticipants;

      throw new BadRequestError(
        `For team events, maxParticipants (${maxParticipants}) must be a multiple of requiredParticipants (${requiredParticipants}). ` +
        `Suggested values: ${suggestedMax} or ${nextValidMax}`,
        {
          maxParticipants,
          requiredParticipants,
          suggestedValues: [suggestedMax, nextValidMax],
          availableTeamSlots: Math.floor(maxParticipants / requiredParticipants)
        }
      );
    }
  }
}

// Export singleton instance
export const eventService = new EventService();
