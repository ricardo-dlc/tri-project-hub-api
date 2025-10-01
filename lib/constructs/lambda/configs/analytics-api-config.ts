import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import type { LambdaCreationConfig } from '../../../types/infrastructure';

export const analyticsApiLambdaConfigs: Record<string, LambdaCreationConfig> = {
  getAnalytics: {
    functionName: 'getAnalytics',
    handlerPath: 'getAnalytics.ts',
    route: {
      path: '/analytics',
      method: HttpMethod.GET,
      integrationName: 'AnalyticsIntegration',
    },
    tables: [
      {
        tableName: 'analytics',
        environmentVariable: 'ANALYTICS_TABLE_NAME',
      },
    ],
  },
  createAnalyticsEvent: {
    functionName: 'createAnalyticsEvent',
    handlerPath: 'createAnalyticsEvent.ts',
    route: {
      path: '/analytics/events',
      method: HttpMethod.POST,
      integrationName: 'CreateAnalyticsEventIntegration',
    },
    tables: [
      {
        tableName: 'analytics',
        permission: 'write',
        environmentVariable: 'ANALYTICS_TABLE_NAME',
      },
    ],
  },
  getEventMetrics: {
    functionName: 'getEventMetrics',
    handlerPath: 'getEventMetrics.ts',
    route: {
      path: '/analytics/events/{eventId}/metrics',
      method: HttpMethod.GET,
      integrationName: 'EventMetricsIntegration',
    },
    tables: [
      {
        tableName: 'analytics',
        environmentVariable: 'ANALYTICS_TABLE_NAME',
      },
      {
        tableName: 'events',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
    environment: {
      METRICS_CACHE_TTL: '600',
    },
  },
  getDashboardData: {
    functionName: 'getDashboardData',
    handlerPath: 'getDashboardData.ts',
    route: {
      path: '/analytics/dashboard',
      method: HttpMethod.GET,
      integrationName: 'DashboardDataIntegration',
    },
    tables: [
      {
        tableName: 'analytics',
        permission: 'readWrite',
        environmentVariable: 'ANALYTICS_TABLE_NAME',
      },
      {
        tableName: 'events',
        environmentVariable: 'EVENTS_TABLE_NAME',
      },
    ],
    environment: {
      DASHBOARD_CACHE_TTL: '300',
      MAX_DASHBOARD_ITEMS: '50',
    },
  },
};
