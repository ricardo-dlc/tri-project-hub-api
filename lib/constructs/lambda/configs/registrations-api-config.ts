import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import type { LambdaCreationConfig } from '../../../types/infrastructure';

export const registrationsApiLambdaConfigs: Record<string, LambdaCreationConfig> = {
  createIndividualRegistration: {
    functionName: 'createRegistration',
    handlerPath: 'createRegistration.ts',
    route: {
      path: '/events/{eventId}/registrations',
      method: HttpMethod.POST,
      integrationName: 'EventsRegistrationIntegration',
    },
    tables: [
      {
        tableName: 'events',
        environmentVariable: 'EVENTS_TABLE_NAME',
        permission: 'readWrite',
      },
    ],
  },
  getParticipantsByEvent: {
    functionName: 'getParticipantsByEvent',
    handlerPath: 'getParticipantsByEvent.ts',
    route: {
      path: '/events/{eventId}/participants',
      method: HttpMethod.GET,
      integrationName: 'EventsParticipantsIntegration',
    },
    tables: [
      {
        tableName: 'events',
        environmentVariable: 'EVENTS_TABLE_NAME',
        permission: 'read',
      },
    ],
    environment: {
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    }
  },
  updatePaymentStatus: {
    functionName: 'updatePaymentStatus',
    handlerPath: 'updatePaymentStatus.ts',
    route: {
      path: '/registrations/{reservationId}/payment',
      method: HttpMethod.PATCH,
      integrationName: 'EventsPaymentIntegration',
    },
    tables: [
      {
        tableName: 'events',
        environmentVariable: 'EVENTS_TABLE_NAME',
        permission: 'readWrite',
      },
    ],
    environment: {
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    }
  },
};
