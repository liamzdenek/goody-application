import { z } from 'zod';

// Order Status Enum - exactly as in PLAN.md
export const OrderStatus = z.enum([
  'PLACED',
  'SHIPPING_ON_TIME', 
  'SHIPPING_DELAYED',
  'ARRIVED',           // Terminal
  'LOST',              // Terminal
  'DAMAGED',           // Terminal
  'UNDELIVERABLE',     // Terminal
  'RETURN_TO_SENDER'   // Terminal
]);

export type OrderStatus = z.infer<typeof OrderStatus>;

// Gift Type Enum - exactly as in PLAN.md
export const GiftType = z.enum(['flowers', 'tech', 'food', 'apparel']);
export type GiftType = z.infer<typeof GiftType>;

// Order schema matching PLAN.md exactly
export const Order = z.object({
  orderId: z.string(),                    // Partition Key: "ORD-{timestamp}-{random}"
  vendorId: z.string(),                   // GSI1 Partition Key
  status: OrderStatus,                    // GSI2 Partition Key
  createdAt: z.string().datetime(),       // ISO timestamp, GSI1 Sort Key
  updatedAt: z.string().datetime(),       // ISO timestamp
  estimatedDelivery: z.string().datetime().optional(), // ISO timestamp
  actualDelivery: z.string().datetime().optional(),    // ISO timestamp
  giftValue: z.number().int().positive(), // In cents
  giftType: GiftType,                     // Gift category
  isRush: z.boolean(),
  // Calculated fields for easy querying
  isDelayed: z.boolean(),                 // updatedAt > estimatedDelivery
  deliveryDays: z.number().int().nonnegative().optional(), // Days from created to delivered
  // Backfill metadata
  isBackfilled: z.boolean().optional()    // Track if this is historical data
});

export type Order = z.infer<typeof Order>;

// Order creation input (subset for new orders)
export const CreateOrderInput = Order.omit({ 
  orderId: true,
  updatedAt: true,
  actualDelivery: true,
  isDelayed: true,
  deliveryDays: true,
  isBackfilled: true
});

export type CreateOrderInput = z.infer<typeof CreateOrderInput>;

// Order update input (for status transitions)
export const UpdateOrderInput = z.object({
  orderId: z.string(),
  status: OrderStatus,
  updatedAt: z.string().datetime(),
  actualDelivery: z.string().datetime().optional(),
  isDelayed: z.boolean().optional(),
  deliveryDays: z.number().int().nonnegative().optional()
});

export type UpdateOrderInput = z.infer<typeof UpdateOrderInput>;

// Order query filters
export const OrderQueryFilters = z.object({
  vendorId: z.string().optional(),
  status: OrderStatus.optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),   // YYYY-MM-DD
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional()
});

export type OrderQueryFilters = z.infer<typeof OrderQueryFilters>;

// Helper functions for order lifecycle
export const isTerminalStatus = (status: OrderStatus): boolean => {
  return ['ARRIVED', 'LOST', 'DAMAGED', 'UNDELIVERABLE', 'RETURN_TO_SENDER'].includes(status);
};

export const canTransitionTo = (from: OrderStatus, to: OrderStatus): boolean => {
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    'PLACED': ['SHIPPING_ON_TIME', 'SHIPPING_DELAYED', 'LOST'],
    'SHIPPING_ON_TIME': ['ARRIVED', 'SHIPPING_DELAYED', 'LOST', 'DAMAGED'],
    'SHIPPING_DELAYED': ['ARRIVED', 'LOST', 'DAMAGED', 'UNDELIVERABLE', 'RETURN_TO_SENDER'],
    'ARRIVED': [], // Terminal
    'LOST': [], // Terminal  
    'DAMAGED': [], // Terminal
    'UNDELIVERABLE': [], // Terminal
    'RETURN_TO_SENDER': [] // Terminal
  };
  
  return transitions[from]?.includes(to) ?? false;
};

// Calculate if order is delayed
export const calculateIsDelayed = (estimatedDelivery?: string, updatedAt?: string): boolean => {
  if (!estimatedDelivery || !updatedAt) return false;
  return new Date(updatedAt) > new Date(estimatedDelivery);
};

// Calculate delivery days
export const calculateDeliveryDays = (createdAt: string, actualDelivery?: string): number | undefined => {
  if (!actualDelivery) return undefined;
  const created = new Date(createdAt);
  const delivered = new Date(actualDelivery);
  const diffTime = Math.abs(delivered.getTime() - created.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};