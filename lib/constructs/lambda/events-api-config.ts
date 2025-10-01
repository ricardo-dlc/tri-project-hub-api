import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { LambdaCreationConfig } from '../../types/infrastructure';


export const eventsApiLambdaConfigs: Record<string, LambdaCreationConfig> = {
  getEvents: {
    functionName: 'getEvents',
    handlerPath: 'getEvents.ts',
    route: {
      path: '/events',
      method: HttpMethod.GET,
      integrationName: 'EventsIntegration',
    },
    tables: [
      {
        tableName: 'events',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
  },
  getEventsByCreatorId: {
    functionName: 'getEventsByCreatorId',
    handlerPath: 'getEventsByCreatorId.ts',
    route: {
      path: '/events/user',
      method: HttpMethod.GET,
      integrationName: 'EventsCreatorIntegration',
    },
    tables: [
      {
        tableName: 'events',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
  },
  getEventById: {
    functionName: 'getEventById',
    handlerPath: 'getEventById.ts',
    route: {
      path: '/events/{id}',
      method: HttpMethod.GET,
      integrationName: 'EventsIdIntegration',
    },
    tables: [
      {
        tableName: 'events',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
  },
  getEventBySlug: {
    functionName: 'getEventBySlug',
    handlerPath: 'getEventBySlug.ts',
    route: {
      path: '/events/slug/{slug}',
      method: HttpMethod.GET,
      integrationName: 'EventsSlugIntegration',
    },
    tables: [
      {
        tableName: 'events',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
  },
  getFeaturedEvents: {
    functionName: 'getFeaturedEvents',
    handlerPath: 'getFeaturedEvents.ts',
    route: {
      path: '/events/featured',
      method: HttpMethod.GET,
      integrationName: 'EventsFeaturedIntegration',
    },
    tables: [
      {
        tableName: 'events',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
  },
};
