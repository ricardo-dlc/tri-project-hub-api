import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import path from 'path';

export class TriProjectHubApiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const eventsTable = new Table(this, 'EventsTable', {
      tableName: 'tri-project-hub-api-events',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    eventsTable.addGlobalSecondaryIndex({
      indexName: 'SlugIndex',
      partitionKey: {
        name: 'slug',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    eventsTable.addGlobalSecondaryIndex({
      indexName: 'TypeIndex',
      partitionKey: {
        name: 'typeEnabled',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    eventsTable.addGlobalSecondaryIndex({
      indexName: 'FeaturedIndex',
      partitionKey: {
        name: 'isFeaturedEnabled',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    eventsTable.addGlobalSecondaryIndex({
      indexName: 'DifficultyIndex',
      partitionKey: {
        name: 'difficultyEnabled',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    eventsTable.addGlobalSecondaryIndex({
      indexName: 'LocationIndex',
      partitionKey: {
        name: 'locationEnabled',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    eventsTable.addGlobalSecondaryIndex({
      indexName: 'EnabledIndex',
      partitionKey: {
        name: 'enabledStatus',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    const eventsLambda = new NodejsFunction(this, 'EventsLambda', {
      runtime: Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambdas/events/getEvents.ts'),
      environment: {
        EVENTS_TABLE_NAME: eventsTable.tableName,
      },
      bundling: {
        minify: false,
        sourceMap: true,
        sourcesContent: false,
        format: OutputFormat.ESM,
        target: 'esnext',
      },
      handler: 'handler',
    });

    eventsTable.grantReadData(eventsLambda);

    const getEventBySlugLambda = new NodejsFunction(
      this,
      'GetEventBySlugLambda',
      {
        runtime: Runtime.NODEJS_22_X,
        entry: path.join(__dirname, '../lambdas/events/getEventBySlug.ts'),
        environment: {
          EVENTS_TABLE_NAME: eventsTable.tableName,
        },
        bundling: {
          minify: false,
          sourceMap: true,
          sourcesContent: false,
          format: OutputFormat.ESM,
          target: 'esnext',
        },
        handler: 'handler',
      }
    );

    eventsTable.grantReadData(getEventBySlugLambda);

    const httpApi = new HttpApi(this, 'TriProjectHubApi', {
      apiName: 'TriProjectHubApi',
    });

    const eventsIntegration = new HttpLambdaIntegration(
      'EventsIntegration',
      eventsLambda
    );

    httpApi.addRoutes({
      path: '/events',
      methods: [HttpMethod.GET],
      integration: eventsIntegration,
    });

    const getEventBySlugIntegration = new HttpLambdaIntegration(
      'GetEventBySlugIntegration',
      getEventBySlugLambda
    );

    httpApi.addRoutes({
      path: '/events/{slug}',
      methods: [HttpMethod.GET],
      integration: getEventBySlugIntegration,
    });
  }
}
