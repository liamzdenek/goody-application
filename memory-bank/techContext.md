# Technical Context

## Technology Stack

### Frontend Technologies
- **Framework**: React with TypeScript
- **Routing**: TanStack Router (explicitly not React Router)
- **Styling**: CSS Modules (no Tailwind, no CSS frameworks)
- **Build System**: NX monorepo workspace
- **Package Manager**: npm with explicit --save/--save-dev flags

### Backend Technologies
- **Runtime**: Node.js on AWS Lambda
- **Framework**: Express-like with serverless-http
- **Database**: DynamoDB with GSI access patterns
- **Validation**: Zod schemas for all data structures
- **Event Processing**: EventBridge for scheduling, DynamoDB Streams for triggers

### Infrastructure Technologies
- **Deployment**: AWS CDK with TypeScript
- **Compute**: Lambda functions using NodejsFunction primitive
- **Storage**: DynamoDB for data, S3 for static frontend assets
- **CDN**: CloudFront with Origin Access Identity
- **API**: API Gateway with Lambda integration

## Development Constraints

### NX Monorepo Structure
- **Workspace**: All packages in `packages/` directory
- **Build Output**: Single `dist/` directory at root with package subfolders
- **Generation**: Use `nx generate` commands, not manual file creation
- **Scripts**: All operations attached to `nx run` commands

### AWS Integration Requirements
- **Environment Variables**: Pass AWS resource ARNs/locations to applications
- **Frontend Config**: Make same environment variables available at build time
- **No Mocking**: Use actual AWS deployments for testing
- **Bundle Strategy**: Do NOT mark AWS SDK as external (bundle it)

### Code Quality Standards
- **TypeScript**: Default language unless overridden
- **No Fallbacks**: Main path works or fails with proper logging
- **Debug Logging**: Include requests/responses for troubleshooting
- **Health Checks**: Comprehensive dependency validation in all services

## Build and Deployment

### Compilation Strategy
- **Pre-compilation**: Compile outside of CDK, import artifacts
- **Artifact Validation**: MUST clean, rebuild, and validate after config changes
- **Dependency Management**: Fix conflicts instead of using --legacy-peer-deps

### Testing Strategy
- **No E2E**: Playwright/similar testing out of scope
- **Deployment Testing**: Use curl and AWS CLI for validation
- **CloudWatch Logs**: Always "sleep 10 && [command]" when checking logs

### Security Considerations
- **No Authentication**: Demo application, auth out of scope
- **CORS**: Proper headers for frontend-backend communication
- **IAM**: Least privilege access for Lambda functions
- **Environment Variables**: Secure configuration management

## Performance Requirements

### Response Time Targets
- **Dashboard Load**: <2 seconds for main dashboard
- **API Responses**: <1 second for all API endpoints
- **Report Generation**: <30 seconds after order updates
- **Data Freshness**: Updates every 5 minutes via EventBridge

### Data Volume Considerations
- **Order Simulation**: 50-200 orders per day
- **Historical Data**: 21-day backfill (approximately 2000-4000 orders)
- **Vendor Count**: 8-12 vendors with varied performance patterns
- **Report Aggregation**: 7-day rolling windows for trend analysis

## Shared Dependencies

### Type Definitions
- **Shared Package**: All common types in dedicated package
- **No Cross-Imports**: Frontend/backend cannot import from each other
- **Zod Schemas**: Shared validation schemas across all services

### Utility Functions
- **Logging**: Structured logging with correlation IDs
- **Error Handling**: Consistent error response formats
- **Data Validation**: Zod-based schema validation
- **Date/Time**: Consistent ISO timestamp handling