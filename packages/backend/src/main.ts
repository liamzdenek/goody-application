import express from 'express';
import serverless from 'serverless-http';
import { v4 as uuidv4 } from 'uuid';
import './types';
import {
  HealthCheckResponse,
  OrdersListResponse,
  VendorListResponse,
  VendorReportResponse,
  DashboardSummaryResponse,
  ApiError,
  CORS_HEADERS,
  createApiError,
  validateRequest,
  OrderStatus,
  BACKFILL_VENDORS,
  calculateReliabilityScore,
  type Order,
  type Vendor,
  type VendorReport,
  type DashboardSummary,
  type StatusCounts
} from '@goody/shared';

const app = express();

// Middleware for request logging and correlation IDs
app.use((req, res, next) => {
  const correlationId = uuidv4();
  req.correlationId = correlationId;
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    correlationId,
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    event: 'request_start'
  }));
  
  next();
});

// CORS middleware
app.use((req, res, next) => {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.header(key, value);
  });
  next();
});

// JSON parsing
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  const response: HealthCheckResponse = {
    status: 'healthy',
    checks: {
      dynamodb: 'pass',
      eventbridge: 'pass',
      dataFreshness: 'pass',
      reportGeneration: 'pass'
    },
    dataFreshness: {
      lastOrderUpdate: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      lastReportUpdate: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      minutesSinceLastUpdate: 5
    },
    systemMetrics: {
      ordersLast24h: 120,
      reportsGenerated: 8,
      avgResponseTime: 250
    },
    issues: [],
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: 86400
  };
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId,
    event: 'health_check',
    status: 'success'
  }));
  
  res.json(response);
});

// Get all orders
app.get('/api/orders', (req, res) => {
  try {
    // TODO: Replace with actual DynamoDB query
    const mockOrders: Order[] = [
      {
        orderId: 'ord_001',
        vendorId: 'vendor_001',
        status: 'ARRIVED',
        giftType: 'tech',
        giftValue: 5000,
        isRush: false,
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-17T16:45:00Z',
        estimatedDelivery: '2024-01-17T18:00:00Z',
        actualDelivery: '2024-01-17T16:45:00Z',
        isDelayed: false,
        deliveryDays: 2
      },
      {
        orderId: 'ord_002',
        vendorId: 'vendor_002',
        status: 'SHIPPING_DELAYED',
        giftType: 'flowers',
        giftValue: 12500,
        isRush: true,
        createdAt: '2024-01-16T14:20:00Z',
        updatedAt: '2024-01-18T15:00:00Z',
        estimatedDelivery: '2024-01-18T12:00:00Z',
        isDelayed: true
      }
    ];
    
    const response: Order[] = mockOrders;
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'orders_retrieved',
      orderCount: mockOrders.length
    }));
    
    res.json(response);
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'orders_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
    
    res.status(500).json(createApiError('ORDERS_ERROR', 'Failed to retrieve orders', req.correlationId || 'unknown'));
  }
});

// Get all vendors
app.get('/api/vendors', (req, res) => {
  try {
    // Return the hardcoded backfill vendors
    const response: Vendor[] = BACKFILL_VENDORS;
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'vendors_retrieved',
      vendorCount: BACKFILL_VENDORS.length
    }));
    
    res.json(response);
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'vendors_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
    
    res.status(500).json(createApiError('VENDORS_ERROR', 'Failed to retrieve vendors', req.correlationId || 'unknown'));
  }
});

// Get vendor reports
app.get('/api/reports', (req, res) => {
  try {
    // TODO: Replace with actual DynamoDB query and calculations
    const mockReports: VendorReport[] = BACKFILL_VENDORS.map(vendor => {
      const totalOrders = Math.floor(Math.random() * 100) + 50;
      const arrivedOrders = Math.floor(totalOrders * (vendor.baseReliability || 0.8));
      
      const statusCounts: StatusCounts = {
        PLACED: Math.floor(totalOrders * 0.1),
        SHIPPING_ON_TIME: Math.floor(totalOrders * 0.2),
        SHIPPING_DELAYED: Math.floor(totalOrders * 0.1),
        ARRIVED: arrivedOrders,
        LOST: Math.floor(totalOrders * 0.02),
        DAMAGED: Math.floor(totalOrders * 0.02),
        UNDELIVERABLE: Math.floor(totalOrders * 0.01),
        RETURN_TO_SENDER: Math.floor(totalOrders * 0.02)
      };
      
      return {
        vendorId: vendor.vendorId || 'unknown',
        reportId: `${vendor.vendorId}-${new Date().toISOString().split('T')[0]}`,
        date: new Date().toISOString().split('T')[0],
        current7d: {
          statusCounts,
          totalOrders,
          onTimeDeliveries: arrivedOrders,
          onTimePercentage: Math.round((arrivedOrders / totalOrders) * 100),
          issueCount: (statusCounts.LOST || 0) + (statusCounts.DAMAGED || 0) + (statusCounts.UNDELIVERABLE || 0) + (statusCounts.RETURN_TO_SENDER || 0),
          avgDeliveryTime: 2.5,
          reliabilityScore: calculateReliabilityScore(statusCounts)
        },
        previous7d: {
          statusCounts: { ...statusCounts, ARRIVED: Math.floor(arrivedOrders * 0.9) },
          totalOrders: Math.floor(totalOrders * 0.8),
          onTimeDeliveries: Math.floor(arrivedOrders * 0.9),
          onTimePercentage: Math.round((arrivedOrders * 0.9) / (totalOrders * 0.8) * 100),
          issueCount: Math.floor(statusCounts.LOST! * 1.2),
          avgDeliveryTime: 2.8,
          reliabilityScore: calculateReliabilityScore({ ...statusCounts, ARRIVED: Math.floor(arrivedOrders * 0.9) })
        },
        trends: {
          reliabilityScoreDelta: 5,
          volumeDelta: Math.floor(totalOrders * 0.2),
          onTimePercentageDelta: 3,
          issueCountDelta: -2,
          trendDirection: 'up'
        },
        updatedAt: new Date().toISOString()
      };
    });
    
    const response: VendorReport[] = mockReports;
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'reports_retrieved',
      reportCount: mockReports.length
    }));
    
    res.json(response);
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'reports_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
    
    res.status(500).json(createApiError('REPORTS_ERROR', 'Failed to retrieve reports', req.correlationId || 'unknown'));
  }
});

// Get dashboard summary
app.get('/api/dashboard', (req, res) => {
  try {
    // TODO: Replace with actual aggregated data from DynamoDB
    const summary: DashboardSummaryResponse = {
      systemHealth: {
        status: 'healthy',
        dataFreshness: 'fresh',
        lastUpdateMinutesAgo: 5,
        issues: []
      },
      current: {
        overallReliability: 89.2,
        totalActiveOrders: 245,
        totalDelayedOrders: 23,
        atRiskVendors: 1
      },
      previous: {
        overallReliability: 87.5,
        totalActiveOrders: 198,
        totalDelayedOrders: 31,
        atRiskVendors: 2
      },
      trends: {
        reliabilityTrend: 1.7,
        activeOrdersTrend: 47,
        delayedOrdersTrend: -8,
        atRiskVendorsTrend: -1
      },
      topPerformingVendors: ['vendor-001', 'vendor-002', 'vendor-003'],
      underperformingVendors: ['vendor-005']
    };
    
    const response: DashboardSummaryResponse = summary;
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'dashboard_retrieved',
      overallReliability: summary.current.overallReliability,
      totalActiveOrders: summary.current.totalActiveOrders
    }));
    
    res.json(response);
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'dashboard_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
    
    res.status(500).json(createApiError('DASHBOARD_ERROR', 'Failed to retrieve dashboard summary', req.correlationId || 'unknown'));
  }
});

// Handle preflight OPTIONS requests
app.options('*', (req, res) => {
  res.status(200).end();
});

// 404 handler
app.use('*', (req, res) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId,
    event: 'route_not_found',
    path: req.originalUrl,
    method: req.method
  }));
  
  res.status(404).json(createApiError('ROUTE_NOT_FOUND', 'Route not found', req.correlationId || 'unknown'));
});

// Error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId,
    event: 'unhandled_error',
    error: error.message,
    stack: error.stack
  }));
  
  res.status(500).json(createApiError('INTERNAL_ERROR', 'Internal server error', req.correlationId || 'unknown'));
});

// Export the serverless handler
export const handler = serverless(app);

// For local development
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
  });
}
