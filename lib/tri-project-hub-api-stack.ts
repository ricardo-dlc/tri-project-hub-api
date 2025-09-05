import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';
import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

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
        name: 'isEnabled',
        type: AttributeType.NUMBER,
      },
      sortKey: {
        name: 'date',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    const eventsLambda = new NodejsFunction(this, 'EventsLambda', {
      runtime: Runtime.NODEJS_22_X,
      code: Code.fromAsset('lambdas/events/getEvents.ts'),
      handler: 'handler',
    });

    eventsTable.grantReadData(eventsLambda);

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
  }
}
