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
};
