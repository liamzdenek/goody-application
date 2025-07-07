# Goody Third-Party Gift Fulfillment Health Dashboard

## Project Overview

This dashboard provides real-time visibility into vendor fulfillment performance, helping Goody's operations team identify issues before they impact customer experience. The system generates realistic order lifecycle data with historical backfill and provides actionable insights on vendor reliability trends.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │    │   API Gateway   │    │   Lambda Fns    │
│   + S3 (React)  │◄──►│                 │◄──►│                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
        ┌───────────────┐    ┌─────────────────┐       │
        │  EventBridge  │◄──►│   DynamoDB      │◄──────┘
        │  (Scheduler)  │    │   - Orders      │
        └───────────────┘    │   - Reports     │
                             │   - Streams     │
                             └─────────────────┘
```

## Database Schema

### Orders Table
```typescript
interface Order {
  orderId: string;                    // Partition Key: "ORD-{timestamp}-{random}"
  vendorId: string;                   // GSI1 Partition Key
  status: OrderStatus;                // GSI2 Partition Key (for status queries)
  createdAt: string;                  // ISO timestamp, GSI1 Sort Key
  updatedAt: string;                  // ISO timestamp
  estimatedDelivery?: string;         // ISO timestamp
  actualDelivery?: string;            // ISO timestamp
  giftValue: number;                  // In cents
  giftType: string;                   // "flowers" | "tech" | "food" | "apparel"
  isRush: boolean;
  // Calculated fields for easy querying
  isDelayed: boolean;                 // updatedAt > estimatedDelivery
  deliveryDays?: number;              // Days from created to delivered
  // Backfill metadata
  isBackfilled?: boolean;             // Track if this is historical data
}

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

### Reports Table
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
    reliabilityScore: number;         // 0-100 weighted score
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
  // Computed trend data
  trends: {
    reliabilityScoreDelta: number;    // current - previous
    volumeDelta: number;              // current - previous
    onTimePercentageDelta: number;    // current - previous
    issueCountDelta: number;          // current - previous
    trendDirection: 'up' | 'down' | 'stable';
  };
  updatedAt: string;                  // ISO timestamp
}

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
  updatedAt: string;
}
```

### Vendor Master Data
```typescript
interface Vendor {
  vendorId: string;                   // Partition Key
  name: string;
  category: string;                   // "flowers" | "tech" | "food" | "apparel"
  baseReliability: number;            // Starting reliability for backfill
  avgOrderValue: number;              // For realistic data generation
  isActive: boolean;
  metadata: {
    contractStartDate: string;
    supportContact: string;
    slaPromises: {
      standardDelivery: number;       // Days
      rushDelivery: number;           // Days
    };
  };
}
```

## API Contracts

### REST API Endpoints

#### GET /dashboard/summary
```typescript
QueryParams: {
  date?: string;  // YYYY-MM-DD, defaults to today
}

Response: {
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    dataFreshness: 'fresh' | 'stale' | 'critical';
    lastUpdateMinutesAgo: number;
    issues: string[];
  };
  current: {
    overallReliability: number;
    totalActiveOrders: number;
    totalDelayedOrders: number;
    atRiskVendors: number;
  };
  previous: {
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
  topPerformingVendors: string[];
  underperformingVendors: string[];
}
```

#### GET /vendors
```typescript
QueryParams: {
  date?: string;     // YYYY-MM-DD, defaults to today
  limit?: number;    // default 20, max 100
  sortBy?: 'reliability' | 'volume' | 'issues';
  order?: 'asc' | 'desc';
}

Response: {
  vendors: Array<{
    vendorId: string;
    name: string;
    category: string;
    reliabilityScore: number;
    totalOrders: number;
    onTimePercentage: number;
    issueCount: number;
    trend: 'up' | 'down' | 'stable';      // Based on 7d vs previous 7d
    trendPercentage: number;              // Numeric change
    riskLevel: 'low' | 'medium' | 'high'; // Based on reliability thresholds
  }>;
  pagination: {
    total: number;
    hasMore: boolean;
  };
}
```

#### GET /vendors/{vendorId}/report
```typescript
QueryParams: {
  date?: string;  // YYYY-MM-DD, defaults to today
}

Response: {
  vendor: {
    vendorId: string;
    name: string;
    category: string;
  };
  report: VendorReport;  // Contains both current, previous, and trends
  recentIssues: Array<{
    orderId: string;
    status: OrderStatus;
    occurredAt: string;
    description: string;
  }>;
}
```

#### GET /orders
```typescript
QueryParams: {
  vendorId?: string;
  status?: OrderStatus;
  dateFrom?: string;   // YYYY-MM-DD
  dateTo?: string;     // YYYY-MM-DD
  limit?: number;      // default 50, max 100
  cursor?: string;     // for pagination
}

Response: {
  orders: Order[];
  nextCursor?: string;
  hasMore: boolean;
  summary: {
    total: number;
    statusBreakdown: Record<OrderStatus, number>;
  };
}
```

#### GET /health
```typescript
Response: {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    dynamodb: 'pass' | 'fail';
    eventbridge: 'pass' | 'fail';
    dataFreshness: 'pass' | 'fail';  // Last update < 10 minutes ago
    reportGeneration: 'pass' | 'fail';  // Report generator functioning
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
  timestamp: string;
  version: string;
  uptime: number;               // Seconds since deployment
}
```

## Lambda Functions

### 1. Data Backfill (`dataBackfill`)
- **Trigger**: Manual invoke or EventBridge (one-time)
- **Function**: Creates 21 days of historical data
- **Logic**: 
  - Generate realistic vendor performance patterns
  - Create daily variations in order volume
  - Simulate realistic issue patterns and recovery
  - Ensure data supports meaningful trend analysis

### 2. Order Simulator (`orderSimulator`)
- **Trigger**: EventBridge (every 5 minutes)
- **Function**: Creates random order updates or new orders
- **Logic**: 
  - Count non-terminal orders
  - If < 100 orders, 40% chance to create new order
  - Otherwise, update random existing order status
  - Respect realistic status transitions

### 3. Report Generator (`reportGenerator`)
- **Trigger**: DynamoDB Stream on Orders table
- **Function**: Updates vendor reports and dashboard summary
- **Logic**:
  - Calculate 7-day rolling window metrics
  - Update reliability scores using weighted algorithm
  - Generate dashboard summary metrics
  - Atomic upsert to reports table

### 4. API Handler (`apiHandler`)
- **Trigger**: API Gateway
- **Function**: Serves REST API endpoints
- **Features**:
  - Request/response logging with correlation IDs
  - Error handling with proper HTTP codes
  - CORS headers for frontend
  - Response caching for frequently accessed data

## Backfill Strategy

### Data Generation Approach
1. **Vendor Profiles**: Create 8-12 vendors with varying reliability patterns
2. **Historical Orders**: Generate 21 days of orders with realistic patterns:
   - Business day peaks (Monday-Friday higher volume)
   - Holiday spikes and dips
   - Vendor-specific performance characteristics
   - Seasonal gift type preferences

### Realistic Data Patterns
```typescript
interface BackfillConfig {
  vendors: Array<{
    vendorId: string;
    name: string;
    category: string;
    baseReliability: number;      // 0.7-0.98
    reliabilityTrend: 'improving' | 'declining' | 'stable';
    orderVolumePattern: 'high' | 'medium' | 'low';
    commonIssues: OrderStatus[];  // Vendor-specific common issues
  }>;
  orderPatterns: {
    dailyVolumeRange: [number, number];     // Min/max orders per day
    businessDayMultiplier: number;          // 1.5x volume on weekdays
    weekendMultiplier: number;              // 0.6x volume on weekends
    rushOrderPercentage: number;            // 15% are rush orders
    giftTypeDistribution: {                 // Realistic gift type spread
      flowers: 0.25;
      tech: 0.30;
      food: 0.30;
      apparel: 0.15;
    };
  };
}
```

### Backfill Execution
```typescript
// Sample backfill data generation
const generateBackfillData = async () => {
  const vendors = [
    { vendorId: 'vendor-001', name: 'Premium Flowers', baseReliability: 0.95, trend: 'stable' },
    { vendorId: 'vendor-002', name: 'Gourmet Baskets', baseReliability: 0.92, trend: 'improving' },
    { vendorId: 'vendor-003', name: 'Tech Gadgets Co', baseReliability: 0.87, trend: 'declining' },
    { vendorId: 'vendor-004', name: 'Artisan Goods', baseReliability: 0.83, trend: 'stable' },
    { vendorId: 'vendor-005', name: 'Fast Fashion', baseReliability: 0.72, trend: 'declining' },
  ];

  // Generate 21 days of historical data
  for (let day = -21; day <= 0; day++) {
    const date = new Date();
    date.setDate(date.getDate() + day);
    
    // Generate 50-200 orders per day with weekend/weekday patterns
    const orderCount = calculateDailyOrderCount(date);
    
    for (let i = 0; i < orderCount; i++) {
      await createBackfilledOrder(date, vendors);
    }
  }
};
```

## Frontend Design (ASCII Mockups)

### Dashboard Overview
```
┌─────────────────────────────────────────────────────────────────────┐
│ GOODY FULFILLMENT HEALTH DASHBOARD                    Last: 2min ago │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │
│ │   OVERALL   │ │   ACTIVE    │ │   DELAYED   │ │  AT RISK    │     │
│ │ RELIABILITY │ │   ORDERS    │ │   ORDERS    │ │  VENDORS    │     │
│ │    94.2%    │ │     847     │ │     23      │ │      3      │     │
│ │   ↑ +2.1%   │ │   ↑ +156    │ │   ↓ -5      │ │   → same    │     │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘     │
│                                                                     │
│ VENDOR PERFORMANCE (Last 7 Days)              [↻] [⚙] [📊] [📤]     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Vendor Name        │ Score │ Orders │ On Time │ Issues │ Trend │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ 🟢 Premium Flowers  │  98%  │   234  │   98%   │    2   │ ↗ +1% │ │
│ │ 🟢 Gourmet Baskets  │  95%  │   189  │   94%   │    8   │ ↗ +3% │ │
│ │ 🟡 Tech Gadgets Co  │  87%  │   145  │   89%   │   16   │ ↘ -8% │ │
│ │ 🟡 Artisan Goods    │  83%  │    67  │   81%   │   12   │ ↘ -5% │ │
│ │ 🔴 Fast Fashion     │  72%  │    23  │   70%   │    7   │ ↘-12% │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [View All Vendors] [Export Report] [Alert Settings]                │
└─────────────────────────────────────────────────────────────────────┘
```

### Vendor Detail View
```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back  TECH GADGETS CO - PERFORMANCE DETAIL                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │
│ │ RELIABILITY │ │ AVG DELIVERY│ │ ACTIVE      │ │ ISSUE RATE  │     │
│ │ SCORE       │ │ TIME        │ │ ORDERS      │ │             │     │
│ │    87%      │ │   3.2 days  │ │     145     │ │    11%      │     │
│ │   ↘ -8%     │ │  ↗ +0.3d    │ │   ↑ +12     │ │   ↗ +3%     │     │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘     │
│                                                                     │
│ STATUS BREAKDOWN (Last 7 Days)                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ████████████████████████████████████████ ARRIVED      102 (70%) │ │
│ │ ████████████ SHIPPING_ON_TIME               27 (19%)            │ │
│ │ ████ SHIPPING_DELAYED                        9 (6%)             │ │
│ │ ██ PLACED                                    4 (3%)             │ │
│ │ █ LOST                                       2 (1%)             │ │
│ │ █ DAMAGED                                    1 (1%)             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ RECENT ISSUES (Last 24 Hours)                  [View All Issues]   │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ORD-78234  │ DAMAGED     │ 2 hrs ago │ Package damaged in transit│ │
│ │ ORD-78001  │ LOST        │ 4 hrs ago │ Tracking shows no updates │ │
│ │ ORD-77856  │ DELAYED     │ 6 hrs ago │ Weather delay - Chicago   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [Contact Vendor] [View All Orders] [Performance History]           │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Backfill Process
```
Manual Trigger → Data Backfill Lambda
                      ↓
              [Generate 21 days history]
                      ↓
              Batch write to Orders Table
                      ↓
              DynamoDB Stream triggers
                      ↓
              Report Generator Lambda
                      ↓
              Historical Reports created
```

### Real-time Operations
```
EventBridge (5min) → Order Simulator Lambda
                           ↓
                    DynamoDB Orders Table
                           ↓
                    DynamoDB Stream
                           ↓
                    Report Generator Lambda
                           ↓
                    Reports + Dashboard Summary
                           ↓
                    API Gateway ← React Frontend
```
