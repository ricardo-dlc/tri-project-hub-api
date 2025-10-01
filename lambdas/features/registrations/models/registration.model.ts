import { Entity } from 'electrodb';
import { ddbDocClient } from '../../../shared/utils/dynamo';
import { isValidULID } from '../../../shared/utils/ulid';

export const RegistrationEntity = new Entity(
  {
    model: {
      entity: 'registration',
      version: '1',
      service: 'registrations',
    },
    attributes: {
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
      registrationType: {
        type: 'string',
        required: true,
        validate: /^(individual|team)$/
      },
      paymentStatus: { type: 'boolean', required: true, default: false },
      totalParticipants: { type: 'number', required: true },
      registrationFee: { type: 'number', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },

      // GSI attributes for new registration system indexes
      eventRegistrationId: {
        type: 'string',
        required: true,
        watch: ['eventId'],
        set: (val, item) => item.eventId,
      },
      registrationDate: {
        type: 'string',
        required: true,
        watch: ['createdAt'],
        set: (val, item) => item.createdAt,
      },
      eventPaymentStatus: {
        type: 'string',
        required: true,
        watch: ['eventId', 'paymentStatus'],
        set: (val, item) => `${item.eventId}#${item.paymentStatus}`,
      },
      paymentDate: {
        type: 'string',
        required: true,
        watch: ['createdAt'],
        set: (val, item) => item.createdAt,
      },
    },
    indexes: {
      RegistrationPrimaryIndex: {
        pk: { field: 'id', composite: ['reservationId'] },
      },
      EventRegistrationIndex: {
        index: 'EventRegistrationIndex',
        pk: { field: 'eventRegistrationId', composite: ['eventRegistrationId'] },
        sk: { field: 'registrationDate', composite: ['registrationDate'] },
      },
      PaymentStatusIndex: {
        index: 'PaymentStatusIndex',
        pk: { field: 'eventPaymentStatus', composite: ['eventPaymentStatus'] },
        sk: { field: 'paymentDate', composite: ['paymentDate'] },
      },
    },
  },
  { client: ddbDocClient, table: process.env.EVENTS_TABLE_NAME }
);

export interface RegistrationItem {
  reservationId: string;
  eventId: string;
  registrationType: 'individual' | 'team';
  paymentStatus: boolean;
  totalParticipants: number;
  registrationFee: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegistrationData {
  reservationId: string; // ULID format
  eventId: string; // ULID format
  registrationType: 'individual' | 'team';
  totalParticipants: number;
  registrationFee: number;
}
