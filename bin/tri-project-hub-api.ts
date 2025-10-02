#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TriProjectHubApiStack } from '../lib/tri-project-hub-api-stack';

const app = new cdk.App();

// Get stage from multiple sources (in order of precedence):
// 1. CDK context (-c stage=prod)
// 2. Environment variable (STAGE=prod)
// 3. Default to 'dev'
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';

// Get project name (optional override)
const projectName =
  app.node.tryGetContext('projectName') || process.env.PROJECT_NAME;

// Shared configuration
const config = {
  stage,
  projectName,
};

const envConfig = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Create unified stack with layer and API
new TriProjectHubApiStack(app, `TriProjectHubApiStack-${stage}`, {
  config,
  env: envConfig,
  description: `Tri Project Hub API Stack for ${stage} environment`,
});
