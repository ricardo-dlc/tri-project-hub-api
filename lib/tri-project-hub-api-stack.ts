import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { HttpApiConstruct } from './constructs/api/http-api';
import { StageConfiguration } from './constructs/config/stage-config';
import { EventsTable } from './constructs/database/events-table';
import { EventsApi } from './constructs/lambda/events-api';
import { LambdaFactory } from './constructs/lambda/lambda-factory';
import { RegistrationsApi } from './constructs/lambda/registrations-api';
import { SharedDependenciesLayer } from './constructs/layer/shared-dependencies-layer';
import { StackConfiguration } from './types/infrastructure';

export interface TriProjectHubApiStackProps extends StackProps {
  /** Stack configuration including stage and project settings */
  config?: StackConfiguration;
}

export class TriProjectHubApiStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props?: TriProjectHubApiStackProps
  ) {
    super(scope, id, props);

    // Extract configuration from props
    const config = props?.config || {};

    // 1. Create StageConfiguration - foundation for all stage-aware naming
    const stageConfig = new StageConfiguration({
      stage: config.stage,
      projectName: config.projectName,
    });

    // 2. Create shared dependencies layer (in same stack to avoid cross-stack export issues)
    const sharedLayer = new SharedDependenciesLayer(this, 'SharedDependenciesLayer', {
      stageConfig,
    });

    // 3. Create EventsTable construct with stage configuration
    const eventsTable = new EventsTable(this, 'EventsTable', {
      stageConfig,
      tableName: config.tableName || 'events',
    });

    // 4. Create LambdaFactory with stage configuration and shared layer
    const lambdaFactory = new LambdaFactory(this, {
      stageConfig,
      sharedLayer: sharedLayer.layer,
    });

    // 5. Create EventsApi construct with dependencies (tables, factory, stage config)
    const eventsApi = new EventsApi(this, 'EventsApi', {
      tables: {
        events: eventsTable.table, // Pass the actual Table instance, not the construct
      },
      lambdaFactory,
      stageConfig: stageConfig.config, // Pass the StageConfig, not the StageConfiguration construct
    });

    const registrationsApi = new RegistrationsApi(this, 'RegistrationsApi', {
      tables: {
        events: eventsTable.table, // Pass the actual Table instance, not the construct
      },
      lambdaFactory,
      stageConfig: stageConfig.config, // Pass the StageConfig, not the StageConfiguration construct
    });

    // 6. Create HttpApiConstruct with routes from EventsApi and stage config
    new HttpApiConstruct(this, 'HttpApi', {
      stageConfig: stageConfig.config,
      apiName: config.apiName || 'api',
      routes: [...eventsApi.getRoutes(), ...registrationsApi.getRoutes()],
    });
  }
}
