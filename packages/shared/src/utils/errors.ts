import { z } from 'zod';

// Standard error codes for the application
export const ErrorCodes = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  
  // Business logic errors
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  VENDOR_NOT_FOUND: 'VENDOR_NOT_FOUND',
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
  INVALID_ORDER_STATUS_TRANSITION: 'INVALID_ORDER_STATUS_TRANSITION',
  
  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  
  // Authorization errors (for future use)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Base application error class
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly correlationId?: string;
  public readonly details?: any;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 500,
    correlationId?: string,
    details?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.correlationId = correlationId;
    this.details = details;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      },
      correlationId: this.correlationId || 'unknown',
      timestamp: new Date().toISOString()
    };
  }
}

// Specific error classes for common scenarios
export class ValidationError extends AppError {
  constructor(message: string, correlationId?: string, details?: any) {
    super(ErrorCodes.VALIDATION_ERROR, message, 400, correlationId, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string, correlationId?: string) {
    const code = resource === 'order' ? ErrorCodes.ORDER_NOT_FOUND :
                 resource === 'vendor' ? ErrorCodes.VENDOR_NOT_FOUND :
                 resource === 'report' ? ErrorCodes.REPORT_NOT_FOUND :
                 ErrorCodes.INTERNAL_ERROR;
    
    super(code, `${resource} not found: ${id}`, 404, correlationId);
    this.name = 'NotFoundError';
  }
}

export class BusinessLogicError extends AppError {
  constructor(code: ErrorCode, message: string, correlationId?: string, details?: any) {
    super(code, message, 400, correlationId, details);
    this.name = 'BusinessLogicError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, correlationId?: string, details?: any) {
    super(ErrorCodes.DATABASE_ERROR, message, 500, correlationId, details);
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, correlationId?: string, details?: any) {
    super(
      ErrorCodes.EXTERNAL_SERVICE_ERROR, 
      `External service error (${service}): ${message}`, 
      503, 
      correlationId, 
      details
    );
    this.name = 'ExternalServiceError';
  }
}

// Error factory functions for consistent error creation
export const createValidationError = (message: string, correlationId?: string, details?: any): ValidationError => {
  return new ValidationError(message, correlationId, details);
};

export const createNotFoundError = (resource: string, id: string, correlationId?: string): NotFoundError => {
  return new NotFoundError(resource, id, correlationId);
};

export const createBusinessLogicError = (code: ErrorCode, message: string, correlationId?: string, details?: any): BusinessLogicError => {
  return new BusinessLogicError(code, message, correlationId, details);
};

export const createDatabaseError = (message: string, correlationId?: string, details?: any): DatabaseError => {
  return new DatabaseError(message, correlationId, details);
};

export const createExternalServiceError = (service: string, message: string, correlationId?: string, details?: any): ExternalServiceError => {
  return new ExternalServiceError(service, message, correlationId, details);
};

// Helper function to convert Zod errors to ValidationErrors
export const createZodValidationError = (error: z.ZodError, correlationId?: string): ValidationError => {
  const details = error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code
  }));

  return new ValidationError(
    `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
    correlationId,
    details
  );
};

// Helper function to safely extract error information
export const getErrorInfo = (error: unknown): { message: string; code?: string; stack?: string } => {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      stack: error.stack
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: 'Unknown error occurred' };
};

// Helper function to determine if an error is retryable
export const isRetryableError = (error: unknown): boolean => {
  if (error instanceof AppError) {
    const retryableCodes: ErrorCode[] = [
      ErrorCodes.DATABASE_ERROR,
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      ErrorCodes.SERVICE_UNAVAILABLE,
      ErrorCodes.RATE_LIMIT_EXCEEDED
    ];
    return retryableCodes.includes(error.code);
  }

  // For non-AppError instances, assume network/connection errors might be retryable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('timeout') || 
           message.includes('connection') || 
           message.includes('network') ||
           message.includes('502') ||
           message.includes('503') ||
           message.includes('504');
  }

  return false;
};

// Helper function to log errors consistently
export const logError = (error: unknown, context: { correlationId?: string; operation?: string } = {}): void => {
  const errorInfo = getErrorInfo(error);
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    message: errorInfo.message,
    correlationId: context.correlationId || 'unknown',
    operation: context.operation,
    code: errorInfo.code,
    stack: errorInfo.stack,
    isRetryable: isRetryableError(error)
  };

  console.log(JSON.stringify(logEntry));
};

// Express error handler middleware for serverless-http
export const errorHandler = (error: unknown, req: any, res: any, next: any): void => {
  const correlationId = req.headers['x-correlation-id'] || 'unknown';
  
  logError(error, { 
    correlationId, 
    operation: `${req.method} ${req.path}` 
  });

  if (error instanceof AppError) {
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  if (error instanceof z.ZodError) {
    const validationError = createZodValidationError(error, correlationId);
    res.status(validationError.statusCode).json(validationError.toJSON());
    return;
  }

  // Default error response
  const defaultError = new AppError(
    ErrorCodes.INTERNAL_ERROR,
    'An unexpected error occurred',
    500,
    correlationId
  );

  res.status(500).json(defaultError.toJSON());
};

// Lambda error handler
export const handleLambdaError = (error: unknown, correlationId = 'unknown'): never => {
  logError(error, { correlationId, operation: 'lambda' });

  if (error instanceof AppError) {
    throw error;
  }

  if (error instanceof z.ZodError) {
    throw createZodValidationError(error, correlationId);
  }

  throw new AppError(
    ErrorCodes.INTERNAL_ERROR,
    'Lambda execution failed',
    500,
    correlationId,
    error
  );
};