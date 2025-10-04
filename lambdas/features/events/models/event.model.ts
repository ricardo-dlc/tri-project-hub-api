import { Entity } from 'electrodb';
import { ddbDocClient } from '../../../shared/utils/dynamo';

export const EventEntity = new Entity(
  {
    model: {
      entity: 'event',
      version: '1',
      service: 'events',
    },
    attributes: {
      id: { type: 'string', required: true },
      creatorId: { type: 'string', required: true },
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
      organizer: {
        type: 'map',
        properties: {
          name: { type: 'string', required: true },
          contact: { type: 'string', required: true },
          website: { type: 'string' },
        },
      },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },

      // Flattened keys
      slugDate: {
        type: 'string',
        required: true,
        watch: ['slug', 'date'],
        set: (val, item) => `${item.slug}#${item.date}`,
      },
      creatorDate: {
        type: 'string',
        required: true,
        watch: ['creatorId', 'date'],
        set: (val, item) => `${item.creatorId}#${item.date}`,
      },
      typeDate: {
        type: 'string',
        required: true,
        watch: ['type', 'date'],
        set: (val, item) => `${item.type}#${item.date}`,
      },
      difficultyDate: {
        type: 'string',
        required: true,
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
        pk: { field: 'id', composite: ['id'], casing: 'upper' },
      },
      CreatorIndex: {
        index: 'CreatorIndex',
        pk: { field: 'creatorId', composite: ['creatorId'], casing: 'none' },
        sk: { field: 'date', composite: ['date'] },
      },
      SlugIndex: {
        index: 'SlugIndex',
        pk: { field: 'slug', composite: ['slug'] },
        sk: { field: 'slugDate', composite: ['slugDate'] },
      },
      TypeIndex: {
        index: 'TypeIndex',
        pk: { field: 'type', composite: ['type'] },
        sk: { field: 'typeDate', composite: ['typeDate'] },
      },
      DifficultyIndex: {
        index: 'DifficultyIndex',
        pk: { field: 'difficulty', composite: ['difficulty'] },
        sk: { field: 'difficultyDate', composite: ['difficultyDate'] },
      },
      FeaturedIndex: {
        index: 'FeaturedIndex',
        pk: {
          field: 'featuredStatus',
          composite: ['featuredStatus'],
        },
        sk: {
          field: 'date',
          composite: ['date'],
        },
      },
      EnabledIndex: {
        index: 'EnabledIndex',
        pk: {
          field: 'enabledStatus',
          composite: ['enabledStatus'], // The new attribute
        },
        sk: {
          field: 'date',
          composite: ['date'], // Use date for sorting enabled events
        },
      },
    },
  },
  { client: ddbDocClient, table: process.env.EVENTS_TABLE_NAME }
);
