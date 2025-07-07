# Active Context

## Current Work Focus
**Shared Types Package Implementation Complete**: Successfully implemented the foundation shared types package with comprehensive Zod schemas, validation utilities, and error handling.

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

## Immediate Next Steps
1. **Backend Package**: Lambda functions using shared types with serverless-http
2. **Frontend Package**: React app with TanStack Router consuming shared types
3. **Setup CDK Infrastructure**: Deploy stack with DynamoDB, API Gateway, Lambda functions
4. **Implement Recent Orders Feature**: Add `/orders/recent` endpoint and corresponding UI page

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