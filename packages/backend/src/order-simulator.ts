import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
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
const eventBridgeClient = new EventBridgeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const TABLE_NAME = process.env.ORDERS_TABLE_NAME || 'GoodyOrders';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'default';

// Gift value ranges by category (in cents)
const GIFT_VALUE_RANGES = {
  flowers: { min: 2500, max: 15000 },    // $25-150
  tech: { min: 5000, max: 50000 },       // $50-500
  food: { min: 1500, max: 8000 },        // $15-80
  apparel: { min: 3000, max: 25000 }     // $30-250
};

// Convert backfill config to full vendor objects
const ACTIVE_VENDORS: Vendor[] = BACKFILL_VENDORS.map(createVendorFromBackfillConfig);

/**
 * Generate a realistic order based on vendor reliability patterns
 */
function generateOrder(vendor: Vendor): Order {
  const correlationId = uuidv4();
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const now = new Date();
  
  // Determine if this will be a rush order (20% chance)
  const isRush = Math.random() < 0.2;
  
  // Calculate estimated delivery based on rush status
  const deliveryDays = isRush ? 1 : Math.floor(Math.random() * 3) + 2; // 1 day for rush, 2-4 days normal
  const estimatedDelivery = new Date(now.getTime() + deliveryDays * 24 * 60 * 60 * 1000);
  
  // Generate gift value within category range
  const valueRange = GIFT_VALUE_RANGES[vendor.category!];
  const giftValue = Math.floor(Math.random() * (valueRange.max - valueRange.min + 1)) + valueRange.min;
  
  // Determine initial status (most start as PLACED)
  const initialStatus: OrderStatus = Math.random() < 0.95 ? 'PLACED' : 'SHIPPING_ON_TIME';
  
  const order: Order = {
    orderId,
    vendorId: vendor.vendorId!,
    status: initialStatus,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    estimatedDelivery: estimatedDelivery.toISOString(),
    giftValue,
    giftType: vendor.category!,
    isRush,
    isDelayed: false, // Will be calculated when status changes
    isBackfilled: false
  };
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    correlationId,
    event: 'order_generated',
    orderId: order.orderId,
    vendorId: order.vendorId,
    giftValue: order.giftValue,
    isRush: order.isRush,
    estimatedDelivery: order.estimatedDelivery
  }));
  
  return order;
}

/**
 * Select a vendor based on weighted probability (higher reliability = more orders)
 */
function selectRandomVendor(): Vendor {
  // Create weighted array based on reliability scores
  const weightedVendors: Vendor[] = [];
  
  ACTIVE_VENDORS.forEach(vendor => {
    const weight = Math.ceil((vendor.baseReliability || 0.8) * 10); // 0.8 reliability = 8 entries
    for (let i = 0; i < weight; i++) {
      weightedVendors.push(vendor);
    }
  });
  
  const randomIndex = Math.floor(Math.random() * weightedVendors.length);
  return weightedVendors[randomIndex];
}

/**
 * Get next status in order lifecycle based on vendor reliability
 */
function getNextOrderStatus(currentStatus: OrderStatus, vendor: Vendor, order: Order): OrderStatus {
  const reliability = vendor.baseReliability || 0.8;
  const isOverdue = new Date() > new Date(order.estimatedDelivery!);
  
  switch (currentStatus) {
    case 'PLACED':
      // Move to shipping status
      if (isOverdue || Math.random() > reliability) {
        return 'SHIPPING_DELAYED';
      }
      return 'SHIPPING_ON_TIME';
      
    case 'SHIPPING_ON_TIME':
      // Either arrive on time or get delayed
      if (isOverdue || Math.random() > reliability) {
        return 'SHIPPING_DELAYED';
      }
      if (Math.random() < 0.3) { // 30% chance to arrive
        return 'ARRIVED';
      }
      return 'SHIPPING_ON_TIME'; // Stay in current status
      
    case 'SHIPPING_DELAYED':
      // Either arrive (delayed) or get lost
      if (Math.random() < 0.1) { // 10% chance to get lost when delayed
        return 'LOST';
      }
      if (Math.random() < 0.4) { // 40% chance to arrive (delayed)
        return 'ARRIVED';
      }
      return 'SHIPPING_DELAYED'; // Stay delayed
      
    default:
      return currentStatus; // Terminal statuses don't change
  }
}

/**
 * Update an existing order's status
 */
async function updateOrderStatus(order: Order, correlationId: string): Promise<Order> {
  // Find the vendor for this order
  const vendor = ACTIVE_VENDORS.find(v => v.vendorId === order.vendorId);
  if (!vendor) {
    throw new Error(`Vendor not found: ${order.vendorId}`);
  }
  
  const newStatus = getNextOrderStatus(order.status, vendor, order);
  const now = new Date();
  
  // Calculate if delivery is delayed
  const isDelayed = order.estimatedDelivery ? now > new Date(order.estimatedDelivery) : false;
  
  // Calculate delivery days if order arrived
  let deliveryDays: number | undefined;
  if (newStatus === 'ARRIVED') {
    const createdDate = new Date(order.createdAt);
    deliveryDays = Math.ceil((now.getTime() - createdDate.getTime()) / (24 * 60 * 60 * 1000));
  }
  
  const updatedOrder: Order = {
    ...order,
    status: newStatus,
    updatedAt: now.toISOString(),
    isDelayed,
    deliveryDays,
    actualDelivery: newStatus === 'ARRIVED' ? now.toISOString() : order.actualDelivery
  };
  
  // Update in DynamoDB
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { orderId: order.orderId },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, isDelayed = :isDelayed' +
                     (deliveryDays ? ', deliveryDays = :deliveryDays' : '') +
                     (newStatus === 'ARRIVED' ? ', actualDelivery = :actualDelivery' : ''),
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': newStatus,
      ':updatedAt': updatedOrder.updatedAt,
      ':isDelayed': isDelayed,
      ...(deliveryDays && { ':deliveryDays': deliveryDays }),
      ...(newStatus === 'ARRIVED' && { ':actualDelivery': updatedOrder.actualDelivery })
    }
  }));
  
  // Publish status change event to EventBridge
  if (newStatus !== order.status) {
    await eventBridgeClient.send(new PutEventsCommand({
      Entries: [{
        Source: 'goody.order-simulator',
        DetailType: 'Order Status Changed',
        Detail: JSON.stringify({
          orderId: order.orderId,
          vendorId: order.vendorId,
          oldStatus: order.status,
          newStatus: newStatus,
          isDelayed,
          correlationId
        }),
        EventBusName: EVENT_BUS_NAME
      }]
    }));
  }
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    correlationId,
    event: 'order_status_updated',
    orderId: order.orderId,
    vendorId: order.vendorId,
    oldStatus: order.status,
    newStatus: newStatus,
    isDelayed,
    deliveryDays
  }));
  
  return updatedOrder;
}

/**
 * Lambda handler for order simulation
 */
export const handler = async (event: any) => {
  const correlationId = uuidv4();
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    correlationId,
    event: 'order_simulation_start',
    trigger: event.source || 'manual',
    scheduledTime: event.time
  }));
  
  try {
    // Step 1: Count non-terminal orders
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: '#status IN (:placed, :shipping_on_time, :shipping_delayed)',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':placed': 'PLACED',
        ':shipping_on_time': 'SHIPPING_ON_TIME',
        ':shipping_delayed': 'SHIPPING_DELAYED'
      },
      Select: 'COUNT'
    }));
    
    const nonTerminalCount = scanResult.Count || 0;
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId,
      event: 'non_terminal_orders_counted',
      count: nonTerminalCount
    }));
    
    // Step 2: Decision logic per PLAN.md
    if (nonTerminalCount < 100 && Math.random() < 0.4) {
      // Create new order (40% chance when < 100 orders)
      const vendor = selectRandomVendor();
      const order = generateOrder(vendor);
      
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: order,
        ConditionExpression: 'attribute_not_exists(orderId)'
      }));
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        correlationId,
        event: 'order_simulation_complete',
        action: 'created_new_order',
        orderId: order.orderId,
        vendorId: order.vendorId,
        nonTerminalCount
      }));
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          action: 'created_new_order',
          orderId: order.orderId,
          nonTerminalCount
        })
      };
      
    } else {
      // Update existing order status
      const existingOrdersResult = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: '#status IN (:placed, :shipping_on_time, :shipping_delayed)',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':placed': 'PLACED',
          ':shipping_on_time': 'SHIPPING_ON_TIME',
          ':shipping_delayed': 'SHIPPING_DELAYED'
        }
      }));
      
      if (!existingOrdersResult.Items || existingOrdersResult.Items.length === 0) {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          correlationId,
          event: 'no_orders_to_update',
          nonTerminalCount
        }));
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            action: 'no_orders_to_update',
            nonTerminalCount
          })
        };
      }
      
      // Select random order to update
      const randomOrder = existingOrdersResult.Items[
        Math.floor(Math.random() * existingOrdersResult.Items.length)
      ] as Order;
      
      const updatedOrder = await updateOrderStatus(randomOrder, correlationId);
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        correlationId,
        event: 'order_simulation_complete',
        action: 'updated_existing_order',
        orderId: updatedOrder.orderId,
        oldStatus: randomOrder.status,
        newStatus: updatedOrder.status,
        nonTerminalCount
      }));
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          action: 'updated_existing_order',
          orderId: updatedOrder.orderId,
          oldStatus: randomOrder.status,
          newStatus: updatedOrder.status,
          nonTerminalCount
        })
      };
    }
    
  } catch (error) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId,
      event: 'order_simulation_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }));
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Order simulation failed'
      })
    };
  }
};

// For local testing
if (process.env.NODE_ENV !== 'production') {
  console.log('Order Simulator Lambda ready');
  console.log(`Active vendors: ${ACTIVE_VENDORS.length}`);
  console.log(`Table name: ${TABLE_NAME}`);
}