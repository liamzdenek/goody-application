# API Contracts

## Service: Dashboard API
**Base URL**: `https://6q0ywxpbhh.execute-api.us-west-2.amazonaws.com/prod`

## Authentication
None required - demo application

## Common Response Headers
```
Content-Type: application/json
Access-Control-Allow-Origin: *
X-Correlation-ID: <uuid>
```

## Database Structure

### Orders Table
**Table Name**: `goody-orders`
**Partition Key**: `orderId` (string)

**Global Secondary Indexes**:
- **GSI1**: `vendorId` (PK) + `createdAt` (SK) - for vendor-specific queries
- **GSI2**: `status` (PK) + `updatedAt` (SK) - for status-based queries

**Schema**:
```typescript
interface Order {
  orderId: string;                    // Partition Key: "ORD-{timestamp}-{random}"
  vendorId: string;                   // GSI1 Partition Key
  status: OrderStatus;                // GSI2 Partition Key
  createdAt: string;                  // ISO timestamp, GSI1 Sort Key
  updatedAt: string;                  // ISO timestamp, GSI2 Sort Key
  estimatedDelivery?: string;         // ISO timestamp
  actualDelivery?: string;            // ISO timestamp
  giftValue: number;                  // In cents
  giftType: string;                   // "flowers" | "tech" | "food" | "apparel"
  isRush: boolean;
  isDelayed: boolean;                 // updatedAt > estimatedDelivery
  deliveryDays?: number;              // Days from created to delivered
  isBackfilled?: boolean;             // Track if this is historical data
  ttl?: number;                       // TTL for 30-day retention
}
```

### Reports Table
**Table Name**: `goody-reports`
**Partition Key**: `vendorId` (string)
**Sort Key**: `date` (string, YYYY-MM-DD format)

**Schema**:
```typescript
interface VendorReport {
  vendorId: string;                   // Partition Key
  date: string;                       // Sort Key (YYYY-MM-DD)
  current7d: {
    statusCounts: {
      PLACED: number;
      SHIPPING_ON_TIME: number;
      SHIPPING_DELAYED: number;
      ARRIVED: number;
      LOST: number;
      DAMAGED: number;
      UNDELIVERABLE: number;
      RETURN_TO_SENDER: number;
    };
    totalOrders: number;
    onTimeDeliveries: number;         // ARRIVED within estimatedDelivery
    onTimePercentage: number;         // onTimeDeliveries / totalDelivered * 100
    issueCount: number;               // LOST + DAMAGED + UNDELIVERABLE + RTS
    avgDeliveryTime?: number;         // In hours
    reliabilityScore: number;         // (ARRIVED / total completed) * 100
  };
  previous7d: {
    statusCounts: {
      PLACED: number;
      SHIPPING_ON_TIME: number;
      SHIPPING_DELAYED: number;
      ARRIVED: number;
      LOST: number;
      DAMAGED: number;
      UNDELIVERABLE: number;
      RETURN_TO_SENDER: number;
    };
    totalOrders: number;
    onTimeDeliveries: number;
    onTimePercentage: number;
    issueCount: number;
    avgDeliveryTime?: number;
    reliabilityScore: number;
  };
  trends: {
    reliabilityScoreDelta: number;    // current - previous
    volumeDelta: number;              // current - previous
    onTimePercentageDelta: number;    // current - previous
    issueCountDelta: number;          // current - previous
    trendDirection: 'up' | 'down' | 'stable';
  };
  updatedAt: string;                  // ISO timestamp
  ttl?: number;                       // TTL for 6-month retention
}
```

### Dashboard Summary Table
**Table Name**: `goody-dashboard-summary`
**Partition Key**: `summaryId` (string, always "DAILY_SUMMARY")
**Sort Key**: `date` (string, YYYY-MM-DD format)

**Schema**:
```typescript
interface DashboardSummary {
  summaryId: string;                  // Partition Key: "DAILY_SUMMARY"
  date: string;                       // Sort Key (YYYY-MM-DD)
  current7d: {
    overallReliability: number;       // Weighted average across all vendors
    totalActiveOrders: number;        // Non-terminal orders
    totalDelayedOrders: number;       // Orders past estimated delivery
    atRiskVendors: number;            // Vendors with reliability < 85%
  };
  previous7d: {
    overallReliability: number;
    totalActiveOrders: number;
    totalDelayedOrders: number;
    atRiskVendors: number;
  };
  trends: {
    reliabilityTrend: number;         // Percentage change
    activeOrdersTrend: number;        // Absolute change
    delayedOrdersTrend: number;       // Absolute change
    atRiskVendorsTrend: number;       // Absolute change
  };
  topPerformingVendors: string[];     // vendorIds of top 3 performers
  underperformingVendors: string[];   // vendorIds with reliability < 80%
  updatedAt: string;                  // ISO timestamp
  ttl?: number;                       // TTL for 6-month retention
}
```

### Vendors Table
**Table Name**: `goody-vendors`
**Partition Key**: `vendorId` (string)

**Schema**:
```typescript
interface Vendor {
  vendorId: string;                   // Partition Key
  name: string;
  category: string;                   // "flowers" | "tech" | "food" | "apparel"
  baseReliability: number;            // Starting reliability for backfill (0.7-0.98)
  avgOrderValue: number;              // For realistic data generation (in cents)
  isActive: boolean;
  metadata: {
    contractStartDate: string;        // ISO timestamp
    supportContact: string;
    slaPromises: {
      standardDelivery: number;       // Days
      rushDelivery: number;           // Days
    };
  };
  createdAt: string;                  // ISO timestamp
  updatedAt: string;                  // ISO timestamp
}
```

### Access Patterns

**Orders Table**:
- Get order by ID: Query by `orderId`
- Get orders by vendor: Query GSI1 by `vendorId`
- Get orders by status: Query GSI2 by `status`
- Get orders by vendor and date range: Query GSI1 by `vendorId` with `createdAt` range

**Reports Table**:
- Get vendor report: Query by `vendorId` and `date`
- Get all vendors for date: Query by `date` (requires scan with filter)

**Dashboard Summary Table**:
- Get dashboard summary: Query by `summaryId = "DAILY_SUMMARY"` and `date`

**Vendors Table**:
- Get vendor details: Query by `vendorId`
- Get all vendors: Scan table (small dataset)

### Data Retention (TTL)
- **Orders**: 30 days (TTL field set to createdAt + 30 days)
- **Reports**: 6 months (TTL field set to date + 6 months)
- **Dashboard Summary**: 6 months (TTL field set to date + 6 months)
- **Vendors**: No TTL (persistent master data)

## Health Check

### GET /health
**Purpose**: System health and dependency validation

**Request**: No parameters

**Response**:
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    dynamodb: 'pass' | 'fail';
    eventbridge: 'pass' | 'fail';
    dataFreshness: 'pass' | 'fail';  // Last update < 10 minutes ago
    reportGeneration: 'pass' | 'fail';
  };
  dataFreshness: {
    lastOrderUpdate: string;     // ISO timestamp
    lastReportUpdate: string;    // ISO timestamp
    minutesSinceLastUpdate: number;
  };
  systemMetrics: {
    ordersLast24h: number;
    reportsGenerated: number;
    avgResponseTime: number;     // Milliseconds
  };
  issues: string[];              // Human-readable issue descriptions
  timestamp: string;             // ISO timestamp
  version: string;               // Package version
  uptime: number;               // Seconds since deployment
}
```

## Dashboard Summary

### GET /dashboard/summary
**Purpose**: Main dashboard overview data (alias for /api/dashboard)

**Query Parameters**:
```typescript
{
  date?: string;  // YYYY-MM-DD, defaults to today
}
```

**Response**:
```typescript
{
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    dataFreshness: 'fresh' | 'stale' | 'critical';
    lastUpdateMinutesAgo: number;
    issues: string[];
  };
  current: {
    overallReliability: number;      // Percentage 0-100
    totalActiveOrders: number;       // Non-terminal orders
    totalDelayedOrders: number;      // Orders past estimated delivery
    atRiskVendors: number;          // Vendors with reliability < 85%
  };
  previous: {
    overallReliability: number;
    totalActiveOrders: number;
    totalDelayedOrders: number;
    atRiskVendors: number;
  };
  trends: {
    reliabilityTrend: number;        // Percentage change
    activeOrdersTrend: number;       // Absolute change
    delayedOrdersTrend: number;      // Absolute change
    atRiskVendorsTrend: number;      // Absolute change
  };
  topPerformingVendors: string[];    // vendorIds of top 3 performers
  underperformingVendors: string[];  // vendorIds with reliability < 80%
}
```

### GET /api/dashboard
**Purpose**: Main dashboard overview data (primary endpoint)
**Response**: Same as /dashboard/summary

## Vendor Operations

### GET /vendors
**Purpose**: List all vendors with performance summary

**Query Parameters**:
```typescript
{
  date?: string;        // YYYY-MM-DD, defaults to today
  limit?: number;       // default 20, max 100
  sortBy?: 'reliability' | 'volume' | 'issues';
  order?: 'asc' | 'desc';
}
```

**Response**:
```typescript
{
  vendors: Array<{
    vendorId: string;
    name: string;
    category: string;                    // "flowers" | "tech" | "food" | "apparel"
    reliabilityScore: number;            // 0-100
    totalOrders: number;                 // Last 7 days
    onTimePercentage: number;            // 0-100
    issueCount: number;                  // LOST + DAMAGED + UNDELIVERABLE + RTS
    trend: 'up' | 'down' | 'stable';     // Based on 7d vs previous 7d
    trendPercentage: number;             // Numeric change
    riskLevel: 'low' | 'medium' | 'high'; // Based on reliability thresholds
  }>;
  pagination: {
    total: number;
    hasMore: boolean;
  };
}
```

### GET /api/vendors/{vendorId}/report
**Purpose**: Detailed vendor performance report

**Path Parameters**:
- `vendorId`: string - Vendor identifier

**Query Parameters**:
```typescript
{
  date?: string;  // YYYY-MM-DD, defaults to today
}
```

**Response**:
```typescript
{
  vendor: {
    vendorId: string;
    name: string;
    category: string;
  };
  report: {
    vendorId: string;
    date: string;                        // YYYY-MM-DD
    current7d: {
      statusCounts: {
        PLACED: number;
        SHIPPING_ON_TIME: number;
        SHIPPING_DELAYED: number;
        ARRIVED: number;
        LOST: number;
        DAMAGED: number;
        UNDELIVERABLE: number;
        RETURN_TO_SENDER: number;
      };
      totalOrders: number;
      onTimeDeliveries: number;
      onTimePercentage: number;
      issueCount: number;
      avgDeliveryTime?: number;          // In hours
      reliabilityScore: number;          // 0-100
    };
    previous7d: {
      // Same structure as current7d
    };
    trends: {
      reliabilityScoreDelta: number;
      volumeDelta: number;
      onTimePercentageDelta: number;
      issueCountDelta: number;
      trendDirection: 'up' | 'down' | 'stable';
    };
    updatedAt: string;                   // ISO timestamp
  };
  recentIssues: Array<{
    orderId: string;
    status: OrderStatus;
    occurredAt: string;                  // ISO timestamp
    description: string;
  }>;
}
```

## Order Operations

### GET /api/orders
**Purpose**: List orders with filtering and pagination

**Query Parameters**:
```typescript
{
  vendorId?: string;
  status?: OrderStatus;
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
  limit?: number;      // default 50, max 100
  cursor?: string;     // base64-encoded pagination cursor
}
```

**Response**:
```typescript
{
  orders: Array<{
    orderId: string;
    vendorId: string;
    status: OrderStatus;
    createdAt: string;
    updatedAt: string;
    estimatedDelivery?: string;
    actualDelivery?: string;
    giftValue: number;               // In cents
    giftType: string;
    isRush: boolean;
    isDelayed: boolean;
    deliveryDays?: number;
    isBackfilled?: boolean;
  }>;
  nextCursor?: string;               // base64-encoded cursor for next page
  hasMore: boolean;
  summary: {
    total: number;                   // Count of orders in current page
    statusBreakdown: Record<OrderStatus, number>;
  };
}
```

### GET /api/orders/recent
**Purpose**: Get most recently updated orders across all vendors

**Query Parameters**:
```typescript
{
  limit?: number;      // default 50, max 100
  cursor?: string;     // base64-encoded pagination cursor
  hours?: number;      // default 24, max 168 (7 days) - filter by hours since update
}
```

**Response**:
```typescript
{
  recentActivity: {
    updatesLastHour: number;         // Count of orders updated in last hour
    statusChanges: number;           // Count of status changes in last hour
    issuesReported: number;          // Count of problem statuses in last hour
    arrivalsConfirmed: number;       // Count of ARRIVED status in last hour
  };
  orders: Array<{
    orderId: string;
    vendorId: string;
    vendorName?: string;             // Denormalized for display (if available)
    status: OrderStatus;
    previousStatus?: OrderStatus;    // If status changed, show previous
    createdAt: string;
    updatedAt: string;               // Primary sort field (DESC)
    estimatedDelivery?: string;
    actualDelivery?: string;
    giftValue: number;               // In cents
    giftType: string;
    isRush: boolean;
    isDelayed: boolean;
    deliveryDays?: number;
    isBackfilled?: boolean;
    updateType: 'status_change' | 'new_order' | 'delivery_update' | 'issue_reported';
    updateDescription?: string;      // Human-readable update description
  }>;
  nextCursor?: string;               // base64-encoded cursor for next page
  hasMore: boolean;
  summary: {
    totalRecentUpdates: number;
    timeRangeHours: number;
    statusBreakdown: Record<OrderStatus, number>;
    updateTypeBreakdown: {
      status_change: number;
      new_order: number;
      delivery_update: number;
      issue_reported: number;
    };
  };
}
```

## Data Types

### OrderStatus
```typescript
type OrderStatus = 
  | 'PLACED' 
  | 'SHIPPING_ON_TIME' 
  | 'SHIPPING_DELAYED' 
  | 'ARRIVED'           // Terminal
  | 'LOST'              // Terminal
  | 'DAMAGED'           // Terminal
  | 'UNDELIVERABLE'     // Terminal
  | 'RETURN_TO_SENDER'; // Terminal
```

### Error Responses
All endpoints return consistent error format:
```typescript
{
  error: {
    code: string;        // Error code
    message: string;     // Human-readable message
    details?: any;       // Additional error context
  };
  correlationId: string; // For tracing
  timestamp: string;     // ISO timestamp
}
```

## CORS Configuration
All endpoints include CORS headers for frontend access:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Correlation-ID