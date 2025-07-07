import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import {
  Order,
  OrderStatus,
  VendorReport,
  DashboardSummary,
  StatusCounts,
  calculateReliabilityScore,
  calculateOnTimePercentage,
  calculateIssueCount,
  calculateTrendDirection,
  calculatePercentageChange,
  BACKFILL_VENDORS,
  createVendorFromBackfillConfig,
  type Vendor
} from '@goody/shared';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const ORDERS_TABLE_NAME = process.env.ORDERS_TABLE_NAME || 'GoodyOrders';
const REPORTS_TABLE_NAME = process.env.REPORTS_TABLE_NAME || 'GoodyReports';

// Convert backfill config to full vendor objects
const VENDORS_MAP = new Map<string, Vendor>();
BACKFILL_VENDORS.map(createVendorFromBackfillConfig).forEach(vendor => {
  VENDORS_MAP.set(vendor.vendorId!, vendor);
});

/**
 * Get orders for a specific vendor within a date range
 */
async function getVendorOrders(vendorId: string, daysBack = 7): Promise<Order[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  const result = await docClient.send(new ScanCommand({
    TableName: ORDERS_TABLE_NAME,
    FilterExpression: 'vendorId = :vendorId AND createdAt >= :cutoffDate',
    ExpressionAttributeValues: {
      ':vendorId': vendorId,
      ':cutoffDate': cutoffDate.toISOString()
    }
  }));
  
  return (result.Items as Order[]) || [];
}

/**
 * Get all orders within a date range for dashboard summary
 */
async function getAllOrders(daysBack = 7): Promise<Order[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  const result = await docClient.send(new ScanCommand({
    TableName: ORDERS_TABLE_NAME,
    FilterExpression: 'createdAt >= :cutoffDate',
    ExpressionAttributeValues: {
      ':cutoffDate': cutoffDate.toISOString()
    }
  }));
  
  return (result.Items as Order[]) || [];
}

/**
 * Calculate status counts from orders
 */
function calculateStatusCounts(orders: Order[]): StatusCounts {
  const counts: StatusCounts = {
    PLACED: 0,
    SHIPPING_ON_TIME: 0,
    SHIPPING_DELAYED: 0,
    ARRIVED: 0,
    LOST: 0,
    DAMAGED: 0,
    UNDELIVERABLE: 0,
    RETURN_TO_SENDER: 0
  };
  
  orders.forEach(order => {
    counts[order.status] = (counts[order.status] || 0) + 1;
  });
  
  return counts;
}

/**
 * Calculate on-time deliveries from orders
 */
function calculateOnTimeDeliveries(orders: Order[]): number {
  return orders.filter(order => 
    order.status === 'ARRIVED' && 
    order.actualDelivery && 
    order.estimatedDelivery &&
    new Date(order.actualDelivery) <= new Date(order.estimatedDelivery)
  ).length;
}

/**
 * Generate vendor report
 */
async function generateVendorReport(vendorId: string, correlationId: string): Promise<VendorReport> {
  const vendor = VENDORS_MAP.get(vendorId);
  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found`);
  }
  
  // Get current and previous period data
  const current7dOrders = await getVendorOrders(vendorId, 7);
  const previous7dOrders = await getVendorOrders(vendorId, 14);
  const previousOnlyOrders = previous7dOrders.filter(order => {
    const orderDate = new Date(order.createdAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return orderDate < sevenDaysAgo;
  });
  
  // Calculate current period metrics
  const currentStatusCounts = calculateStatusCounts(current7dOrders);
  const currentOnTimeDeliveries = calculateOnTimeDeliveries(current7dOrders);
  const currentTotalOrders = current7dOrders.length;
  const currentOnTimePercentage = calculateOnTimePercentage(currentOnTimeDeliveries, currentTotalOrders);
  const currentIssueCount = calculateIssueCount(currentStatusCounts);
  const currentReliabilityScore = calculateReliabilityScore(currentStatusCounts);
  
  // Calculate average delivery time for current period
  const deliveredOrders = current7dOrders.filter(order => order.deliveryDays !== undefined);
  const currentAvgDeliveryTime = deliveredOrders.length > 0 ? 
    deliveredOrders.reduce((sum, order) => sum + (order.deliveryDays || 0), 0) / deliveredOrders.length : 
    undefined;
  
  // Calculate previous period metrics
  const previousStatusCounts = calculateStatusCounts(previousOnlyOrders);
  const previousOnTimeDeliveries = calculateOnTimeDeliveries(previousOnlyOrders);
  const previousTotalOrders = previousOnlyOrders.length;
  const previousOnTimePercentage = calculateOnTimePercentage(previousOnTimeDeliveries, previousTotalOrders);
  const previousIssueCount = calculateIssueCount(previousStatusCounts);
  const previousReliabilityScore = calculateReliabilityScore(previousStatusCounts);
  
  const previousDeliveredOrders = previousOnlyOrders.filter(order => order.deliveryDays !== undefined);
  const previousAvgDeliveryTime = previousDeliveredOrders.length > 0 ? 
    previousDeliveredOrders.reduce((sum, order) => sum + (order.deliveryDays || 0), 0) / previousDeliveredOrders.length : 
    undefined;
  
  // Calculate trends
  const reliabilityScoreDelta = currentReliabilityScore - previousReliabilityScore;
  const volumeDelta = currentTotalOrders - previousTotalOrders;
  const onTimePercentageDelta = currentOnTimePercentage - previousOnTimePercentage;
  const issueCountDelta = currentIssueCount - previousIssueCount;
  const trendDirection = calculateTrendDirection(currentReliabilityScore, previousReliabilityScore);
  
  const report: VendorReport = {
    vendorId,
    date: new Date().toISOString().split('T')[0],
    current7d: {
      statusCounts: currentStatusCounts,
      totalOrders: currentTotalOrders,
      onTimeDeliveries: currentOnTimeDeliveries,
      onTimePercentage: currentOnTimePercentage,
      issueCount: currentIssueCount,
      avgDeliveryTime: currentAvgDeliveryTime,
      reliabilityScore: currentReliabilityScore
    },
    previous7d: {
      statusCounts: previousStatusCounts,
      totalOrders: previousTotalOrders,
      onTimeDeliveries: previousOnTimeDeliveries,
      onTimePercentage: previousOnTimePercentage,
      issueCount: previousIssueCount,
      avgDeliveryTime: previousAvgDeliveryTime,
      reliabilityScore: previousReliabilityScore
    },
    trends: {
      reliabilityScoreDelta,
      volumeDelta,
      onTimePercentageDelta,
      issueCountDelta,
      trendDirection
    },
    updatedAt: new Date().toISOString()
  };
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    correlationId,
    event: 'vendor_report_generated',
    vendorId,
    currentOrders: currentTotalOrders,
    previousOrders: previousTotalOrders,
    reliabilityScore: currentReliabilityScore,
    trendDirection
  }));
  
  return report;
}

/**
 * Generate dashboard summary
 */
async function generateDashboardSummary(correlationId: string): Promise<DashboardSummary> {
  // Get current and previous period data for all vendors
  const current7dOrders = await getAllOrders(7);
  const previous7dOrders = await getAllOrders(14);
  const previousOnlyOrders = previous7dOrders.filter(order => {
    const orderDate = new Date(order.createdAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return orderDate < sevenDaysAgo;
  });
  
  // Calculate current period metrics
  const currentTotalOrders = current7dOrders.length;
  const currentActiveOrders = current7dOrders.filter(order => 
    ['PLACED', 'SHIPPING_ON_TIME', 'SHIPPING_DELAYED'].includes(order.status)
  ).length;
  const currentDelayedOrders = current7dOrders.filter(order => order.isDelayed).length;
  
  // Calculate vendor reliability scores for current period
  const vendorReliabilities: number[] = [];
  for (const vendor of VENDORS_MAP.values()) {
    const vendorOrders = current7dOrders.filter(order => order.vendorId === vendor.vendorId);
    if (vendorOrders.length > 0) {
      const statusCounts = calculateStatusCounts(vendorOrders);
      const reliability = calculateReliabilityScore(statusCounts);
      vendorReliabilities.push(reliability);
    }
  }
  
  const currentOverallReliability = vendorReliabilities.length > 0 ? 
    vendorReliabilities.reduce((sum, score) => sum + score, 0) / vendorReliabilities.length : 0;
  
  const currentAtRiskVendors = vendorReliabilities.filter(score => score < 85).length;
  
  // Calculate previous period metrics
  const previousTotalOrders = previousOnlyOrders.length;
  const previousActiveOrders = previousOnlyOrders.filter(order => 
    ['PLACED', 'SHIPPING_ON_TIME', 'SHIPPING_DELAYED'].includes(order.status)
  ).length;
  const previousDelayedOrders = previousOnlyOrders.filter(order => order.isDelayed).length;
  
  const previousVendorReliabilities: number[] = [];
  for (const vendor of VENDORS_MAP.values()) {
    const vendorOrders = previousOnlyOrders.filter(order => order.vendorId === vendor.vendorId);
    if (vendorOrders.length > 0) {
      const statusCounts = calculateStatusCounts(vendorOrders);
      const reliability = calculateReliabilityScore(statusCounts);
      previousVendorReliabilities.push(reliability);
    }
  }
  
  const previousOverallReliability = previousVendorReliabilities.length > 0 ? 
    previousVendorReliabilities.reduce((sum, score) => sum + score, 0) / previousVendorReliabilities.length : 0;
  
  const previousAtRiskVendors = previousVendorReliabilities.filter(score => score < 85).length;
  
  // Calculate trends
  const reliabilityTrend = calculatePercentageChange(currentOverallReliability, previousOverallReliability);
  const activeOrdersTrend = currentActiveOrders - previousActiveOrders;
  const delayedOrdersTrend = currentDelayedOrders - previousDelayedOrders;
  const atRiskVendorsTrend = currentAtRiskVendors - previousAtRiskVendors;
  
  const summary: DashboardSummary = {
    summaryId: 'DAILY_SUMMARY',
    date: new Date().toISOString().split('T')[0],
    current7d: {
      overallReliability: Math.round(currentOverallReliability * 100) / 100,
      totalActiveOrders: currentActiveOrders,
      totalDelayedOrders: currentDelayedOrders,
      atRiskVendors: currentAtRiskVendors
    },
    previous7d: {
      overallReliability: Math.round(previousOverallReliability * 100) / 100,
      totalActiveOrders: previousActiveOrders,
      totalDelayedOrders: previousDelayedOrders,
      atRiskVendors: previousAtRiskVendors
    },
    trends: {
      reliabilityTrend: Math.round(reliabilityTrend * 100) / 100,
      activeOrdersTrend,
      delayedOrdersTrend,
      atRiskVendorsTrend
    },
    updatedAt: new Date().toISOString()
  };
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    correlationId,
    event: 'dashboard_summary_generated',
    totalOrders: currentTotalOrders,
    activeOrders: currentActiveOrders,
    overallReliability: summary.current7d.overallReliability,
    atRiskVendors: currentAtRiskVendors
  }));
  
  return summary;
}

/**
 * Lambda handler for report generation
 * Triggered by DynamoDB Stream on Orders table changes
 */
export const handler = async (event: any) => {
  const correlationId = uuidv4();
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    correlationId,
    event: 'report_generation_start',
    trigger: event.eventSource || 'manual',
    recordCount: event.Records?.length || 0
  }));
  
  try {
    const reports: VendorReport[] = [];
    
    // Generate reports for all active vendors
    for (const vendor of VENDORS_MAP.values()) {
      const report = await generateVendorReport(vendor.vendorId!, correlationId);
      reports.push(report);
      
      // Store vendor report in DynamoDB
      await docClient.send(new PutCommand({
        TableName: REPORTS_TABLE_NAME,
        Item: report
      }));
    }
    
    // Generate and store dashboard summary
    const dashboardSummary = await generateDashboardSummary(correlationId);
    await docClient.send(new PutCommand({
      TableName: REPORTS_TABLE_NAME,
      Item: dashboardSummary
    }));
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId,
      event: 'report_generation_complete',
      vendorReportsGenerated: reports.length,
      dashboardSummaryGenerated: true
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        vendorReportsGenerated: reports.length,
        dashboardSummaryGenerated: true
      })
    };
    
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId,
      event: 'report_generation_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }));
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Report generation failed'
      })
    };
  }
};

// For local testing
if (process.env.NODE_ENV !== 'production') {
  console.log('Report Generator Lambda ready');
  console.log(`Active vendors: ${VENDORS_MAP.size}`);
  console.log(`Orders table: ${ORDERS_TABLE_NAME}`);
  console.log(`Reports table: ${REPORTS_TABLE_NAME}`);
}