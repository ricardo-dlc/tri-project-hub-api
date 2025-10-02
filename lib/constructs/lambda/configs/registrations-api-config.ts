import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import type { LambdaCreationConfig } from '../../../types/infrastructure';

export const registrationsApiLambdaConfigs: Record<string, LambdaCreationConfig> = {
  createIndividualRegistration: {
    functionName: 'createIndividualRegistration',
    handlerPath: 'createIndividualRegistration.ts',
    route: {
      path: '/events/{eventId}/registrations',
      method: HttpMethod.POST,
      integrationName: 'EventsIndividualRegistrationIntegration',
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
