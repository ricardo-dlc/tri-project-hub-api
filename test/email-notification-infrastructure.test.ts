import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TriProjectHubApiStack } from '../lib/tri-project-hub-api-stack';

describe('Email Notification Infrastructure', () => {
  let app: App;
  let stack: TriProjectHubApiStack;
  let template: Template;

  beforeEach(() => {
    // Set up environment variables for testing
    process.env.MAILEROO_API_KEY = 'test-api-key';
    process.env.FROM_EMAIL = 'noreply@test.com';
    process.env.FROM_NAME = 'Test App';
    process.env.INDIVIDUAL_TEMPLATE_ID = '123';
    process.env.TEAM_TEMPLATE_ID = '456';
    process.env.CONFIRMATION_TEMPLATE_ID = '789';

    app = new App();
    stack = new TriProjectHubApiStack(app, 'TestStack', {
      config: {
        stage: 'test',
        projectName: 'test-project',
      },
    });
    template = Template.fromStack(stack);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.MAILEROO_API_KEY;
    delete process.env.FROM_EMAIL;
    delete process.env.FROM_NAME;
    delete process.env.INDIVIDUAL_TEMPLATE_ID;
    delete process.env.TEAM_TEMPLATE_ID;
    delete process.env.CONFIRMATION_TEMPLATE_ID;
  });

  test('creates SQS queue for email notifications', () => {
    // Check that the main email notification queue is created
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'test-project-test-email-notifications',
    });
  });

  test('creates dead letter queue for email notifications', () => {
    // Check that the dead letter queue is created
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'test-project-test-email-notifications-dlq',
    });
  });

  test('creates email processor Lambda with environment variables', () => {
    // Check that the email processor Lambda function is created
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-project-test-email-processor',
      Environment: {
        Variables: {
          STAGE: 'test',
          IS_PRODUCTION: 'false',
          MAILEROO_API_KEY: 'test-api-key',
          FROM_EMAIL: 'noreply@test.com',
          FROM_NAME: 'Test App',
          INDIVIDUAL_TEMPLATE_ID: '123',
          TEAM_TEMPLATE_ID: '456',
          CONFIRMATION_TEMPLATE_ID: '789',
        },
      },
    });
  });

  test('creates SQS event source mapping for email processor', () => {
    // Check that the SQS event source mapping is created
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BatchSize: 10,
      FunctionResponseTypes: ['ReportBatchItemFailures'],
      MaximumBatchingWindowInSeconds: 5,
    });
  });

  test('registration handlers have EMAIL_QUEUE_URL environment variable', () => {
    // Check that registration handlers have access to the email queue URL
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-project-test-createregistration',
      Environment: {
        Variables: {
          EMAIL_QUEUE_URL: {
            Ref: expect.stringMatching(/EmailNotificationQueue/),
          },
        },
      },
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-project-test-updatepaymentstatus',
      Environment: {
        Variables: {
          EMAIL_QUEUE_URL: {
            Ref: expect.stringMatching(/EmailNotificationQueue/),
          },
        },
      },
    });
  });

  test('grants SQS send permissions to registration handlers', () => {
    // Check that IAM policies are created to allow registration handlers to send SQS messages
    // Look for policies that contain SQS SendMessage permissions
    const template_json = template.toJSON();
    const policies = Object.values(template_json.Resources).filter(
      (resource: any) => resource.Type === 'AWS::IAM::Policy'
    );

    const hasSqsPermission = policies.some((policy: any) => {
      const statements = policy.Properties.PolicyDocument.Statement;
      return statements.some((statement: any) =>
        statement.Action === 'sqs:SendMessage' &&
        statement.Resource &&
        statement.Resource['Fn::GetAtt'] &&
        statement.Resource['Fn::GetAtt'][0].includes('EmailNotificationQueue')
      );
    });

    expect(hasSqsPermission).toBe(true);
  });
});

describe('Email Notification Infrastructure - Environment Variables', () => {
  test('throws error when required environment variables are missing', () => {
    // Clear environment variables to test validation
    const originalEnv = { ...process.env };
    delete process.env.MAILEROO_API_KEY;
    delete process.env.FROM_EMAIL;
    delete process.env.FROM_NAME;
    delete process.env.INDIVIDUAL_TEMPLATE_ID;
    delete process.env.TEAM_TEMPLATE_ID;
    delete process.env.CONFIRMATION_TEMPLATE_ID;

    const app = new App();

    expect(() => {
      new TriProjectHubApiStack(app, 'TestStackNoEnv', {
        config: {
          stage: 'test',
          projectName: 'test-project',
        },
      });
    }).toThrow(/Missing required email notification configuration fields/);

    // Restore environment variables
    Object.assign(process.env, originalEnv);
  });
});
