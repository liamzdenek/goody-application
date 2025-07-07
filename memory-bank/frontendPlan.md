# Frontend Implementation Plan

## Overview
Implement the Goody Third-Party Gift Fulfillment Health Dashboard frontend using React, TanStack Router, and CSS modules following the Dropbox design principles outlined in the UI mockups.

## Architecture Decisions

### Technology Stack
- **React 18**: Modern React with hooks and functional components
- **TanStack Router**: Explicitly chosen over React Router (per .clinerules)
- **CSS Modules**: No Tailwind or frameworks (per .clinerules)
- **TypeScript**: Full type safety with shared types from `@goody/shared`
- **Vite**: Already configured for fast development

### Design System
- **Dropbox Style**: Flat design, transparent buttons with thick black borders
- **Color Strategy**: Bold/vibrant colors mixed with pastels
- **Manual Refresh**: User-controlled data updates, no auto-refresh
- **System Health**: Prominently displayed on main dashboard

## Implementation Structure

### 1. Core Infrastructure Setup

#### Router Configuration
```typescript
// src/router.tsx
import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardOverview,
})

const vendorDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vendors/$vendorId',
  component: VendorDetail,
})

const recentOrdersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/recent',
  component: RecentOrders,
})

const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  component: OrderList,
})
```

#### API Client
```typescript
// src/services/api.ts
class ApiClient {
  private baseUrl = 'https://6q0ywxpbhh.execute-api.us-west-2.amazonaws.com/prod'
  
  async getDashboardSummary(): Promise<DashboardSummary>
  async getVendors(): Promise<VendorListResponse>
  async getVendorReport(vendorId: string): Promise<VendorReportResponse>
  async getOrders(params: OrderQueryParams): Promise<OrderListResponse>
  async getRecentOrders(params: RecentOrderParams): Promise<RecentOrderResponse>
}
```

### 2. Component Architecture

#### Layout Components
- **RootLayout**: Header, navigation, refresh controls
- **MetricCard**: Reusable metric display with trends
- **DataTable**: Sortable, filterable table component
- **StatusIndicator**: Color-coded status badges
- **TrendIndicator**: Arrow icons with percentage changes
- **SystemHealthBanner**: Prominent system health display

#### Page Components
- **DashboardOverview**: Main dashboard with system health
- **VendorDetail**: Individual vendor performance
- **RecentOrders**: Activity feed with metrics
- **OrderList**: Comprehensive order browsing

### 3. State Management

#### Data Fetching Strategy
```typescript
// Custom hooks for data fetching
const useDashboardData = () => {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const refresh = useCallback(async () => {
    // Manual refresh implementation
  }, [])
  
  return { data, loading, error, refresh }
}
```

#### Manual Refresh Pattern
- No automatic polling or real-time updates
- Explicit refresh buttons on each page
- Loading states during data fetching
- Error handling with user feedback

### 4. Design System Implementation

#### CSS Module Structure
```css
/* components/MetricCard.module.css */
.card {
  background: white;
  border: none;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 1.5rem;
  border-radius: 8px;
}

.button {
  background: transparent;
  border: 3px solid black;
  padding: 0.75rem 1.5rem;
  font-weight: bold;
  cursor: pointer;
}

.statusGreen { color: #22c55e; }
.statusYellow { color: #eab308; }
.statusRed { color: #ef4444; }
```

#### Color Coding System
- 🟢 **Green**: ARRIVED, SHIPPING_ON_TIME, good metrics
- 🟡 **Yellow**: DELAYED, medium risk, declining trends  
- 🔴 **Red**: LOST, DAMAGED, high risk, poor performance
- **Gray**: PLACED, stable trends

### 5. Page Implementation Details

#### Dashboard Overview (`/`)
**Key Features:**
- **System Health Section**: Prominently display system status, data freshness, and issues
- **Four Metric Cards**: Overall reliability, active orders, delayed orders, at-risk vendors
- **Vendor Performance Table**: Sortable table with color-coded status indicators
- **Action Buttons**: Refresh, Recent Updates, Export Report, Alert Settings

**System Health Integration:**
```typescript
interface SystemHealthDisplay {
  status: 'healthy' | 'degraded' | 'unhealthy'
  dataFreshness: 'fresh' | 'stale' | 'critical'
  lastUpdateMinutesAgo: number
  issues: string[]
}

// System Health Banner Component
const SystemHealthBanner = ({ health }: { health: SystemHealthDisplay }) => {
  const statusColor = health.status === 'healthy' ? 'green' : 
                     health.status === 'degraded' ? 'yellow' : 'red'
  
  return (
    <div className={`healthBanner ${statusColor}`}>
      <div className="healthStatus">
        System Status: {health.status.toUpperCase()}
      </div>
      <div className="dataFreshness">
        Data: {health.dataFreshness} (Updated {health.lastUpdateMinutesAgo}min ago)
      </div>
      {health.issues.length > 0 && (
        <div className="issues">
          Issues: {health.issues.join(', ')}
        </div>
      )}
    </div>
  )
}
```

#### Vendor Detail (`/vendors/{vendorId}`)
**Key Features:**
- **Four Vendor Metrics**: Reliability score, avg delivery time, active orders, issue rate
- **Status Breakdown**: Horizontal bar chart showing order status distribution
- **Recent Issues**: Table of recent problems with timestamps
- **Action Buttons**: Contact vendor, view orders, performance history

#### Recent Orders (`/orders/recent`)
**Key Features:**
- **Activity Metrics**: Updates last hour, status changes, issues reported, arrivals confirmed
- **Live Activity Feed**: Most recently updated orders across all vendors
- **Color-coded Status**: Quick visual scanning of order states
- **Filter Controls**: Status and vendor filtering

#### Order List (`/orders`)
**Key Features:**
- **Comprehensive Filtering**: Vendor, status, date range filters
- **Sortable Columns**: Order ID, vendor, status, created, updated
- **Cursor Pagination**: Handle large datasets efficiently
- **Export Functions**: CSV and JSON export capabilities

### 6. Implementation Phases

#### Phase 1: Core Infrastructure (Day 1)
- [ ] Setup TanStack Router configuration
- [ ] Create API client with TypeScript integration
- [ ] Implement base layout and navigation
- [ ] Create reusable component library (MetricCard, DataTable, etc.)
- [ ] Implement SystemHealthBanner component

#### Phase 2: Dashboard Overview (Day 2)
- [ ] Implement main dashboard page with system health banner
- [ ] Create metric cards with trend indicators
- [ ] Build vendor performance table
- [ ] Add manual refresh functionality
- [ ] Integrate system health display prominently

#### Phase 3: Vendor Detail Page (Day 3)
- [ ] Implement vendor detail view
- [ ] Create status breakdown visualization
- [ ] Build recent issues table
- [ ] Add vendor-specific actions

#### Phase 4: Order Pages (Day 4)
- [ ] Implement recent orders activity feed
- [ ] Create comprehensive order list view
- [ ] Add filtering and pagination
- [ ] Implement export functionality

#### Phase 5: Polish & Testing (Day 5)
- [ ] Apply Dropbox design system consistently
- [ ] Add loading states and error handling
- [ ] Implement responsive design
- [ ] Test all API integrations
- [ ] Validate system health display functionality

### 7. Technical Specifications

#### API Integration
- **Base URL**: `https://6q0ywxpbhh.execute-api.us-west-2.amazonaws.com/prod`
- **CORS**: Already configured in backend
- **Error Handling**: Use correlation IDs for debugging
- **Type Safety**: Import all types from `@goody/shared`

#### System Health API Integration
```typescript
// Dashboard API returns system health in response
interface DashboardSummaryResponse {
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    dataFreshness: 'fresh' | 'stale' | 'critical'
    lastUpdateMinutesAgo: number
    issues: string[]
  }
  current: { /* metrics */ }
  previous: { /* metrics */ }
  trends: { /* trends */ }
  // ... other fields
}
```

#### Performance Considerations
- **Pagination**: Use base64-encoded cursors for stateless pagination
- **Caching**: Implement simple in-memory caching for frequently accessed data
- **Loading States**: Show skeleton screens during data fetching
- **Error Boundaries**: Graceful error handling with user feedback

#### Responsive Design
- **Mobile**: Stack metric cards vertically, simplify tables
- **Tablet**: Reduce table columns, use abbreviations
- **Desktop**: Full layout with optimal information density

### 8. File Structure

```
packages/frontend/src/
├── app/
│   ├── app.tsx                 # Main app component
│   └── app.module.css          # Global styles
├── components/
│   ├── layout/
│   │   ├── RootLayout.tsx
│   │   ├── RootLayout.module.css
│   │   ├── SystemHealthBanner.tsx
│   │   └── SystemHealthBanner.module.css
│   ├── ui/
│   │   ├── MetricCard.tsx
│   │   ├── MetricCard.module.css
│   │   ├── DataTable.tsx
│   │   ├── DataTable.module.css
│   │   ├── StatusIndicator.tsx
│   │   ├── StatusIndicator.module.css
│   │   ├── TrendIndicator.tsx
│   │   └── TrendIndicator.module.css
│   └── charts/
│       ├── StatusBreakdown.tsx
│       └── StatusBreakdown.module.css
├── pages/
│   ├── DashboardOverview.tsx
│   ├── DashboardOverview.module.css
│   ├── VendorDetail.tsx
│   ├── VendorDetail.module.css
│   ├── RecentOrders.tsx
│   ├── RecentOrders.module.css
│   ├── OrderList.tsx
│   └── OrderList.module.css
├── services/
│   ├── api.ts
│   └── types.ts
├── hooks/
│   ├── useDashboardData.ts
│   ├── useVendorData.ts
│   └── useOrderData.ts
├── utils/
│   ├── formatters.ts
│   └── constants.ts
├── router.tsx
└── main.tsx
```

This comprehensive plan ensures the frontend implementation will:
1. **Prominently display system health** on the main dashboard as requested
2. **Follow established design principles** from the UI mockups
3. **Integrate seamlessly** with the validated backend APIs
4. **Provide manual refresh control** as specified in requirements
5. **Use the correct technology stack** per project constraints