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
pnpm run deploy:dev
# or
cdk deploy -c stage=dev

# Deploy to production
pnpm run deploy:prod
# or
cdk deploy -c stage=prod

# Deploy to custom stage
cdk deploy -c stage=staging
```

#### 2. Using Environment Variables
```bash
# Set environment variable
export STAGE=prod
pnpm run deploy

# Or inline
STAGE=prod pnpm run deploy
```

#### 3. Using Project Name Override
```bash
# Override project name for different naming
cdk deploy -c stage=prod -c projectName=my-custom-project
```

## Available PNPM Scripts

### Deployment
- `pnpm run deploy` - Deploy with default stage (dev)
- `pnpm run deploy:dev` - Deploy to dev stage
- `pnpm run deploy:prod` - Deploy to prod stage

### Synthesis (Generate CloudFormation)
- `pnpm run synth` - Synthesize with default stage
- `pnpm run synth:dev` - Synthesize dev stage
- `pnpm run synth:prod` - Synthesize prod stage

### Diff (Compare changes)
- `pnpm run diff` - Show diff with default stage
- `pnpm run diff:dev` - Show diff for dev stage
- `pnpm run diff:prod` - Show diff for prod stage

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
# Using pnpm script (recommended)
pnpm run deploy:dev

# Using CDK directly
cdk deploy -c stage=dev

# Using environment variable
STAGE=dev cdk deploy
```

### Deploy to Production
```bash
# Using pnpm script (recommended)
pnpm run deploy:prod

# Using CDK directly
cdk deploy -c stage=prod

# With custom project name
cdk deploy -c stage=prod -c projectName=my-api
```

### Deploy Multiple Stages
You can deploy multiple stages to the same AWS account:

```bash
# Deploy dev
pnpm run deploy:dev

# Deploy prod (will create separate resources)
pnpm run deploy:prod

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

## Email Notification Configuration

The email notification system uses stage-specific configuration files with consistent environment variable names across all stages.

### Environment File Structure

Create stage-specific environment files:

- `.env.dev` - Development environment variables
- `.env.prod` - Production environment variables

### Required Environment Variables

Each stage-specific `.env` file should contain:

```bash
# Maileroo Configuration
MAILEROO_API_KEY=your-maileroo-api-key

# Sender Email Configuration
FROM_EMAIL=noreply@triprojecthub.com
FROM_NAME=Tri Project Hub

# Email Template IDs
INDIVIDUAL_TEMPLATE_ID=1001
TEAM_TEMPLATE_ID=1002
CONFIRMATION_TEMPLATE_ID=1003

# Other environment variables
CLERK_SECRET_KEY=your-clerk-secret-key
```

### Example Configuration Files

**`.env.dev` (Development):**
```bash
MAILEROO_API_KEY=your-dev-maileroo-api-key
FROM_EMAIL=noreply-dev@triprojecthub.com
FROM_NAME=Tri Project Hub (Dev)
INDIVIDUAL_TEMPLATE_ID=1001
TEAM_TEMPLATE_ID=1002
CONFIRMATION_TEMPLATE_ID=1003
```

**`.env.prod` (Production):**
```bash
MAILEROO_API_KEY=your-production-maileroo-api-key
FROM_EMAIL=noreply@triprojecthub.com
FROM_NAME=Tri Project Hub
INDIVIDUAL_TEMPLATE_ID=2001
TEAM_TEMPLATE_ID=2002
CONFIRMATION_TEMPLATE_ID=2003
```

### Stage-Specific Template Configuration

Each deployment stage uses different Maileroo template IDs to allow for:
- Testing email templates in development
- Production-ready templates

**Default Template ID Ranges:**
- **Dev**: 1001-1999
- **Production**: 2001-2999

### Email Configuration Validation

The system validates:
- All required environment variables are present
- Email addresses are in valid format
- Template IDs are numeric values
- Maileroo API keys are configured per stage

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
pnpm run diff:prod
```