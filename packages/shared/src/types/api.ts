import { z } from 'zod';
import { Order, OrderStatus, OrderQueryFilters, GiftType } from './order';
import { Vendor, VendorQueryFilters } from './vendor';
import { VendorReport, DashboardSummary, StatusCounts } from './report';

// Common error response
export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }),
  correlationId: z.string().uuid(),
  timestamp: z.string().datetime()
});

export type ApiError = z.infer<typeof ApiError>;

// Health Check Types - matching PLAN.md exactly
export const HealthCheckStatus = z.enum(['healthy', 'degraded', 'unhealthy']);
export const CheckResult = z.enum(['pass', 'fail']);

export const HealthCheckResponse = z.object({
  status: HealthCheckStatus,
  checks: z.object({
    dynamodb: CheckResult,
    eventbridge: CheckResult,
    dataFreshness: CheckResult,  // Last update < 10 minutes ago
    reportGeneration: CheckResult  // Report generator functioning
  }),
  dataFreshness: z.object({
    lastOrderUpdate: z.string().datetime(),     // ISO timestamp
    lastReportUpdate: z.string().datetime(),    // ISO timestamp
    minutesSinceLastUpdate: z.number().nonnegative()
  }),
  systemMetrics: z.object({
    ordersLast24h: z.number().int().nonnegative(),
    reportsGenerated: z.number().int().nonnegative(),
    avgResponseTime: z.number().nonnegative()     // Milliseconds
  }),
  issues: z.array(z.string()),              // Human-readable issue descriptions
  timestamp: z.string().datetime(),
  version: z.string(),
  uptime: z.number().nonnegative()               // Seconds since deployment
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponse>;

// Dashboard Summary Types - matching PLAN.md exactly
export const DashboardSummaryRequest = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() // YYYY-MM-DD, defaults to today
});

export const DashboardSummaryResponse = z.object({
  systemHealth: z.object({
    status: HealthCheckStatus,
    dataFreshness: z.enum(['fresh', 'stale', 'critical']),
    lastUpdateMinutesAgo: z.number().nonnegative(),
    issues: z.array(z.string())
  }),
  current: z.object({
    overallReliability: z.number().min(0).max(100),
    totalActiveOrders: z.number().int().nonnegative(),
    totalDelayedOrders: z.number().int().nonnegative(),
    atRiskVendors: z.number().int().nonnegative()
  }),
  previous: z.object({
    overallReliability: z.number().min(0).max(100),
    totalActiveOrders: z.number().int().nonnegative(),
    totalDelayedOrders: z.number().int().nonnegative(),
    atRiskVendors: z.number().int().nonnegative()
  }),
  trends: z.object({
    reliabilityTrend: z.number(),         // Percentage change
    activeOrdersTrend: z.number(),        // Absolute change
    delayedOrdersTrend: z.number(),       // Absolute change
    atRiskVendorsTrend: z.number()        // Absolute change
  }),
  topPerformingVendors: z.array(z.string()),     // vendorIds of top 3 performers
  underperformingVendors: z.array(z.string())    // vendorIds with reliability < 80%
});

export type DashboardSummaryRequest = z.infer<typeof DashboardSummaryRequest>;
export type DashboardSummaryResponse = z.infer<typeof DashboardSummaryResponse>;

// Vendor List Types - matching PLAN.md exactly
export const VendorListRequest = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),     // YYYY-MM-DD, defaults to today
  limit: z.number().int().min(1).max(100).default(20),         // default 20, max 100
  sortBy: z.enum(['reliability', 'volume', 'issues']).optional(),
  order: z.enum(['asc', 'desc']).optional()
});

export const VendorSummaryItem = z.object({
  vendorId: z.string(),
  name: z.string(),
  category: GiftType,                                     // Gift category
  reliabilityScore: z.number().min(0).max(100),
  totalOrders: z.number().int().nonnegative(),           // Last 7 days
  onTimePercentage: z.number().min(0).max(100),
  issueCount: z.number().int().nonnegative(),
  trend: z.enum(['up', 'down', 'stable']),               // Based on 7d vs previous 7d
  trendPercentage: z.number(),                           // Numeric change
  riskLevel: z.enum(['low', 'medium', 'high'])           // Based on reliability thresholds
});

export const VendorListResponse = z.object({
  vendors: z.array(VendorSummaryItem),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    hasMore: z.boolean()
  })
});

export type VendorListRequest = z.infer<typeof VendorListRequest>;
export type VendorSummaryItem = z.infer<typeof VendorSummaryItem>;
export type VendorListResponse = z.infer<typeof VendorListResponse>;

// Vendor Report Types - matching PLAN.md exactly
export const VendorReportRequest = z.object({
  vendorId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() // YYYY-MM-DD, defaults to today
});

export const VendorReportResponse = z.object({
  vendor: z.object({
    vendorId: z.string(),
    name: z.string(),
    category: GiftType
  }),
  report: VendorReport,  // Contains both current, previous, and trends
  recentIssues: z.array(z.object({
    orderId: z.string(),
    status: OrderStatus,
    occurredAt: z.string().datetime(),
    description: z.string()
  }))
});

export type VendorReportRequest = z.infer<typeof VendorReportRequest>;
export type VendorReportResponse = z.infer<typeof VendorReportResponse>;

// Orders List Types - matching PLAN.md exactly
export const OrdersListRequest = z.object({
  vendorId: z.string().optional(),
  status: OrderStatus.optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),   // YYYY-MM-DD
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),     // YYYY-MM-DD
  limit: z.number().int().min(1).max(100).default(50),           // default 50, max 100
  cursor: z.string().optional()                                  // for pagination
});

export const OrdersListResponse = z.object({
  orders: z.array(Order),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
  summary: z.object({
    total: z.number().int().nonnegative(),
    statusBreakdown: z.record(OrderStatus, z.number().int().nonnegative())
  })
});

export type OrdersListRequest = z.infer<typeof OrdersListRequest>;
export type OrdersListResponse = z.infer<typeof OrdersListResponse>;

// API Endpoints enum for type safety
export const ApiEndpoints = {
  HEALTH: '/health',
  DASHBOARD_SUMMARY: '/dashboard/summary',
  VENDORS_LIST: '/vendors',
  VENDOR_REPORT: '/vendors/:vendorId/report',
  ORDERS_LIST: '/orders'
} as const;

export type ApiEndpoints = typeof ApiEndpoints[keyof typeof ApiEndpoints];

// HTTP Status codes
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

export type HttpStatus = typeof HttpStatus[keyof typeof HttpStatus];

// Request/Response validation helpers
export const validateRequest = <T extends z.ZodType>(schema: T, data: unknown): z.infer<T> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`);
  }
  return result.data;
};

export const createApiError = (code: string, message: string, correlationId: string, details?: any): ApiError => {
  return {
    error: {
      code,
      message,
      details
    },
    correlationId,
    timestamp: new Date().toISOString()
  };
};

// Helper to extract correlation ID from request headers
export const getCorrelationId = (headers: Record<string, string | undefined>): string => {
  return headers['x-correlation-id'] || headers['X-Correlation-ID'] || 
         `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// CORS headers for API responses
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Correlation-ID'
} as const;