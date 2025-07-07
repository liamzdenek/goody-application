import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import {
  Order,
  OrderStatus,
  GiftType,
  BACKFILL_VENDORS,
  createVendorFromBackfillConfig,
  type Vendor
} from '@goody/shared';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.ORDERS_TABLE_NAME || 'GoodyOrders';

// Convert backfill config to full vendor objects
const ACTIVE_VENDORS: Vendor[] = BACKFILL_VENDORS.map(createVendorFromBackfillConfig);

// Gift value ranges by category (in cents)
const GIFT_VALUE_RANGES = {
  flowers: { min: 2500, max: 15000 },    // $25-150
  tech: { min: 5000, max: 50000 },       // $50-500
  food: { min: 1500, max: 8000 },        // $15-80
  apparel: { min: 3000, max: 25000 }     // $30-250
};

// Realistic order patterns
const ORDER_PATTERNS = {
  dailyVolumeRange: [50, 200] as [number, number],     // Min/max orders per day
  businessDayMultiplier: 1.5,                         // 1.5x volume on weekdays
  weekendMultiplier: 0.6,                             // 0.6x volume on weekends
  rushOrderPercentage: 0.15,                          // 15% are rush orders
  giftTypeDistribution: {                             // Realistic gift type spread
    flowers: 0.25,
    tech: 0.30,
    food: 0.30,
    apparel: 0.15
  }
};

/**
 * Calculate daily order count based on day of week and patterns
 */
function calculateDailyOrderCount(date: Date): number {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  const baseCount = Math.floor(
    Math.random() * (ORDER_PATTERNS.dailyVolumeRange[1] - ORDER_PATTERNS.dailyVolumeRange[0] + 1) +
    ORDER_PATTERNS.dailyVolumeRange[0]
  );
  
  const multiplier = isWeekend ? ORDER_PATTERNS.weekendMultiplier : ORDER_PATTERNS.businessDayMultiplier;
  return Math.floor(baseCount * multiplier);
}

/**
 * Select vendor based on weighted distribution (higher reliability = more orders)
 */
function selectWeightedVendor(): Vendor {
  const weightedVendors: Vendor[] = [];
  
  ACTIVE_VENDORS.forEach(vendor => {
    const weight = Math.ceil((vendor.baseReliability || 0.8) * 10);
    for (let i = 0; i < weight; i++) {
      weightedVendors.push(vendor);
    }
  });
  
  const randomIndex = Math.floor(Math.random() * weightedVendors.length);
  return weightedVendors[randomIndex];
}

/**
 * Select gift type based on distribution
 */
function selectGiftType(): GiftType {
  const random = Math.random();
  let cumulative = 0;
  
  for (const [giftType, probability] of Object.entries(ORDER_PATTERNS.giftTypeDistribution)) {
    cumulative += probability;
    if (random <= cumulative) {
      return giftType as GiftType;
    }
  }
  
  return 'tech'; // Fallback
}

/**
 * Generate realistic order status progression based on vendor reliability
 */
function generateOrderProgression(vendor: Vendor, createdAt: Date, isRush: boolean): {
  status: OrderStatus;
  estimatedDelivery: string;
  actualDelivery?: string;
  isDelayed: boolean;
  deliveryDays?: number;
} {
  const reliability = vendor.baseReliability || 0.8;
  const random = Math.random();
  
  // Calculate estimated delivery
  const deliveryDays = isRush ? 1 : Math.floor(Math.random() * 3) + 2; // 1 day for rush, 2-4 days normal
  const estimatedDelivery = new Date(createdAt.getTime() + deliveryDays * 24 * 60 * 60 * 1000);
  
  // Determine final status based on vendor reliability and common issues
  const backfillConfig = BACKFILL_VENDORS.find(v => v.vendorId === vendor.vendorId);
  const commonIssues = backfillConfig?.commonIssues || [];
  
  if (random < reliability * 0.9) {
    // Successfully delivered
    const actualDeliveryTime = new Date(createdAt.getTime() + 
      (deliveryDays + (Math.random() - 0.5) * 2) * 24 * 60 * 60 * 1000); // ±1 day variance
    
    const isDelayed = actualDeliveryTime > estimatedDelivery;
    const actualDeliveryDays = Math.ceil((actualDeliveryTime.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      status: 'ARRIVED',
      estimatedDelivery: estimatedDelivery.toISOString(),
      actualDelivery: actualDeliveryTime.toISOString(),
      isDelayed,
      deliveryDays: actualDeliveryDays
    };
  } else {
    // Order had issues - select from vendor's common issues or random
    let issueStatus: OrderStatus;
    
    if (commonIssues.length > 0 && Math.random() < 0.7) {
      // Use vendor's common issue
      issueStatus = commonIssues[Math.floor(Math.random() * commonIssues.length)];
    } else {
      // Random issue
      const possibleIssues: OrderStatus[] = ['LOST', 'DAMAGED', 'UNDELIVERABLE', 'RETURN_TO_SENDER'];
      issueStatus = possibleIssues[Math.floor(Math.random() * possibleIssues.length)];
    }
    
    const issueTime = new Date(createdAt.getTime() + 
      (deliveryDays + Math.random() * 3) * 24 * 60 * 60 * 1000); // Issue occurred after estimated delivery
    
    const issueDays = Math.ceil((issueTime.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      status: issueStatus,
      estimatedDelivery: estimatedDelivery.toISOString(),
      actualDelivery: issueTime.toISOString(),
      isDelayed: true,
      deliveryDays: issueDays
    };
  }
}

/**
 * Create a backfilled order for a specific date and vendor
 */
function createBackfilledOrder(baseDate: Date, vendor: Vendor): Order {
  const orderId = `ORD-${baseDate.getTime()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  // Add some randomness to the creation time within the day
  const createdAt = new Date(baseDate);
  createdAt.setHours(
    Math.floor(Math.random() * 16) + 6,  // 6 AM to 10 PM
    Math.floor(Math.random() * 60),      // Random minutes
    Math.floor(Math.random() * 60)       // Random seconds
  );
  
  const giftType = vendor.category!;
  const isRush = Math.random() < ORDER_PATTERNS.rushOrderPercentage;
  
  // Generate gift value within category range
  const valueRange = GIFT_VALUE_RANGES[giftType];
  const giftValue = Math.floor(Math.random() * (valueRange.max - valueRange.min + 1)) + valueRange.min;
  
  // Generate order progression
  const progression = generateOrderProgression(vendor, createdAt, isRush);
  
  const order: Order = {
    orderId,
    vendorId: vendor.vendorId!,
    status: progression.status,
    createdAt: createdAt.toISOString(),
    updatedAt: progression.actualDelivery || createdAt.toISOString(),
    estimatedDelivery: progression.estimatedDelivery,
    actualDelivery: progression.actualDelivery,
    giftValue,
    giftType,
    isRush,
    isDelayed: progression.isDelayed,
    deliveryDays: progression.deliveryDays,
    isBackfilled: true
  };
  
  return order;
}

/**
 * Batch write orders to DynamoDB
 */
async function batchWriteOrders(orders: Order[], correlationId: string): Promise<void> {
  const batchSize = 25; // DynamoDB batch write limit
  
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    
    const putRequests = batch.map(order => ({
      PutRequest: {
        Item: order
      }
    }));
    
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: putRequests
      }
    }));
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId,
      event: 'batch_written',
      batchNumber: Math.floor(i / batchSize) + 1,
      orderCount: batch.length
    }));
  }
}

/**
 * Lambda handler for data backfill
 * Creates 21 days of historical order data
 */
export const handler = async (event: any) => {
  const correlationId = uuidv4();
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    correlationId,
    event: 'data_backfill_start',
    trigger: event.source || 'manual',
    daysToBackfill: 21
  }));
  
  try {
    const allOrders: Order[] = [];
    let totalOrderCount = 0;
    
    // Generate 21 days of historical data
    for (let day = -21; day <= -1; day++) {
      const date = new Date();
      date.setDate(date.getDate() + day);
      date.setHours(0, 0, 0, 0); // Start of day
      
      const dailyOrderCount = calculateDailyOrderCount(date);
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        correlationId,
        event: 'generating_daily_orders',
        date: date.toISOString().split('T')[0],
        plannedOrderCount: dailyOrderCount,
        dayOfWeek: date.getDay()
      }));
      
      const dailyOrders: Order[] = [];
      
      // Generate orders for this day
      for (let i = 0; i < dailyOrderCount; i++) {
        const vendor = selectWeightedVendor();
        const order = createBackfilledOrder(date, vendor);
        dailyOrders.push(order);
      }
      
      allOrders.push(...dailyOrders);
      totalOrderCount += dailyOrders.length;
      
      // Write daily orders to DynamoDB in batches
      await batchWriteOrders(dailyOrders, correlationId);
    }
    
    // Calculate summary statistics
    const vendorStats = new Map<string, { count: number; reliability: number }>();
    const statusStats = new Map<OrderStatus, number>();
    
    allOrders.forEach(order => {
      // Vendor stats
      const vendorStat = vendorStats.get(order.vendorId) || { count: 0, reliability: 0 };
      vendorStat.count++;
      if (order.status === 'ARRIVED') {
        vendorStat.reliability++;
      }
      vendorStats.set(order.vendorId, vendorStat);
      
      // Status stats
      statusStats.set(order.status, (statusStats.get(order.status) || 0) + 1);
    });
    
    // Log final statistics
    const finalStats = {
      totalOrders: totalOrderCount,
      dateRange: {
        from: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      vendorBreakdown: Array.from(vendorStats.entries()).map(([vendorId, stats]) => ({
        vendorId,
        orderCount: stats.count,
        reliabilityPercentage: Math.round((stats.reliability / stats.count) * 100)
      })),
      statusBreakdown: Object.fromEntries(statusStats.entries())
    };
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId,
      event: 'data_backfill_complete',
      ...finalStats
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ...finalStats
      })
    };
    
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId,
      event: 'data_backfill_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }));
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Data backfill failed'
      })
    };
  }
};

// For local testing
if (process.env.NODE_ENV !== 'production') {
  console.log('Data Backfill Lambda ready');
  console.log(`Active vendors: ${ACTIVE_VENDORS.length}`);
  console.log(`Table name: ${TABLE_NAME}`);
  console.log('Order patterns:', ORDER_PATTERNS);
}