# UI Mockups

## Design Principles
- **Dropbox Design Style**: Flat design, no borders, no 3D effects
- **Button Style**: Transparent buttons with thick black borders showing background color
- **Color Strategy**: Bold and vibrant colors mixed with pastels
- **Data Density**: Maximize information display while maintaining readability
- **Manual Control**: Users control refresh timing with explicit buttons

## Page Structure
All pages follow consistent layout patterns:
- Header with navigation and refresh controls
- Main content area with card-based metrics
- Data tables with clear status indicators
- Action buttons with transparent styling

---

## Dashboard Overview
**Route**: `/` (Root dashboard)
**Purpose**: High-level system health and vendor performance summary

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
│ [View All Vendors] [Recent Updates] [Export Report] [Alert Settings]│
└─────────────────────────────────────────────────────────────────────┘
```

**Key Elements**:
- Four metric cards showing overall system health
- Vendor performance table with color-coded status indicators
- Action buttons: refresh, settings, charts, export
- New "Recent Updates" button for order activity

---

## Vendor Detail View
**Route**: `/vendors/{vendorId}`
**Purpose**: Detailed performance analysis for specific vendor

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

**Key Elements**:
- Four vendor-specific metric cards
- Visual status breakdown with horizontal bar chart
- Recent issues table with timestamps
- Action buttons for vendor management

---

## Recent Order Updates
**Route**: `/orders/recent`
**Purpose**: Show most recently updated orders across all vendors

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back  RECENT ORDER UPDATES                          [↻] Refresh   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │
│ │  UPDATES    │ │   STATUS    │ │  ISSUES     │ │  ARRIVALS   │     │
│ │ LAST HOUR   │ │ CHANGES     │ │ REPORTED    │ │ CONFIRMED   │     │
│ │     47      │ │     23      │ │      8      │ │     15      │     │
│ │   ↑ +12     │ │   ↑ +7      │ │   ↓ -2      │ │   ↑ +6      │     │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘     │
│                                                                     │
│ RECENT ORDER ACTIVITY (Last 50 Updates)        [Filter] [Export]   │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Order ID    │ Vendor         │ Status        │ Updated │ Action │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ ORD-78892   │ Premium Flow.  │ 🟢 ARRIVED    │ 1min ago│ [View] │ │
│ │ ORD-78891   │ Tech Gadgets   │ 🟡 DELAYED    │ 2min ago│ [View] │ │
│ │ ORD-78889   │ Gourmet Bask.  │ 🟢 SHIPPING   │ 3min ago│ [View] │ │
│ │ ORD-78885   │ Fast Fashion   │ 🔴 DAMAGED    │ 5min ago│ [View] │ │
│ │ ORD-78883   │ Artisan Goods  │ 🟢 ARRIVED    │ 7min ago│ [View] │ │
│ │ ORD-78881   │ Premium Flow.  │ 🟡 DELAYED    │ 8min ago│ [View] │ │
│ │ ORD-78878   │ Tech Gadgets   │ 🟢 SHIPPING   │ 12min ago│[View] │ │
│ │ ORD-78876   │ Gourmet Bask.  │ 🔴 LOST       │ 15min ago│[View] │ │
│ │ ORD-78874   │ Fast Fashion   │ 🟢 ARRIVED    │ 18min ago│[View] │ │
│ │ ORD-78871   │ Artisan Goods  │ 🟡 DELAYED    │ 22min ago│[View] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [Load More Updates] [Filter by Status] [Filter by Vendor]          │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Elements**:
- Four metric cards showing recent activity statistics
- Live activity feed sorted by `updatedAt` timestamp
- Color-coded status indicators for quick scanning
- Vendor name truncation for table layout
- Individual order view links
- Filter and pagination controls

---

## Order List View
**Route**: `/orders`
**Purpose**: Comprehensive order browsing with filtering

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back  ALL ORDERS                                    [↻] Refresh   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ FILTERS: [All Vendors ▼] [All Status ▼] [Date Range ▼] [Clear]     │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Order ID    │ Vendor       │ Status      │ Created │ Updated    │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ ORD-78892   │ Premium Fl.  │🟢 ARRIVED   │ 3d ago  │ 1min ago  │ │
│ │ ORD-78891   │ Tech Gadg.   │🟡 DELAYED   │ 2d ago  │ 2min ago  │ │
│ │ ORD-78889   │ Gourmet B.   │🟢 SHIPPING  │ 1d ago  │ 3min ago  │ │
│ │ ORD-78885   │ Fast Fash.   │🔴 DAMAGED   │ 5h ago  │ 5min ago  │ │
│ │ ORD-78883   │ Artisan G.   │🟢 ARRIVED   │ 4h ago  │ 7min ago  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Showing 1-50 of 1,247 orders                    [← Prev] [Next →] │ │
│ [Export CSV] [Export JSON]                                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Elements**:
- Filter controls for vendor, status, and date range
- Sortable columns for comprehensive order browsing
- Cursor-based pagination for large datasets
- Export functionality for data analysis

---

## Design System Notes

### Color Coding
- 🟢 **Green**: Positive states (ARRIVED, SHIPPING_ON_TIME, good metrics)
- 🟡 **Yellow**: Warning states (DELAYED, medium risk, declining trends)
- 🔴 **Red**: Problem states (LOST, DAMAGED, high risk, poor performance)
- **Gray**: Neutral states (PLACED, stable trends)

### Typography
- **Headers**: Bold, all caps for section titles
- **Metrics**: Large numbers with trend indicators
- **Data Tables**: Monospace for alignment, readable sizes
- **Status**: Clear, abbreviated status names

### Interactive Elements
- **Buttons**: Transparent background with thick black borders
- **Links**: Underlined, color-coded by action type
- **Cards**: Flat design with subtle shadows for depth
- **Tables**: Hover states for row selection

### Responsive Considerations
- **Mobile**: Stack metric cards vertically
- **Tablet**: Reduce table columns, use abbreviations
- **Desktop**: Full layout with optimal information density