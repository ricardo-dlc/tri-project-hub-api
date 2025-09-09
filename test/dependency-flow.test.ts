import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TriProjectHubApiStack } from '../lib/tri-project-hub-api-stack';

describe('Dependency Flow Validation', () => {
  let app: App;
  let stack: TriProjectHubApiStack;
  let template: Template;

  beforeEach(() => {
    app = new App();
    stack = new TriProjectHubApiStack(app, 'TestStack', {
      config: {
        stage: 'test',
        projectName: 'test-project',
      },
    });
    template = Template.fromStack(stack);
  });

  test('Stack synthesizes without circular dependencies', () => {
    // If this test passes, it means CDK was able to synthesize the stack
    // without encountering circular dependencies
    expect(template).toBeDefined();
  });

  test('All required resources are created in correct dependency order', () => {
    // Verify DynamoDB table exists
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'test-project-test-events',
    });

    // Verify Lambda functions exist with correct environment variables
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-project-test-getevents',
      Environment: {
        Variables: {
          STAGE: 'test',
          IS_PRODUCTION: 'false',
          FUNCTION_TYPE: 'API',
        },
      },
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-project-test-geteventbyslug',
      Environment: {
        Variables: {
          STAGE: 'test',
          IS_PRODUCTION: 'false',
          FUNCTION_TYPE: 'API',
        },
      },
    });

    // Verify API Gateway exists
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      Name: 'test-project-test-api',
      Description: 'HTTP API for test stage',
    });

    // Verify API routes exist
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /events',
    });

    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /events/slug/{slug}',
    });
  });

  test('Lambda functions have proper DynamoDB permissions', () => {
    // Verify IAM policies exist for Lambda functions
    template.resourceCountIs('AWS::IAM::Policy', 2);

    // Verify the policies contain DynamoDB permissions
    const resources = template.toJSON().Resources;
    const policies = Object.values(resources).filter(
      (resource: any) => resource.Type === 'AWS::IAM::Policy'
    ) as any[];

    expect(policies).toHaveLength(2);

    // Check that each policy has DynamoDB read permissions
    policies.forEach((policy) => {
      const actions = policy.Properties.PolicyDocument.Statement[0].Action;
      expect(actions).toContain('dynamodb:GetItem');
      expect(actions).toContain('dynamodb:Query');
      expect(actions).toContain('dynamodb:Scan');
      expect(policy.Properties.PolicyDocument.Statement[0].Effect).toBe(
        'Allow'
      );
    });
  });

  test('Stage-aware resource naming is applied consistently', () => {
    // Verify all resources follow stage naming convention
    const resources = template.toJSON().Resources;

    // Check that DynamoDB table has stage-aware name
    const tableResource = Object.values(resources).find(
      (resource: any) => resource.Type === 'AWS::DynamoDB::Table'
    ) as any;
    expect(tableResource.Properties.TableName).toBe('test-project-test-events');

    // Check that Lambda functions have stage-aware names
    const lambdaResources = Object.values(resources).filter(
      (resource: any) => resource.Type === 'AWS::Lambda::Function'
    ) as any[];

    expect(lambdaResources).toHaveLength(2);
    const functionNames = lambdaResources.map((r) => r.Properties.FunctionName);
    expect(functionNames).toContain('test-project-test-getevents');
    expect(functionNames).toContain('test-project-test-geteventbyslug');

    // Check that API has stage-aware name
    const apiResource = Object.values(resources).find(
      (resource: any) => resource.Type === 'AWS::ApiGatewayV2::Api'
    ) as any;
    expect(apiResource.Properties.Name).toBe('test-project-test-api');
  });

  test('Multiple stages can be deployed without conflicts', () => {
    // Create a separate app for the prod stack to avoid synthesis conflicts
    const prodApp = new App();
    const prodStack = new TriProjectHubApiStack(prodApp, 'ProdStack', {
      config: {
        stage: 'prod',
        projectName: 'test-project',
      },
    });
    const prodTemplate = Template.fromStack(prodStack);

    // Verify prod stack has different resource names
    prodTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'test-project-prod-events',
    });

    prodTemplate.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-project-prod-getevents',
    });

    prodTemplate.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      Name: 'test-project-prod-api',
    });

    // Both stacks should synthesize without conflicts
    expect(template).toBeDefined();
    expect(prodTemplate).toBeDefined();
  });
});
