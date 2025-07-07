import { z } from 'zod';
import { OrderStatus, GiftType } from './order';

// Report Time Period
export const ReportPeriod = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']);
export type ReportPeriod = z.infer<typeof ReportPeriod>;

// Trend Direction
export const TrendDirection = z.enum(['up', 'down', 'stable']);
export type TrendDirection = z.infer<typeof TrendDirection>;

// Status counts schema matching PLAN.md exactly
export const StatusCounts = z.object({
  PLACED: z.number().int().nonnegative(),
  SHIPPING_ON_TIME: z.number().int().nonnegative(),
  SHIPPING_DELAYED: z.number().int().nonnegative(),
  ARRIVED: z.number().int().nonnegative(),
  LOST: z.number().int().nonnegative(),
  DAMAGED: z.number().int().nonnegative(),
  UNDELIVERABLE: z.number().int().nonnegative(),
  RETURN_TO_SENDER: z.number().int().nonnegative()
});

export type StatusCounts = z.infer<typeof StatusCounts>;

// Vendor Report schema matching PLAN.md exactly
export const VendorReport = z.object({
  vendorId: z.string(),                   // Partition Key
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Sort Key (YYYY-MM-DD)
  current7d: z.object({
    statusCounts: StatusCounts,
    totalOrders: z.number().int().nonnegative(),
    onTimeDeliveries: z.number().int().nonnegative(),         // ARRIVED within estimatedDelivery
    onTimePercentage: z.number().min(0).max(100),             // onTimeDeliveries / totalDelivered * 100
    issueCount: z.number().int().nonnegative(),               // LOST + DAMAGED + UNDELIVERABLE + RTS
    avgDeliveryTime: z.number().nonnegative().optional(),     // In hours
    reliabilityScore: z.number().min(0).max(100)             // 0-100 weighted score
  }),
  previous7d: z.object({
    statusCounts: StatusCounts,
    totalOrders: z.number().int().nonnegative(),
    onTimeDeliveries: z.number().int().nonnegative(),
    onTimePercentage: z.number().min(0).max(100),
    issueCount: z.number().int().nonnegative(),
    avgDeliveryTime: z.number().nonnegative().optional(),
    reliabilityScore: z.number().min(0).max(100)
  }),
  // Computed trend data
  trends: z.object({
    reliabilityScoreDelta: z.number(),    // current - previous
    volumeDelta: z.number(),              // current - previous
    onTimePercentageDelta: z.number(),    // current - previous
    issueCountDelta: z.number(),          // current - previous
    trendDirection: TrendDirection
  }),
  updatedAt: z.string().datetime()       // ISO timestamp
});

export type VendorReport = z.infer<typeof VendorReport>;

// Dashboard Summary schema matching PLAN.md exactly
export const DashboardSummary = z.object({
  summaryId: z.string(),                  // Partition Key: "DAILY_SUMMARY"
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Sort Key (YYYY-MM-DD)
  current7d: z.object({
    overallReliability: z.number().min(0).max(100),       // Weighted average across all vendors
    totalActiveOrders: z.number().int().nonnegative(),    // Non-terminal orders
    totalDelayedOrders: z.number().int().nonnegative(),   // Orders past estimated delivery
    atRiskVendors: z.number().int().nonnegative()         // Vendors with reliability < 85%
  }),
  previous7d: z.object({
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
  underperformingVendors: z.array(z.string()),   // vendorIds with reliability < 80%
  updatedAt: z.string().datetime()
});

export type DashboardSummary = z.infer<typeof DashboardSummary>;

// Report generation input
export const GenerateReportRequest = z.object({
  reportType: z.enum(['VENDOR_REPORT', 'DASHBOARD_SUMMARY']),
  vendorId: z.string().optional(), // Required for vendor-specific reports
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
  metadata: z.object({
    requestedBy: z.string().optional(),
    correlationId: z.string().uuid(),
    requestedAt: z.string().datetime()
  })
});

export type GenerateReportRequest = z.infer<typeof GenerateReportRequest>;

// Helper functions for report calculations
export const calculateReliabilityScore = (statusCounts: StatusCounts): number => {
  const totalCompleted = statusCounts.ARRIVED + statusCounts.LOST + statusCounts.DAMAGED + 
                        statusCounts.UNDELIVERABLE + statusCounts.RETURN_TO_SENDER;
  
  if (totalCompleted === 0) return 0;
  return Math.round((statusCounts.ARRIVED / totalCompleted) * 100);
};

export const calculateOnTimePercentage = (onTimeDeliveries: number, totalDelivered: number): number => {
  if (totalDelivered === 0) return 0;
  return Math.round((onTimeDeliveries / totalDelivered) * 100);
};

export const calculateIssueCount = (statusCounts: StatusCounts): number => {
  return statusCounts.LOST + statusCounts.DAMAGED + statusCounts.UNDELIVERABLE + statusCounts.RETURN_TO_SENDER;
};

export const calculateTrendDirection = (current: number, previous: number, threshold = 0.05): TrendDirection => {
  const change = Math.abs(current - previous) / previous;
  
  if (change < threshold) return 'stable';
  return current > previous ? 'up' : 'down';
};

export const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

// Helper to determine if vendor is at risk (reliability < 85%)
export const isVendorAtRisk = (reliabilityScore: number): boolean => {
  return reliabilityScore < 85;
};

// Helper to determine if vendor is underperforming (reliability < 80%)
export const isVendorUnderperforming = (reliabilityScore: number): boolean => {
  return reliabilityScore < 80;
};

export const generateReportId = (): string => {
  return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};