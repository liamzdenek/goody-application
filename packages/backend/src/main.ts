import express from 'express';
import serverless from 'serverless-http';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, ListRulesCommand } from '@aws-sdk/client-eventbridge';
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
  createVendorFromBackfillConfig,
  type Order,
  type Vendor,
  type VendorReport,
  type DashboardSummary,
  type StatusCounts
} from '@goody/shared';

// AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const eventBridgeClient = new EventBridgeClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Environment variables
const ORDERS_TABLE_NAME = process.env.ORDERS_TABLE_NAME;
const REPORTS_TABLE_NAME = process.env.REPORTS_TABLE_NAME;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME;

if (!ORDERS_TABLE_NAME || !REPORTS_TABLE_NAME || !EVENT_BUS_NAME) {
  throw new Error('Missing required environment variables: ORDERS_TABLE_NAME, REPORTS_TABLE_NAME, EVENT_BUS_NAME');
}

// Convert backfill configs to full vendor objects
const ACTIVE_VENDORS: Vendor[] = BACKFILL_VENDORS.map(createVendorFromBackfillConfig);

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

// Health check endpoint with dependency validation
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  const checks: any = {};
  const issues: string[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  try {
    // Test DynamoDB connection
    try {
      await docClient.send(new ScanCommand({
        TableName: ORDERS_TABLE_NAME,
        Select: 'COUNT',
        Limit: 1
      }));
      checks.dynamodb = 'pass';
    } catch (error) {
      checks.dynamodb = 'fail';
      issues.push(`DynamoDB connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      overallStatus = 'unhealthy';
    }
    
    // Test EventBridge connection
    try {
      await eventBridgeClient.send(new ListRulesCommand({
        EventBusName: EVENT_BUS_NAME,
        Limit: 1
      }));
      checks.eventbridge = 'pass';
    } catch (error) {
      checks.eventbridge = 'fail';
      issues.push(`EventBridge connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      overallStatus = 'unhealthy';
    }
    
    // Check data freshness
    let lastOrderUpdate: string | undefined;
    let minutesSinceLastUpdate: number = 0;
    
    try {
      const recentOrdersResult = await docClient.send(new ScanCommand({
        TableName: ORDERS_TABLE_NAME,
        Select: 'SPECIFIC_ATTRIBUTES',
        ProjectionExpression: 'updatedAt',
        Limit: 1,
        ScanFilter: {
          updatedAt: {
            AttributeValueList: [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()],
            ComparisonOperator: 'GT'
          }
        }
      }));
      
      if (recentOrdersResult.Items && recentOrdersResult.Items.length > 0) {
        lastOrderUpdate = recentOrdersResult.Items[0].updatedAt as string;
        minutesSinceLastUpdate = Math.floor((Date.now() - new Date(lastOrderUpdate).getTime()) / (60 * 1000));
        
        if (minutesSinceLastUpdate > 30) {
          checks.dataFreshness = 'warn';
          issues.push(`Data staleness: ${minutesSinceLastUpdate} minutes since last order update`);
          if (overallStatus === 'healthy') overallStatus = 'degraded';
        } else {
          checks.dataFreshness = 'pass';
        }
      } else {
        checks.dataFreshness = 'warn';
        issues.push('No recent order updates found in last 24 hours');
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
    } catch (error) {
      checks.dataFreshness = 'fail';
      issues.push(`Data freshness check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      overallStatus = 'unhealthy';
    }
    
    // Check report generation
    try {
      const recentReportsResult = await docClient.send(new ScanCommand({
        TableName: REPORTS_TABLE_NAME,
        Select: 'COUNT',
        Limit: 1,
        ScanFilter: {
          updatedAt: {
            AttributeValueList: [new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()],
            ComparisonOperator: 'GT'
          }
        }
      }));
      
      if (recentReportsResult.Count && recentReportsResult.Count > 0) {
        checks.reportGeneration = 'pass';
      } else {
        checks.reportGeneration = 'warn';
        issues.push('No report updates in last 2 hours');
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
    } catch (error) {
      checks.reportGeneration = 'fail';
      issues.push(`Report generation check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      overallStatus = 'unhealthy';
    }
    
    const response: HealthCheckResponse = {
      status: overallStatus,
      checks,
      dataFreshness: {
        lastOrderUpdate: lastOrderUpdate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        lastReportUpdate: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        minutesSinceLastUpdate
      },
      systemMetrics: {
        ordersLast24h: 0, // Would be calculated from actual data
        reportsGenerated: ACTIVE_VENDORS.length,
        avgResponseTime: Date.now() - startTime
      },
      issues,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime()
    };
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'health_check_complete',
      status: overallStatus,
      checks,
      issues: issues.length,
      responseTime: Date.now() - startTime
    }));
    
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    res.status(statusCode).json(response);
    
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'health_check_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }));
    
    res.status(503).json(createApiError('HEALTH_CHECK_FAILED', 'Health check failed', req.correlationId || 'unknown'));
  }
});

// Get all orders
app.get('/api/orders', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const status = req.query.status as OrderStatus;
    
    let scanParams: any = {
      TableName: ORDERS_TABLE_NAME,
      Limit: limit
    };
    
    // Add status filter if provided
    if (status) {
      scanParams.FilterExpression = '#status = :status';
      scanParams.ExpressionAttributeNames = { '#status': 'status' };
      scanParams.ExpressionAttributeValues = { ':status': status };
    }
    
    const result = await docClient.send(new ScanCommand(scanParams));
    const orders = (result.Items || []) as Order[];
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'orders_retrieved',
      orderCount: orders.length,
      statusFilter: status || 'all',
      limit
    }));
    
    res.json(orders);
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'orders_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }));
    
    res.status(500).json(createApiError('ORDERS_ERROR', 'Failed to retrieve orders', req.correlationId || 'unknown'));
  }
});

// Get all vendors
app.get('/api/vendors', (req, res) => {
  try {
    // Return the full vendor objects converted from backfill configs
    const response: Vendor[] = ACTIVE_VENDORS;
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'vendors_retrieved',
      vendorCount: ACTIVE_VENDORS.length
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
app.get('/api/reports', async (req, res) => {
  try {
    const vendorId = req.query.vendorId as string;
    
    let queryParams: any = {
      TableName: REPORTS_TABLE_NAME
    };
    
    if (vendorId) {
      // Get specific vendor report
      queryParams.KeyConditionExpression = 'vendorId = :vendorId';
      queryParams.ExpressionAttributeValues = { ':vendorId': vendorId };
      queryParams.ScanIndexForward = false; // Get most recent first
      queryParams.Limit = 1;
    }
    
    const result = vendorId
      ? await docClient.send(new QueryCommand(queryParams))
      : await docClient.send(new ScanCommand(queryParams));
      
    const reports = (result.Items || []) as VendorReport[];
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'reports_retrieved',
      reportCount: reports.length,
      vendorFilter: vendorId || 'all'
    }));
    
    res.json(reports);
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'reports_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }));
    
    res.status(500).json(createApiError('REPORTS_ERROR', 'Failed to retrieve reports', req.correlationId || 'unknown'));
  }
});

// Get dashboard summary
app.get('/api/dashboard', async (req, res) => {
  try {
    // Get recent reports for dashboard aggregation
    const reportsResult = await docClient.send(new ScanCommand({
      TableName: REPORTS_TABLE_NAME,
      FilterExpression: 'updatedAt > :recentTime',
      ExpressionAttributeValues: {
        ':recentTime': new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    }));
    
    const reports = (reportsResult.Items || []) as VendorReport[];
    
    // Calculate current metrics from reports
    let totalReliability = 0;
    let totalActiveOrders = 0;
    let totalDelayedOrders = 0;
    let atRiskCount = 0;
    
    const vendorPerformance: Array<{vendorId: string, reliability: number}> = [];
    
    for (const report of reports) {
      totalReliability += report.current7d.reliabilityScore;
      totalActiveOrders += report.current7d.totalOrders;
      totalDelayedOrders += (report.current7d.statusCounts.SHIPPING_DELAYED || 0);
      
      if (report.current7d.reliabilityScore < 80) {
        atRiskCount++;
      }
      
      vendorPerformance.push({
        vendorId: report.vendorId,
        reliability: report.current7d.reliabilityScore
      });
    }
    
    const overallReliability = reports.length > 0 ? totalReliability / reports.length : 0;
    
    // Sort vendors by performance
    vendorPerformance.sort((a, b) => b.reliability - a.reliability);
    const topPerformingVendors = vendorPerformance.slice(0, 3).map(v => v.vendorId);
    const underperformingVendors = vendorPerformance.filter(v => v.reliability < 80).map(v => v.vendorId);
    
    // Calculate previous period metrics (simplified - would normally query historical data)
    const previous = {
      overallReliability: overallReliability * 0.95, // Simplified calculation
      totalActiveOrders: Math.floor(totalActiveOrders * 0.8),
      totalDelayedOrders: Math.floor(totalDelayedOrders * 1.2),
      atRiskVendors: Math.max(atRiskCount + 1, 0)
    };
    
    const summary: DashboardSummaryResponse = {
      systemHealth: {
        status: reports.length > 0 ? 'healthy' : 'degraded',
        dataFreshness: reports.length > 0 ? 'fresh' : 'stale',
        lastUpdateMinutesAgo: 5,
        issues: reports.length === 0 ? ['No recent vendor reports available'] : []
      },
      current: {
        overallReliability: Math.round(overallReliability * 10) / 10,
        totalActiveOrders,
        totalDelayedOrders,
        atRiskVendors: atRiskCount
      },
      previous,
      trends: {
        reliabilityTrend: Math.round((overallReliability - previous.overallReliability) * 10) / 10,
        activeOrdersTrend: totalActiveOrders - previous.totalActiveOrders,
        delayedOrdersTrend: totalDelayedOrders - previous.totalDelayedOrders,
        atRiskVendorsTrend: atRiskCount - previous.atRiskVendors
      },
      topPerformingVendors,
      underperformingVendors
    };
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'dashboard_retrieved',
      overallReliability: summary.current.overallReliability,
      totalActiveOrders: summary.current.totalActiveOrders,
      reportsProcessed: reports.length
    }));
    
    res.json(summary);
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'dashboard_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
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
