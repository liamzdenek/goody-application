# Package Structure Documentation

## Implemented NX Monorepo Structure

```
goody-application/
├── nx.json                           # NX workspace configuration
├── package.json                      # Root dependencies and scripts  
├── tsconfig.base.json               # Base TypeScript configuration
├── .gitignore                       # Git ignore (includes .env and .env.*)
├── dist/                            # Single build output directory
│   └── packages/
│       └── shared/                  # Compiled shared package artifacts
├── packages/                        # All monorepo packages
│   ├── shared/                      # ✅ COMPLETED - Shared types and utilities
│   ├── frontend/                    # 🔄 TODO - React dashboard application
│   ├── backend/                     # 🔄 TODO - Lambda functions (flattened structure)
│   └── infrastructure/              # 🔄 TODO - CDK deployment stack
```

## Shared Package Implementation (✅ COMPLETED)

### Directory Structure
```
packages/shared/
├── package.json                     # Dependencies: zod, tslib
├── project.json                     # NX project configuration
├── tsconfig.json                    # TypeScript configuration
├── src/
│   ├── index.ts                     # Main exports file
│   ├── types/                       # Core type definitions
│   │   ├── order.ts                 # Order lifecycle and management
│   │   ├── vendor.ts                # Vendor data and performance
│   │   ├── report.ts                # Dashboard reports and analytics
│   │   └── api.ts                   # API contracts and responses
│   ├── utils/                       # Utility functions
│   │   ├── errors.ts                # Error handling and logging
│   │   └── validation.ts            # Zod validation helpers
│   └── lib/                         # Legacy (to be removed)
│       └── shared.ts                # Original NX generated file
```

### Key Type Definitions

#### Order Types (`order.ts`) - ✅ ALIGNED WITH PLAN.MD
- **OrderStatus**: PLACED → SHIPPING_ON_TIME/DELAYED → ARRIVED/LOST/DAMAGED/UNDELIVERABLE/RETURN_TO_SENDER
- **GiftType**: "flowers" | "tech" | "food" | "apparel" (matching PLAN.md)
- **Order**: Complete order schema matching PLAN.md exactly:
  - `giftValue: number` (in cents)
  - `giftType: GiftType` (gift category enum)
  - `isRush: boolean`
  - `estimatedDelivery/actualDelivery` (ISO timestamps)
- **CreateOrderInput**: Input validation for new orders
- **UpdateOrderInput**: Status transition validation
- **OrderQueryFilters**: Query parameters for order listing
- **Helper Functions**: Status transition validation, delay calculation

#### Vendor Types (`vendor.ts`) - ✅ ALIGNED WITH PLAN.MD
- **Vendor**: Complete vendor schema matching PLAN.md exactly:
  - `category: GiftType` (flowers/tech/food/apparel)
  - `baseReliability: number` (0.7-0.98 range)
  - `avgOrderValue: number` (in cents)
  - `metadata.slaPromises` (standardDelivery/rushDelivery in days)
- **BackfillVendorConfig**: Configuration for data generation
- **VendorQueryFilters**: Query parameters for vendor listing
- **BACKFILL_VENDORS**: Hardcoded vendor configurations matching PLAN.md:
  - Premium Flowers (95% reliability, flowers category)
  - Gourmet Baskets (92% reliability, food category)
  - Tech Gadgets Co (87% reliability, tech category)
  - Artisan Goods (83% reliability, apparel category)
  - Fast Fashion (72% reliability, apparel category)

#### Report Types (`report.ts`) - ✅ ALIGNED WITH PLAN.MD
- **StatusCounts**: All 8 status types (PLACED, SHIPPING_ON_TIME, SHIPPING_DELAYED, ARRIVED, LOST, DAMAGED, UNDELIVERABLE, RETURN_TO_SENDER)
- **VendorReport**: Exact PLAN.md schema with current7d/previous7d/trends
- **DashboardSummary**: Exact PLAN.md schema with summaryId/date structure
- **GenerateReportRequest**: Report generation parameters
- **Helper Functions**: Reliability score calculation, trend analysis

#### API Types (`api.ts`) - ✅ ALIGNED WITH PLAN.MD
- **Complete API Contracts**: All endpoints matching PLAN.md exactly (no wrapper format)
- **HealthCheckResponse**: System health with all required checks
- **DashboardSummaryResponse**: Main dashboard data structure
- **VendorListResponse**: Vendor listing with pagination
- **VendorReportResponse**: Detailed vendor analytics
- **OrdersListResponse**: Order listing with filters
- **Error Handling**: Consistent error response format
- **CORS Headers**: Proper headers for frontend access

### Utility Functions

#### Error Handling (`errors.ts`)
- **ErrorCodes**: Standardized error codes for all scenarios
- **AppError**: Base error class with correlation ID support
- **Specific Error Classes**: ValidationError, NotFoundError, BusinessLogicError, etc.
- **Error Factories**: Consistent error creation functions
- **Zod Integration**: Automatic Zod validation error conversion
- **Middleware**: Express and Lambda error handlers
- **Logging**: Console.log-based error logging with structured format

#### Validation (`validation.ts`)
- **Safe Validation**: Wrapper functions for consistent Zod validation
- **Validation Patterns**: Common patterns (UUID, dates, currency, etc.)
- **Environment Schema**: Complete environment variable validation
- **Request Validators**: Middleware factories for API endpoints
- **Input Schemas**: Pre-built validation schemas for all API endpoints
- **Data Preparation**: Utilities for cleaning and preparing validation data

### Build Configuration
- **Bundler**: TypeScript compiler (tsc)
- **Output**: `dist/packages/shared/` directory
- **Dependencies**: Zod for validation, tslib for TypeScript helpers
- **Exports**: Clean index.ts with all types and utilities available

## Package Dependencies

### Shared Package
```json
{
  "dependencies": {
    "zod": "^3.25.75",
    "tslib": "^2.3.0"
  }
}
```

### Cross-Package Usage
- **Backend** → imports shared types for Lambda function implementation
- **Frontend** → imports API types for React components and services
- **Infrastructure** → imports types for CDK resource definitions and environment validation

## Design Decisions Implemented

### Type Safety Strategy
- **Zod Schemas**: Runtime validation with TypeScript type inference
- **No Cross-Imports**: Frontend/backend cannot import from each other
- **Shared Foundation**: All common types in dedicated shared package
- **Validation at Boundaries**: API requests, environment variables, Lambda events

### Error Handling Strategy
- **No Fallbacks**: Either main path works or fails with proper logging
- **Consistent Formats**: Standardized error response structure
- **Correlation IDs**: Request tracing throughout the system
- **Console Logging**: Simplified logging strategy using console.log()

### Validation Strategy
- **Middleware Factories**: Reusable validation middleware for Express
- **Lambda Helpers**: Event validation for serverless functions
- **Environment Validation**: Runtime configuration validation
- **Input Sanitization**: Data cleaning and type coercion

## Integration Points

The shared package provides the foundation for:

1. **API Development**: Complete contract types for backend implementation
2. **Frontend Development**: Type-safe API client and component props
3. **Infrastructure**: Environment validation and resource typing
4. **Testing**: Consistent data structures for validation scripts

## Next Implementation Steps

1. **Backend Package**: Lambda functions using shared types
2. **Frontend Package**: React components consuming shared API types
3. **Infrastructure Package**: CDK stack with environment validation
4. **Integration**: Wire packages together with proper dependency injection