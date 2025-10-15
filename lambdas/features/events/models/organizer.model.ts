import { Entity } from 'electrodb';
import { ddbDocClient } from '@/shared/utils/dynamo';
import { isValidULID } from '@/shared/utils/ulid';

export const OrganizerEntity = new Entity(
  {
    model: {
      entity: 'organizer',
      version: '1',
      service: 'events',
    },
    attributes: {
      organizerId: {
        type: 'string',
        required: true,
        validate: (value: string) => {
          if (!isValidULID(value)) {
            throw new Error('organizerId must be a valid ULID format');
          }
          return true;
        },
      },
      clerkId: {
        type: 'string',
        required: true,
        validate: (value: string) => {
          if (!value || typeof value !== 'string' || value.trim().length === 0) {
            throw new Error('clerkId is required and must be a non-empty string');
          }
          return true;
        },
      },
      name: { type: 'string', required: true },
      contact: { type: 'string', required: true },
      website: { type: 'string' },
      description: { type: 'string' },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      OrganizerPrimaryIndex: {
        pk: { field: 'id', composite: ['organizerId'], casing: 'upper' },
      },
      ClerkIndex: {
        index: 'ClerkIndex',
        pk: { field: 'clerkId', composite: ['clerkId'], casing: 'none' },
        sk: { field: 'createdAt', composite: ['createdAt'] },
      },
    },
  },
  { client: ddbDocClient, table: process.env.EVENTS_TABLE_NAME }
);
