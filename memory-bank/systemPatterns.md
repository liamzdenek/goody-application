# System Patterns

## Architecture Overview
Event-driven serverless architecture with clear separation of concerns:

```
CloudFront + S3 → API Gateway → Lambda Functions → DynamoDB
                                        ↓
                              EventBridge Scheduler
```

## Core Components

### Frontend (React SPA)
- **Route Structure**: Dashboard overview → Vendor details → Order listings
- **State Management**: React hooks for local state, API calls for data
- **Styling**: CSS modules with Dropbox design principles
- **Routing**: TanStack Router (not React Router)
- **Build**: Single `dist` directory with package subfolders

### Backend Services
- **API Handler**: Express-like routing with serverless-http
- **Order Simulator**: EventBridge-triggered order lifecycle updates
- **Report Generator**: DynamoDB Stream-triggered metric calculations
- **Data Backfill**: One-time historical data generation

### Data Layer
- **Orders Table**: Main transaction log with GSI for vendor/status queries
- **Reports Table**: Pre-computed vendor performance metrics
- **Vendors Table**: Master data for vendor information

## Key Design Patterns

### 12-Factor App Implementation
- **Config**: Environment variables for all runtime configuration
- **Dependencies**: Explicit package.json declarations with --save/--save-dev
- **Build**: Separate build artifacts from source code
- **Processes**: Stateless Lambda functions
- **Logs**: Structured logging with correlation IDs

### Event-Driven Updates
- **Order Changes**: DynamoDB Stream → Report Generator
- **Scheduled Simulation**: EventBridge → Order Simulator
- **Real-time Metrics**: Pre-computed reports for fast API responses

### Data Access Patterns
- **Dashboard Summary**: Single query to Reports table
- **Vendor Details**: Targeted queries with GSI access patterns
- **Order Listings**: Cursor-based pagination for large datasets

### Error Handling Strategy
- **No Fallbacks**: Either main path works or fails with proper logging
- **Health Checks**: Comprehensive dependency validation
- **Structured Errors**: Consistent error response format across APIs

## Component Relationships

### Lambda Function Dependencies
- **API Handler**: Depends on DynamoDB read access
- **Order Simulator**: Depends on DynamoDB write access
- **Report Generator**: Depends on DynamoDB read/write access
- **Data Backfill**: Depends on DynamoDB batch write capabilities

### Frontend Data Flow
1. User loads dashboard → API call to `/dashboard/summary`
2. User clicks vendor → API call to `/vendors/{vendorId}/report`
3. User clicks refresh → Re-fetch current API endpoints
4. User navigates → TanStack Router handles client-side routing

### CDK Deployment Structure
- **Single Stack Deployment**: GoodyDashboardStack with all resources
- **NX Integration**: Automated dependency building with `npx nx deploy infrastructure`
- **Resource Outputs**: All AWS resource names and URLs available as stack outputs
- **Environment Variables**: Passed from CDK to Lambda functions via process.env

### Deployed AWS Resources
- **API Gateway**: https://6q0ywxpbhh.execute-api.us-west-2.amazonaws.com/prod/
- **CloudFront Distribution**: https://d1fkw11r9my6ok.cloudfront.net
- **DynamoDB Tables**:
  - Orders: GoodyDashboardStack-GoodyOrders7B4321AE-1AW2E75YVYWG5
  - Reports: GoodyDashboardStack-GoodyReports496FB776-1GN9M97BI6NDT
- **Lambda Functions**:
  - Data Backfill: GoodyDashboardStack-DataBackfillFunctionAB4732C3-wmgA86juPjmT
  - Order Simulator: GoodyDashboardStack-OrderSimulatorFunctionE9E5293D-lnazX88QM6AF
- **EventBridge Bus**: GoodyOrderEvents

### NX Deployment Automation
- **Command**: `npx nx deploy infrastructure`
- **Dependency Chain**: shared:build → backend:build → frontend:build → infrastructure:build → infrastructure:deploy
- **AWS Profile**: lz-demos
- **Build Caching**: NX cached 3/5 tasks for efficient rebuilds
- **Deployment Time**: ~8 minutes (468s for CloudFormation)