import { Entity } from 'electrodb';
import { ddbDocClient } from '../../../shared/utils/dynamo';
import { isValidULID } from '../../../shared/utils/ulid';

export const ParticipantEntity = new Entity(
  {
    model: {
      entity: 'participant',
      version: '1',
      service: 'registrations',
    },
    attributes: {
      participantId: {
        type: 'string',
        required: true,
        validate: (value: string) => {
          if (!isValidULID(value)) {
            throw new Error('participantId must be a valid ULID format');
          }
          return true;
        }
      },
      reservationId: {
        type: 'string',
        required: true,
        validate: (value: string) => {
          if (!isValidULID(value)) {
            throw new Error('reservationId must be a valid ULID format');
          }
          return true;
        }
      },
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
      email: {
        type: 'string',
        required: true,
        validate: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      },

      // Personal information (required)
      firstName: { type: 'string', required: true },
      lastName: { type: 'string', required: true },

      // Personal information (optional)
      phone: { type: 'string' },
      dateOfBirth: { type: 'string' },
      gender: { type: 'string' },

      // Address information (optional)
      address: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      zipCode: { type: 'string' },
      country: { type: 'string' },

      // Emergency contact (optional)
      emergencyName: { type: 'string' },
      emergencyRelationship: { type: 'string' },
      emergencyPhone: { type: 'string' },
      emergencyEmail: { type: 'string' },

      // Preferences and medical (optional)
      shirtSize: { type: 'string' },
      dietaryRestrictions: { type: 'string' },
      medicalConditions: { type: 'string' },
      medications: { type: 'string' },
      allergies: { type: 'string' },

      // Agreements (required)
      waiver: { type: 'boolean', required: true, default: false },
      newsletter: { type: 'boolean', required: true, default: false },

      // Team-specific (optional)
      role: { type: 'string' },

      // Timestamps
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },

      // GSI attributes for new registration system indexes
      eventParticipantId: {
        type: 'string',
        required: true,
        watch: ['eventId'],
        set: (val, item) => item.eventId,
      },
      participantEmail: {
        type: 'string',
        required: true,
        watch: ['email'],
        set: (val, item) => item.email,
      },
      reservationParticipantId: {
        type: 'string',
        required: true,
        watch: ['reservationId'],
        set: (val, item) => item.reservationId,
      },
      participantSequence: {
        type: 'string',
        required: true,
        watch: ['participantId'],
        set: (val, item) => item.participantId,
      },
    },
    indexes: {
      ParticipantPrimaryIndex: {
        pk: { field: 'id', composite: ['participantId'] },
      },
      EventParticipantIndex: {
        index: 'EventParticipantIndex',
        pk: { field: 'eventParticipantId', composite: ['eventParticipantId'] },
        sk: { field: 'participantEmail', composite: ['participantEmail'] },
      },
      ReservationParticipantIndex: {
        index: 'ReservationParticipantIndex',
        pk: { field: 'reservationParticipantId', composite: ['reservationParticipantId'] },
        sk: { field: 'participantSequence', composite: ['participantSequence'] },
      },
    },
  },
  { client: ddbDocClient, table: process.env.EVENTS_TABLE_NAME }
);

export interface ParticipantItem {
  participantId: string;
  reservationId: string;
  eventId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  emergencyEmail?: string;
  shirtSize?: string;
  dietaryRestrictions?: string;
  medicalConditions?: string;
  medications?: string;
  allergies?: string;
  waiver: boolean;
  newsletter: boolean;
  role?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateParticipantData {
  participantId: string; // ULID format
  reservationId: string; // ULID format
  eventId: string; // ULID format
  email: string;
  firstName: string;
  lastName: string;
  waiver: boolean;
  newsletter: boolean;
  // Optional fields
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  emergencyEmail?: string;
  shirtSize?: string;
  dietaryRestrictions?: string;
  medicalConditions?: string;
  medications?: string;
  allergies?: string;
  role?: string;
}
