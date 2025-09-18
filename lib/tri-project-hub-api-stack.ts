import { Environment, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { HttpApiConstruct } from './constructs/api/http-api';
import { StageConfiguration } from './constructs/config/stage-config';
import { EventsTable } from './constructs/database/events-table';
import { EventsApi } from './constructs/lambda/events-api';
import { LambdaFactory } from './constructs/lambda/lambda-factory';
import { StackConfiguration } from './types/infrastructure';
import { AuthApi } from './constructs/lambda/auth-api';

export interface TriProjectHubApiStackEnvironment extends Environment {
  databaseUrl: string;
}

export interface TriProjectHubApiStackProps extends StackProps {
  /** Stack configuration including stage and project settings */
  config?: StackConfiguration;
  env: TriProjectHubApiStackEnvironment
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

    // 2. Create EventsTable construct with stage configuration
    const eventsTable = new EventsTable(this, 'EventsTable', {
      stageConfig,
      tableName: config.tableName || 'events',
    });

    // 3. Create LambdaFactory with stage configuration
    const lambdaFactory = new LambdaFactory(this, {
      stageConfig,
    });

    // 4. Create EventsApi construct with dependencies (table, factory, stage config)
    const eventsApi = new EventsApi(this, 'EventsApi', {
      eventsTable: eventsTable.table, // Pass the actual Table instance, not the construct
      lambdaFactory,
      stageConfig: stageConfig.config, // Pass the StageConfig, not the StageConfiguration construct
    });
    
    const authApi = new AuthApi(this, 'AuthApi', {
      lambdaFactory,
      stageConfig: stageConfig.config,
      environment: props?.env
    });

    // 5. Create HttpApiConstruct with routes from EventsApi and stage config
    new HttpApiConstruct(this, 'HttpApi', {
      stageConfig: stageConfig.config,
      apiName: config.apiName || 'api',
      routes: [...eventsApi.getRoutes(), ...authApi.getRoutes()],
    });
  }
}
