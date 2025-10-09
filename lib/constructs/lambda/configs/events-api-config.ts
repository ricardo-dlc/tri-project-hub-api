import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import type { LambdaCreationConfig } from '../../../types/infrastructure';

export const eventsApiLambdaConfigs: Record<string, LambdaCreationConfig> = {
  createEvent: {
    functionName: 'createEvent',
    handlerPath: 'createEvent.ts',
    route: {
      path: '/events',
      method: HttpMethod.POST,
      integrationName: 'EventsCreateIntegration',
    },
    tables: [
      {
        tableName: 'events',
        permission: 'readWrite',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
    environment: {
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    }
  },
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
    environment: {
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    }
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
  updateEvent: {
    functionName: 'updateEvent',
    handlerPath: 'updateEvent.ts',
    route: {
      path: '/events/{id}',
      method: HttpMethod.PUT,
      integrationName: 'EventsUpdateIntegration',
    },
    tables: [
      {
        tableName: 'events',
        permission: 'readWrite',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
    environment: {
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    }
  },
  deleteEvent: {
    functionName: 'deleteEvent',
    handlerPath: 'deleteEvent.ts',
    route: {
      path: '/events/{id}',
      method: HttpMethod.DELETE,
      integrationName: 'EventsDeleteIntegration',
    },
    tables: [
      {
        tableName: 'events',
        permission: 'readWrite',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
    environment: {
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    }
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
  // Organizer CRUD endpoints
  createOrganizer: {
    functionName: 'createOrganizer',
    handlerPath: 'createOrganizer.ts',
    route: {
      path: '/organizers',
      method: HttpMethod.POST,
      integrationName: 'OrganizersCreateIntegration',
    },
    tables: [
      {
        tableName: 'events',
        permission: 'readWrite',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
    environment: {
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    }
  },
  getOrganizer: {
    functionName: 'getOrganizer',
    handlerPath: 'getOrganizer.ts',
    route: {
      path: '/organizers/{organizerId}',
      method: HttpMethod.GET,
      integrationName: 'OrganizersGetIntegration',
    },
    tables: [
      {
        tableName: 'events',
        permission: 'read',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
    environment: {
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    }
  },
  getOrganizerMe: {
    functionName: 'getOrganizerMe',
    handlerPath: 'getOrganizerMe.ts',
    route: {
      path: '/organizers/me',
      method: HttpMethod.GET,
      integrationName: 'OrganizersGetMeIntegration',
    },
    tables: [
      {
        tableName: 'events',
        permission: 'read',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
    environment: {
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    }
  },
  updateOrganizer: {
    functionName: 'updateOrganizer',
    handlerPath: 'updateOrganizer.ts',
    route: {
      path: '/organizers/{organizerId}',
      method: HttpMethod.PUT,
      integrationName: 'OrganizersUpdateIntegration',
    },
    tables: [
      {
        tableName: 'events',
        permission: 'readWrite',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
    environment: {
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    }
  },
  deleteOrganizer: {
    functionName: 'deleteOrganizer',
    handlerPath: 'deleteOrganizer.ts',
    route: {
      path: '/organizers/{organizerId}',
      method: HttpMethod.DELETE,
      integrationName: 'OrganizersDeleteIntegration',
    },
    tables: [
      {
        tableName: 'events',
        permission: 'readWrite',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
    environment: {
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    }
  },
};
