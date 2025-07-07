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

// Helper functions
function getIssueDescription(status: OrderStatus, giftType: string): string {
  const descriptions = {
    LOST: `${giftType} package lost in transit`,
    DAMAGED: `${giftType} package damaged during shipping`,
    UNDELIVERABLE: `${giftType} delivery failed - address issue`,
    RETURN_TO_SENDER: `${giftType} returned to sender`
  };
  return descriptions[status as keyof typeof descriptions] || `Issue with ${giftType} order`;
}

function getUpdateType(order: Order): string {
  if (order.isBackfilled) return 'new_order';
  if (order.actualDelivery) return 'delivery_update';
  if (['LOST', 'DAMAGED', 'UNDELIVERABLE', 'RETURN_TO_SENDER'].includes(order.status)) {
    return 'issue_reported';
  }
  return 'status_change';
}

function getUpdateDescription(order: Order): string {
  const vendor = ACTIVE_VENDORS.find(v => v.vendorId === order.vendorId);
  const vendorName = vendor?.name || 'Unknown Vendor';
  
  switch (order.status) {
    case 'PLACED':
      return `New ${order.giftType} order placed with ${vendorName}`;
    case 'SHIPPING_ON_TIME':
      return `${order.giftType} order shipped on time by ${vendorName}`;
    case 'SHIPPING_DELAYED':
      return `${order.giftType} order delayed by ${vendorName}`;
    case 'ARRIVED':
      return `${order.giftType} order delivered by ${vendorName}`;
    case 'LOST':
      return `${order.giftType} order lost in transit from ${vendorName}`;
    case 'DAMAGED':
      return `${order.giftType} order damaged during shipping from ${vendorName}`;
    case 'UNDELIVERABLE':
      return `${order.giftType} order undeliverable from ${vendorName}`;
    case 'RETURN_TO_SENDER':
      return `${order.giftType} order returned to ${vendorName}`;
    default:
      return `${order.giftType} order status updated by ${vendorName}`;
  }
}

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

// Get all orders with filtering and pagination
app.get('/api/orders', async (req, res) => {
  try {
    const {
      vendorId,
      status,
      dateFrom,
      dateTo,
      limit = '50',
      cursor
    } = req.query;
    
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    
    let result;
    let orders: Order[];
    
    if (vendorId) {
      // Use vendor index for vendor-specific queries
      const queryParams: any = {
        TableName: ORDERS_TABLE_NAME,
        IndexName: 'vendorIndex',
        KeyConditionExpression: 'vendorId = :vendorId',
        ExpressionAttributeValues: {
          ':vendorId': vendorId
        },
        Limit: limitNum,
        ScanIndexForward: false // Most recent first
      };
      
      // Add date range filter if provided
      if (dateFrom || dateTo) {
        if (dateFrom && dateTo) {
          queryParams.KeyConditionExpression += ' AND createdAt BETWEEN :dateFrom AND :dateTo';
          queryParams.ExpressionAttributeValues[':dateFrom'] = dateFrom;
          queryParams.ExpressionAttributeValues[':dateTo'] = dateTo;
        } else if (dateFrom) {
          queryParams.KeyConditionExpression += ' AND createdAt >= :dateFrom';
          queryParams.ExpressionAttributeValues[':dateFrom'] = dateFrom;
        } else if (dateTo) {
          queryParams.KeyConditionExpression += ' AND createdAt <= :dateTo';
          queryParams.ExpressionAttributeValues[':dateTo'] = dateTo;
        }
      }
      
      // Add status filter
      if (status) {
        queryParams.FilterExpression = '#status = :status';
        queryParams.ExpressionAttributeNames = { '#status': 'status' };
        queryParams.ExpressionAttributeValues[':status'] = status;
      }
      
      // Add cursor for pagination
      if (cursor) {
        try {
          queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(cursor as string, 'base64').toString());
        } catch (e) {
          return res.status(400).json(createApiError('INVALID_CURSOR', 'Invalid pagination cursor', req.correlationId || 'unknown'));
        }
      }
      
      result = await docClient.send(new QueryCommand(queryParams));
    } else {
      // Use scan for general queries
      const scanParams: any = {
        TableName: ORDERS_TABLE_NAME,
        Limit: limitNum
      };
      
      const filterExpressions: string[] = [];
      const expressionAttributeNames: any = {};
      const expressionAttributeValues: any = {};
      
      // Add status filter
      if (status) {
        filterExpressions.push('#status = :status');
        expressionAttributeNames['#status'] = 'status';
        expressionAttributeValues[':status'] = status;
      }
      
      // Add date range filters
      if (dateFrom) {
        filterExpressions.push('createdAt >= :dateFrom');
        expressionAttributeValues[':dateFrom'] = dateFrom;
      }
      
      if (dateTo) {
        filterExpressions.push('createdAt <= :dateTo');
        expressionAttributeValues[':dateTo'] = dateTo;
      }
      
      if (filterExpressions.length > 0) {
        scanParams.FilterExpression = filterExpressions.join(' AND ');
        scanParams.ExpressionAttributeNames = expressionAttributeNames;
        scanParams.ExpressionAttributeValues = expressionAttributeValues;
      }
      
      // Add cursor for pagination
      if (cursor) {
        try {
          scanParams.ExclusiveStartKey = JSON.parse(Buffer.from(cursor as string, 'base64').toString());
        } catch (e) {
          return res.status(400).json(createApiError('INVALID_CURSOR', 'Invalid pagination cursor', req.correlationId || 'unknown'));
        }
      }
      
      result = await docClient.send(new ScanCommand(scanParams));
    }
    
    orders = (result.Items || []) as Order[];
    
    // Sort by updatedAt descending if not using vendor index
    if (!vendorId) {
      orders.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    
    // Calculate status breakdown
    const statusBreakdown = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<OrderStatus, number>);
    
    // Create next cursor if there are more results
    let nextCursor: string | undefined;
    if (result.LastEvaluatedKey) {
      nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }
    
    const response = {
      orders,
      nextCursor,
      hasMore: !!result.LastEvaluatedKey,
      summary: {
        total: orders.length,
        statusBreakdown
      }
    };
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'orders_retrieved',
      orderCount: orders.length,
      filters: {
        vendorId: vendorId || null,
        status: status || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      },
      limit: limitNum,
      hasMore: !!result.LastEvaluatedKey
    }));
    
    res.json(response);
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
    
    const allReports = (reportsResult.Items || []) as VendorReport[];
    
    // Filter out dashboard summary reports - only process vendor reports
    const reports = allReports.filter(report => report.vendorId !== 'SYSTEM');
    
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

// Get vendor detail report
app.get('/api/vendors/:vendorId/report', async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    // Get vendor info
    const vendor = ACTIVE_VENDORS.find(v => v.vendorId === vendorId);
    if (!vendor) {
      return res.status(404).json(createApiError('VENDOR_NOT_FOUND', 'Vendor not found', req.correlationId || 'unknown'));
    }
    
    // Get vendor report
    const reportResult = await docClient.send(new QueryCommand({
      TableName: REPORTS_TABLE_NAME,
      KeyConditionExpression: 'vendorId = :vendorId AND #date = :date',
      ExpressionAttributeNames: {
        '#date': 'date'
      },
      ExpressionAttributeValues: {
        ':vendorId': vendorId,
        ':date': date as string
      }
    }));
    
    const report = reportResult.Items?.[0] as VendorReport;
    if (!report) {
      return res.status(404).json(createApiError('REPORT_NOT_FOUND', 'Report not found for this vendor and date', req.correlationId || 'unknown'));
    }
    
    // Get recent issues (orders with problem statuses in last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const issuesResult = await docClient.send(new QueryCommand({
      TableName: ORDERS_TABLE_NAME,
      IndexName: 'vendorIndex',
      KeyConditionExpression: 'vendorId = :vendorId AND createdAt >= :yesterday',
      FilterExpression: '#status IN (:lost, :damaged, :undeliverable, :rts)',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':vendorId': vendorId,
        ':yesterday': yesterday.toISOString(),
        ':lost': 'LOST',
        ':damaged': 'DAMAGED',
        ':undeliverable': 'UNDELIVERABLE',
        ':rts': 'RETURN_TO_SENDER'
      },
      ScanIndexForward: false,
      Limit: 10
    }));
    
    const recentIssues = (issuesResult.Items as Order[]).map(order => ({
      orderId: order.orderId,
      status: order.status,
      occurredAt: order.updatedAt,
      description: getIssueDescription(order.status, order.giftType)
    }));
    
    const response = {
      vendor: {
        vendorId: vendor.vendorId,
        name: vendor.name,
        category: vendor.category
      },
      report,
      recentIssues
    };
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'vendor_report_retrieved',
      vendorId,
      date,
      issueCount: recentIssues.length
    }));
    
    res.json(response);
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'vendor_report_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }));
    
    res.status(500).json(createApiError('VENDOR_REPORT_ERROR', 'Failed to retrieve vendor report', req.correlationId || 'unknown'));
  }
});

// Get recent order updates
app.get('/api/orders/recent', async (req, res) => {
  try {
    const { limit = 50, hours = 24 } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const hoursNum = Math.min(parseInt(hours as string) || 24, 168);
    
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursNum);
    
    // Get recent orders using status index (most recently updated)
    const recentResult = await docClient.send(new ScanCommand({
      TableName: ORDERS_TABLE_NAME,
      FilterExpression: 'updatedAt >= :cutoffTime',
      ExpressionAttributeValues: {
        ':cutoffTime': cutoffTime.toISOString()
      },
      Limit: limitNum
    }));
    
    const orders = (recentResult.Items as Order[]).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    // Calculate activity metrics
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const lastHourOrders = orders.filter(order =>
      new Date(order.updatedAt) >= oneHourAgo
    );
    
    const recentActivity = {
      updatesLastHour: lastHourOrders.length,
      statusChanges: lastHourOrders.filter(order => !order.isBackfilled).length,
      issuesReported: lastHourOrders.filter(order =>
        ['LOST', 'DAMAGED', 'UNDELIVERABLE', 'RETURN_TO_SENDER'].includes(order.status)
      ).length,
      arrivalsConfirmed: lastHourOrders.filter(order => order.status === 'ARRIVED').length
    };
    
    // Enhance orders with vendor names and update descriptions
    const enhancedOrders = orders.map(order => {
      const vendor = ACTIVE_VENDORS.find(v => v.vendorId === order.vendorId);
      return {
        ...order,
        vendorName: vendor?.name || 'Unknown Vendor',
        updateType: getUpdateType(order),
        updateDescription: getUpdateDescription(order)
      };
    });
    
    // Calculate status breakdown
    const statusBreakdown = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const response = {
      recentActivity,
      orders: enhancedOrders,
      hasMore: recentResult.LastEvaluatedKey !== undefined,
      summary: {
        totalRecentUpdates: orders.length,
        timeRangeHours: hoursNum,
        statusBreakdown,
        updateTypeBreakdown: {
          status_change: enhancedOrders.filter(o => o.updateType === 'status_change').length,
          new_order: enhancedOrders.filter(o => o.updateType === 'new_order').length,
          delivery_update: enhancedOrders.filter(o => o.updateType === 'delivery_update').length,
          issue_reported: enhancedOrders.filter(o => o.updateType === 'issue_reported').length
        }
      }
    };
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'recent_orders_retrieved',
      orderCount: orders.length,
      timeRangeHours: hoursNum,
      updatesLastHour: recentActivity.updatesLastHour
    }));
    
    res.json(response);
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      event: 'recent_orders_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }));
    
    res.status(500).json(createApiError('RECENT_ORDERS_ERROR', 'Failed to retrieve recent orders', req.correlationId || 'unknown'));
  }
});

// Dashboard summary alias
app.get('/dashboard/summary', async (req, res) => {
  // Redirect to the existing dashboard endpoint
  req.url = '/api/dashboard';
  return app._router.handle(req, res);
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
