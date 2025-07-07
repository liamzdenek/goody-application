import { z } from 'zod';
import { GiftType } from './order';

// Vendor schema matching PLAN.md exactly
export const Vendor = z.object({
  vendorId: z.string(),                   // Partition Key
  name: z.string(),
  category: GiftType,                     // "flowers" | "tech" | "food" | "apparel"
  baseReliability: z.number().min(0).max(1), // Starting reliability for backfill (0.7-0.98)
  avgOrderValue: z.number().int().positive(), // For realistic data generation (in cents)
  isActive: z.boolean(),
  metadata: z.object({
    contractStartDate: z.string().datetime(), // ISO timestamp
    supportContact: z.string(),
    slaPromises: z.object({
      standardDelivery: z.number().int().positive(), // Days
      rushDelivery: z.number().int().positive()      // Days
    })
  })
});

export type Vendor = z.infer<typeof Vendor>;

// Vendor creation input
export const CreateVendorInput = Vendor;
export type CreateVendorInput = z.infer<typeof CreateVendorInput>;

// Vendor update input
export const UpdateVendorInput = Vendor.partial().extend({
  vendorId: z.string() // vendorId is required for updates
});

export type UpdateVendorInput = z.infer<typeof UpdateVendorInput>;

// Vendor query filters
export const VendorQueryFilters = z.object({
  category: GiftType.optional(),
  isActive: z.boolean().optional(),
  minReliability: z.number().min(0).max(1).optional(),
  maxReliability: z.number().min(0).max(1).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional()
});

export type VendorQueryFilters = z.infer<typeof VendorQueryFilters>;

// Backfill configuration as specified in PLAN.md
export const BackfillVendorConfig = z.object({
  vendorId: z.string(),
  name: z.string(),
  category: GiftType,
  baseReliability: z.number().min(0.7).max(0.98), // 0.7-0.98 range from PLAN.md
  reliabilityTrend: z.enum(['improving', 'declining', 'stable']),
  orderVolumePattern: z.enum(['high', 'medium', 'low']),
  commonIssues: z.array(z.enum(['LOST', 'DAMAGED', 'UNDELIVERABLE', 'RETURN_TO_SENDER']))
});

export type BackfillVendorConfig = z.infer<typeof BackfillVendorConfig>;

// Sample vendor configurations from PLAN.md
export const BACKFILL_VENDORS: BackfillVendorConfig[] = [
  {
    vendorId: 'vendor-001',
    name: 'Premium Flowers',
    category: 'flowers',
    baseReliability: 0.95,
    reliabilityTrend: 'stable',
    orderVolumePattern: 'high',
    commonIssues: ['DAMAGED']
  },
  {
    vendorId: 'vendor-002', 
    name: 'Gourmet Baskets',
    category: 'food',
    baseReliability: 0.92,
    reliabilityTrend: 'improving',
    orderVolumePattern: 'medium',
    commonIssues: ['DAMAGED', 'UNDELIVERABLE']
  },
  {
    vendorId: 'vendor-003',
    name: 'Tech Gadgets Co',
    category: 'tech',
    baseReliability: 0.87,
    reliabilityTrend: 'declining',
    orderVolumePattern: 'high',
    commonIssues: ['LOST', 'DAMAGED']
  },
  {
    vendorId: 'vendor-004',
    name: 'Artisan Goods',
    category: 'apparel',
    baseReliability: 0.83,
    reliabilityTrend: 'stable',
    orderVolumePattern: 'medium',
    commonIssues: ['UNDELIVERABLE', 'RETURN_TO_SENDER']
  },
  {
    vendorId: 'vendor-005',
    name: 'Fast Fashion',
    category: 'apparel',
    baseReliability: 0.72,
    reliabilityTrend: 'declining',
    orderVolumePattern: 'low',
    commonIssues: ['LOST', 'DAMAGED', 'RETURN_TO_SENDER']
  }
];

// Convert backfill config to full vendor record
export const createVendorFromBackfillConfig = (config: BackfillVendorConfig): Vendor => {
  return {
    vendorId: config.vendorId,
    name: config.name,
    category: config.category,
    baseReliability: config.baseReliability,
    avgOrderValue: getAverageOrderValueByCategory(config.category),
    isActive: true,
    metadata: {
      contractStartDate: new Date(Date.now() - (Math.random() * 365 * 24 * 60 * 60 * 1000)).toISOString(),
      supportContact: `support@${config.name.toLowerCase().replace(/\s+/g, '')}.com`,
      slaPromises: {
        standardDelivery: config.category === 'flowers' ? 2 : config.category === 'tech' ? 5 : 3,
        rushDelivery: config.category === 'flowers' ? 1 : config.category === 'tech' ? 2 : 1
      }
    }
  };
};

// Helper function to get realistic order values by category
const getAverageOrderValueByCategory = (category: GiftType): number => {
  const averages = {
    'flowers': 7500,    // $75.00 in cents
    'tech': 15000,      // $150.00 in cents
    'food': 8500,       // $85.00 in cents
    'apparel': 12000    // $120.00 in cents
  };
  return averages[category];
};

// Helper function to get reliability score display
export const getReliabilityScoreDisplay = (score: number): string => {
  return `${Math.round(score * 100)}%`;
};

// Helper function to determine risk level based on reliability
export const getVendorRiskLevel = (reliabilityScore: number): 'low' | 'medium' | 'high' => {
  if (reliabilityScore >= 0.90) return 'low';
  if (reliabilityScore >= 0.80) return 'medium';
  return 'high';
};

// Helper function to get trend direction
export const getTrendDirection = (current: number, previous: number): 'up' | 'down' | 'stable' => {
  const change = Math.abs(current - previous);
  if (change < 0.02) return 'stable'; // Less than 2% change
  return current > previous ? 'up' : 'down';
};