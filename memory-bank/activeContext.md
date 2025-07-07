# Active Context

## Current Work Focus
**All Backend Lambda Functions Complete**: Successfully implemented all four backend Lambda functions including the main API handler, order simulator with proper decision logic, report generator, and data backfill functionality.

## Key Decisions Made
1. **Vendor Data**: Using hardcoded vendor list for backfill data generation (implemented in shared types)
2. **Refresh Strategy**: Manual refresh only - no auto-refresh functionality
3. **Authentication**: Out of scope - demo application with no auth required
4. **Reliability Scoring**: Simple percentage: (ARRIVED orders / total completed orders) * 100
5. **Data Retention**: Orders deleted after 30 days, reports kept for 6 months
6. **Logging Strategy**: Using console.log() throughout application (simplified approach)

## Completed Work
1. ✅ **NX Workspace**: Monorepo structure with packages directory
2. ✅ **Shared Types Package**: Complete implementation with Zod schemas
   - Order lifecycle types and validation
   - Vendor management and performance types
   - Report and dashboard types
   - Complete API contract types
   - Error handling utilities
   - Validation helpers and middleware
3. ✅ **Backend Package**: Complete Lambda function implementation
   - **Main API Handler**: Express server with serverless-http wrapper
     - Health check endpoint with dependency status
     - Orders, vendors, reports, and dashboard endpoints
     - CORS headers and preflight handling
     - Structured logging with correlation IDs
     - Mock data using correct enum values
     - Proper error handling with shared utilities
   - **Order Simulator**: Implements PLAN.md decision logic
     - Counts non-terminal orders (< 100 = 40% chance new order)
     - Updates existing order statuses with realistic transitions
     - EventBridge integration for status change events
     - Vendor reliability-based status progression
   - **Report Generator**: DynamoDB Stream triggered reporting
     - 7-day rolling window vendor metrics
     - Reliability score calculations and trend analysis
     - Dashboard summary generation with atomic upserts
   - **Data Backfill**: Historical data generation
     - 21-day backfill with realistic business patterns
     - Hardcoded vendor configurations with reliability profiles
     - Batch writing optimization for DynamoDB
   - All functions successfully build to `dist/packages/backend/`

## Immediate Next Steps
1. **🎯 CDK Infrastructure**: Deploy stack with DynamoDB, API Gateway, Lambda functions, EventBridge
2. **Frontend Package**: React app with TanStack Router consuming shared types
3. **Testing Scripts**: curl/AWS CLI validation of deployed infrastructure

## Recent Clarifications
- **Vendor List**: Will be hardcoded in backfill lambda (not dynamic)
- **UI Refresh**: Users must manually click refresh button to update data
- **Authentication**: Completely out of scope for this demo
- **Scoring Algorithm**: Keep it simple - just successful delivery percentage
- **Data Lifecycle**: Clear retention policies for orders vs reports
- **UI Mockups**: Complete ASCII mockups documented for all pages including new recent orders view
- **Recent Orders**: New page showing most recently updated orders (not just created) with activity metrics

## Active Architectural Decisions
- **Monorepo Structure**: `packages/` directory containing all services
- **Build Strategy**: Single `dist/` directory with package subfolders
- **Routing**: TanStack Router explicitly chosen over React Router
- **Styling**: CSS modules with Dropbox design principles (flat, bold colors, transparent buttons)
- **Infrastructure**: CDK with NodejsFunction primitives, no external AWS SDK

## Current Blockers
None - all clarifications received and ready to proceed with implementation.

## Implementation Priority
1. **Foundation**: NX workspace + shared types
2. **Backend**: Lambda functions + DynamoDB schema
3. **Frontend**: React dashboard with manual refresh
4. **Infrastructure**: CDK deployment stack
5. **Data**: Backfill lambda with hardcoded vendors
6. **Testing**: curl/AWS CLI validation scripts