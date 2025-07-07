import { z } from 'zod';
import { createZodValidationError } from './errors';

// Safe validation wrapper that handles errors consistently
export const safeValidate = <T extends z.ZodType>(
  schema: T,
  data: unknown,
  correlationId?: string
): z.infer<T> => {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    throw createZodValidationError(result.error, correlationId);
  }
  
  return result.data;
};

// Async validation for schemas that might have async refinements
export const safeValidateAsync = async <T extends z.ZodType>(
  schema: T,
  data: unknown,
  correlationId?: string
): Promise<z.infer<T>> => {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createZodValidationError(error, correlationId);
    }
    throw error;
  }
};

// Validate and return a partial result (useful for updates)
export const safeValidatePartial = <T extends z.ZodObject<any>>(
  schema: T,
  data: unknown,
  correlationId?: string
): Partial<z.infer<T>> => {
  return safeValidate(schema.partial(), data, correlationId);
};

// Common validation patterns
export const ValidationPatterns = {
  // UUID validation
  uuid: z.string().uuid(),
  
  // Date patterns
  isoDateTime: z.string().datetime(),
  dateString: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  
  // Pagination
  limit: z.number().int().min(1).max(100),
  cursor: z.string().optional(),
  
  // Order ID pattern (PLAN.md uses string format like "ORD-{timestamp}-{random}")
  orderId: z.string().min(1),
  
  // Vendor ID pattern
  vendorId: z.string().min(1),
  
  // Correlation ID pattern
  correlationId: z.string().uuid(),
  
  // Positive currency amount (in cents)
  currencyAmount: z.number().int().positive(),
  
  // Percentage (0-100)
  percentage: z.number().min(0).max(100),
  
  // Non-empty string
  nonEmptyString: z.string().min(1),
  
  // Email validation
  email: z.string().email(),
  
  // Phone number (basic validation)
  phone: z.string().regex(/^\+?[\d\s\-()]{10,}$/),
  
  // Postal code (US format)
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  
  // State code (US)
  stateCode: z.string().length(2).regex(/^[A-Z]{2}$/)
};

// Environment variable validation
export const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  
  // AWS Configuration
  AWS_REGION: z.string().default('us-east-1'),
  
  // DynamoDB Table Names
  ORDERS_TABLE_NAME: z.string(),
  VENDORS_TABLE_NAME: z.string(),
  REPORTS_TABLE_NAME: z.string(),
  DASHBOARD_SUMMARY_TABLE_NAME: z.string(),
  
  // EventBridge Configuration
  EVENT_BUS_NAME: z.string().optional(),
  
  // API Configuration
  API_GATEWAY_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().default('*'),
  
  // Feature Flags
  ENABLE_DEBUG_LOGGING: z.string().transform(val => val === 'true').default('false'),
  ENABLE_METRICS: z.string().transform(val => val === 'true').default('true')
});

export type Environment = z.infer<typeof EnvironmentSchema>;

// Validate environment variables
export const validateEnvironment = (env: Record<string, string | undefined> = process.env): Environment => {
  try {
    return EnvironmentSchema.parse(env);
  } catch (error) {
    console.error('Environment validation failed:', error);
    throw createZodValidationError(error as z.ZodError, 'env-validation');
  }
};

// Request validation middleware factory
export const createRequestValidator = <T extends z.ZodType>(schema: T) => {
  return (req: any, res: any, next: any) => {
    try {
      const correlationId = req.headers['x-correlation-id'] || 'unknown';
      
      // Combine query, params, and body for validation
      const requestData = {
        ...req.query,
        ...req.params,
        ...req.body
      };
      
      req.validatedData = safeValidate(schema, requestData, correlationId);
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Lambda event validation helper
export const validateLambdaEvent = <T extends z.ZodType>(
  schema: T,
  event: unknown,
  context: { awsRequestId?: string } = {}
): z.infer<T> => {
  const correlationId = context.awsRequestId || 'lambda-unknown';
  return safeValidate(schema, event, correlationId);
};

// Common query parameter validation
export const QueryParametersSchema = z.object({
  limit: ValidationPatterns.limit.optional(),
  cursor: ValidationPatterns.cursor,
  date: ValidationPatterns.dateString.optional(),
  dateFrom: ValidationPatterns.dateString.optional(),
  dateTo: ValidationPatterns.dateString.optional()
});

// Path parameter validation for vendor endpoints
export const VendorPathParametersSchema = z.object({
  vendorId: ValidationPatterns.vendorId
});

// Path parameter validation for order endpoints
export const OrderPathParametersSchema = z.object({
  orderId: ValidationPatterns.orderId
});

// Health check validation (no input needed)
export const HealthCheckInputSchema = z.object({}).optional();

// Dashboard summary input validation
export const DashboardSummaryInputSchema = z.object({
  date: ValidationPatterns.dateString.optional()
});

// Vendor list input validation
export const VendorListInputSchema = z.object({
  date: ValidationPatterns.dateString.optional(),
  limit: ValidationPatterns.limit.optional(),
  sortBy: z.enum(['reliability', 'volume', 'issues']).optional(),
  order: z.enum(['asc', 'desc']).optional()
});

// Vendor report input validation
export const VendorReportInputSchema = z.object({
  vendorId: ValidationPatterns.vendorId,
  date: ValidationPatterns.dateString.optional()
});

// Orders list input validation - using exact PLAN.md OrderStatus values
export const OrdersListInputSchema = z.object({
  vendorId: ValidationPatterns.vendorId.optional(),
  status: z.enum(['PLACED', 'SHIPPING_ON_TIME', 'SHIPPING_DELAYED', 'ARRIVED', 'LOST', 'DAMAGED', 'UNDELIVERABLE', 'RETURN_TO_SENDER']).optional(),
  dateFrom: ValidationPatterns.dateString.optional(),
  dateTo: ValidationPatterns.dateString.optional(),
  limit: ValidationPatterns.limit.optional(),
  cursor: ValidationPatterns.cursor
});

// Utility function to clean and prepare data for validation
export const prepareDataForValidation = (data: any): unknown => {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  // Remove undefined values and convert string numbers
  const cleaned: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && value !== '') {
      // Try to convert string numbers
      if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
        cleaned[key] = Number(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  
  return cleaned;
};

// Validation error formatter for API responses
export const formatValidationErrors = (error: z.ZodError): Array<{path: string; message: string}> => {
  return error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message
  }));
};

// Type guard for checking if an error is a validation error
export const isValidationError = (error: unknown): error is z.ZodError => {
  return error instanceof z.ZodError;
};