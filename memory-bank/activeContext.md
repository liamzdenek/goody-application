# Active Context

## Current Work Focus
**Memory Bank Enhancement Phase**: Added UI mockups documentation and recent order updates functionality based on user requirements.

## Key Decisions Made
1. **Vendor Data**: Using hardcoded vendor list for backfill data generation
2. **Refresh Strategy**: Manual refresh only - no auto-refresh functionality
3. **Authentication**: Out of scope - demo application with no auth required
4. **Reliability Scoring**: Simple percentage: (ARRIVED orders / total completed orders) * 100
5. **Data Retention**: Orders deleted after 30 days, reports kept for 6 months

## Immediate Next Steps
1. **Initialize NX Workspace**: Create monorepo structure with proper package organization
2. **Setup Shared Types**: Create shared package with Zod schemas for Order, Vendor, Report interfaces
3. **Create Frontend Package**: React app with TanStack Router and CSS modules
4. **Create Backend Package**: Lambda functions with serverless-http
5. **Setup CDK Infrastructure**: Deploy stack with DynamoDB, API Gateway, Lambda functions
6. **Implement Recent Orders Feature**: Add `/orders/recent` endpoint and corresponding UI page

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