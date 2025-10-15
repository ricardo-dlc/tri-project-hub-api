import { Entity } from 'electrodb';
import { ddbDocClient } from '@/shared/utils/dynamo';
import { isValidULID } from '@/shared/utils/ulid';

export const EventEntity = new Entity(
  {
    model: {
      entity: 'event',
      version: '1',
      service: 'events',
    },
    attributes: {
      eventId: {
        type: 'string',
        required: true,
        validate: (value: string) => {
          if (!isValidULID(value)) {
            throw new Error('eventId must be a valid ULID format');
          }
          return true;
        }
      },
      creatorId: { type: 'string', required: true },
      organizerId: {
        type: 'string',
        required: true,
        validate: (value: string) => {
          if (!isValidULID(value)) {
            throw new Error('organizerId must be a valid ULID format');
          }
          return true;
        }
      },
      title: { type: 'string', required: true },
      type: { type: 'string', required: true },
      date: { type: 'string', required: true }, // ISO string
      isFeatured: { type: 'boolean', required: true },
      isTeamEvent: { type: 'boolean', required: true },
      isRelay: { type: 'boolean' },
      requiredParticipants: { type: 'number', required: true },
      location: { type: 'string', required: true },
      description: { type: 'string', required: true },
      distance: { type: 'string', required: true },
      maxParticipants: { type: 'number', required: true },
      currentParticipants: { type: 'number', required: true },
      registrationFee: { type: 'number', required: true },
      registrationDeadline: { type: 'string', required: true },
      image: { type: 'string', required: true },
      difficulty: { type: 'string', required: true },
      tags: { type: 'list', items: { type: 'string' } },
      slug: { type: 'string', required: true },
      isEnabled: { type: 'boolean', required: true, default: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },

      // Flattened keys
      slugDate: {
        type: 'string',
        // required: true,
        watch: ['slug', 'date'],
        set: (val, item) => `${item.slug}#${item.date}`,
      },
      creatorDate: {
        type: 'string',
        // required: true,
        watch: ['creatorId', 'date'],
        set: (val, item) => `${item.creatorId}#${item.date}`,
      },
      organizerDate: {
        type: 'string',
        // required: true,
        watch: ['organizerId', 'date'],
        set: (val, item) => `${item.organizerId}#${item.date}`,
      },
      typeDate: {
        type: 'string',
        // required: true,
        watch: ['type', 'date'],
        set: (val, item) => `${item.type}#${item.date}`,
      },
      difficultyDate: {
        type: 'string',
        // required: true,
        watch: ['difficulty', 'date'],
        set: (val, item) => `${item.difficulty}#${item.date}`,
      },
      featuredStatus: {
        type: 'string',
        // This attribute will only be set if 'isFeatured' is true
        watch: ['isFeatured'],
        set: (val, { isFeatured }) => {
          return isFeatured ? 'featured' : undefined;
        },
      },
      enabledStatus: {
        type: 'string',
        // This attribute will only be set if 'isEnabled' is true
        watch: ['isEnabled'],
        set: (val, { isEnabled }) => {
          return isEnabled ? 'enabled' : undefined;
        },
      },
    },
    indexes: {
      EventPrimaryIndex: {
        pk: { field: 'id', composite: ['eventId'], casing: 'upper' },
      },
      CreatorIndex: {
        index: 'CreatorIndex',
        pk: { field: 'creatorId', composite: ['creatorId'], casing: 'none' },
        sk: { field: 'date', composite: ['date'], casing: 'none' },
      },
      OrganizerIndex: {
        index: 'OrganizerIndex',
        pk: { field: 'organizerId', composite: ['organizerId'], casing: 'none' },
        sk: { field: 'organizerDate', composite: ['organizerDate'], casing: 'none' },
      },
      SlugIndex: {
        index: 'SlugIndex',
        pk: { field: 'slug', composite: ['slug'], casing: 'none' },
        sk: { field: 'slugDate', composite: ['slugDate'], casing: 'none' },
      },
      TypeIndex: {
        index: 'TypeIndex',
        pk: { field: 'type', composite: ['type'], casing: 'none' },
        sk: { field: 'typeDate', composite: ['typeDate'], casing: 'none' },
      },
      DifficultyIndex: {
        index: 'DifficultyIndex',
        pk: { field: 'difficulty', composite: ['difficulty'], casing: 'none' },
        sk: { field: 'difficultyDate', composite: ['difficultyDate'], casing: 'none' },
      },
      FeaturedIndex: {
        index: 'FeaturedIndex',
        pk: {
          field: 'featuredStatus',
          composite: ['featuredStatus'],
          casing: 'none',
        },
        sk: {
          field: 'date',
          composite: ['date'],
          casing: 'none',
        },
      },
      EnabledIndex: {
        index: 'EnabledIndex',
        pk: {
          field: 'enabledStatus',
          composite: ['enabledStatus'], // The new attribute
          casing: 'none',
        },
        sk: {
          field: 'date',
          composite: ['date'], // Use date for sorting enabled events
          casing: 'none',
        },
      },
    },
  },
  { client: ddbDocClient, table: process.env.EVENTS_TABLE_NAME }
);
