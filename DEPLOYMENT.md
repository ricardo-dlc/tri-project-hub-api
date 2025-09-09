# Deployment Guide

This project supports multi-stage deployments within the same AWS account using stage-aware resource naming.

## Stage Configuration

### Available Stages
- `dev` (default) - Development environment
- `prod` - Production environment
- `test` - Testing environment
- `staging` - Staging environment
- Custom stages are also supported

### How to Specify Stage

There are multiple ways to specify the deployment stage:

#### 1. Using CDK Context (Recommended)
```bash
# Deploy to dev (default)
npm run deploy:dev
# or
cdk deploy -c stage=dev

# Deploy to production
npm run deploy:prod
# or
cdk deploy -c stage=prod

# Deploy to custom stage
cdk deploy -c stage=staging
```

#### 2. Using Environment Variables
```bash
# Set environment variable
export STAGE=prod
npm run deploy

# Or inline
STAGE=prod npm run deploy
```

#### 3. Using Project Name Override
```bash
# Override project name for different naming
cdk deploy -c stage=prod -c projectName=my-custom-project
```

## Available NPM Scripts

### Deployment
- `npm run deploy` - Deploy with default stage (dev)
- `npm run deploy:dev` - Deploy to dev stage
- `npm run deploy:prod` - Deploy to prod stage

### Synthesis (Generate CloudFormation)
- `npm run synth` - Synthesize with default stage
- `npm run synth:dev` - Synthesize dev stage
- `npm run synth:prod` - Synthesize prod stage

### Diff (Compare changes)
- `npm run diff` - Show diff with default stage
- `npm run diff:dev` - Show diff for dev stage
- `npm run diff:prod` - Show diff for prod stage

## Resource Naming Convention

Resources are named using the pattern: `{projectName}-{stage}-{resourceType}`

### Examples:

**Dev Stage:**
- Table: `tri-project-hub-dev-events`
- Lambda: `tri-project-hub-dev-getevents`
- API: `tri-project-hub-dev-api`

**Prod Stage:**
- Table: `tri-project-hub-prod-events`
- Lambda: `tri-project-hub-prod-getevents`
- API: `tri-project-hub-prod-api`

## Stage-Specific Configurations

### Development (`dev`)
- CORS: Allows all origins (`*`)
- Lambda: Source maps enabled, no minification
- Cache: Short cache times (5 minutes)
- Environment: `IS_PRODUCTION=false`

### Production (`prod`)
- CORS: Restricted to production domains
- Lambda: Minified bundles for better performance
- Cache: Long cache times (24 hours)
- Environment: `IS_PRODUCTION=true`

## Deployment Examples

### Deploy to Development
```bash
# Using npm script (recommended)
npm run deploy:dev

# Using CDK directly
cdk deploy -c stage=dev

# Using environment variable
STAGE=dev cdk deploy
```

### Deploy to Production
```bash
# Using npm script (recommended)
npm run deploy:prod

# Using CDK directly
cdk deploy -c stage=prod

# With custom project name
cdk deploy -c stage=prod -c projectName=my-api
```

### Deploy Multiple Stages
You can deploy multiple stages to the same AWS account:

```bash
# Deploy dev
npm run deploy:dev

# Deploy prod (will create separate resources)
npm run deploy:prod

# Both stages will coexist with isolated resources
```

## Environment Variables in Lambda Functions

Lambda functions automatically receive stage-aware environment variables:

```javascript
// Available in all Lambda functions
process.env.STAGE              // 'dev', 'prod', etc.
process.env.IS_PRODUCTION      // 'true' or 'false'
process.env.EVENTS_TABLE_NAME  // Stage-aware table name
process.env.FUNCTION_TYPE      // 'API'
process.env.API_TIMEOUT        // '15'
```

## Cleanup

To destroy a specific stage:

```bash
# Destroy dev stage
cdk destroy -c stage=dev

# Destroy prod stage
cdk destroy -c stage=prod
```

## Troubleshooting

### Stack Already Exists Error
If you get a stack already exists error, make sure you're using the correct stage parameter. Each stage creates a separate stack with the naming pattern `TriProjectHubApiStack-{stage}`.

### Resource Name Conflicts
If you encounter resource name conflicts, you can override the project name:
```bash
cdk deploy -c stage=dev -c projectName=my-unique-project
```

### Viewing Current Deployments
```bash
# List all stacks
cdk list

# Show diff for specific stage
npm run diff:prod
```