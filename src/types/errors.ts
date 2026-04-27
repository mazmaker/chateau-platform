// ====================================================================
// ERROR TYPES FOR CHATEAU PLATFORM
// ====================================================================
// Comprehensive error handling system for:
// - Supabase API errors
// - Network errors
// - Validation errors
// - Application errors
// ====================================================================

import { PostgrestError, AuthError } from '@supabase/supabase-js';

// ====================================================================
// ERROR CATEGORIES
// ====================================================================

/**
 * Base error categories for the application
 * Maps to database schema and user-facing error messages
 */
export enum ErrorCategory {
  // Database & API Errors
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',

  // Permission Errors
  PERMISSION = 'PERMISSION',
  TENANT = 'TENANT',

  // Validation Errors
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',

  // Business Logic Errors
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  CONFLICT = 'CONFLICT',

  // System Errors
  UNKNOWN = 'UNKNOWN',
}

// ====================================================================
// ERROR SEVERITY
// ====================================================================

export enum ErrorSeverity {
  LOW = 'low',        // Non-critical, doesn't block usage
  MEDIUM = 'medium',  // Partial functionality affected
  HIGH = 'high',      // Critical, blocks main functionality
  CRITICAL = 'critical', // App-breaking, requires immediate attention
}

// ====================================================================
// APPLICATION ERROR BASE CLASS
// ====================================================================

export interface AppErrorMeta {
  timestamp: string;
  userId?: string;
  tenantId?: string;
  route?: string;
  action?: string;
  context?: Record<string, any>;
}

export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly code: string;
  public readonly userMessage: string;
  public readonly technicalMessage: string;
  public readonly meta: AppErrorMeta;
  public readonly originalError?: unknown;
  public readonly retryable: boolean;

  constructor(config: {
    code: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    userMessage: string;
    technicalMessage?: string;
    meta?: Partial<AppErrorMeta>;
    originalError?: unknown;
    retryable?: boolean;
  }) {
    super(config.technicalMessage || config.userMessage);
    this.name = 'AppError';
    this.code = config.code;
    this.category = config.category;
    this.severity = config.severity;
    this.userMessage = config.userMessage;
    this.technicalMessage = config.technicalMessage || config.userMessage;
    this.meta = {
      timestamp: new Date().toISOString(),
      ...config.meta,
    };
    this.originalError = config.originalError;
    this.retryable = config.retryable ?? true;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert error to JSON for logging/API responses
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      severity: this.severity,
      userMessage: this.userMessage,
      technicalMessage: this.technicalMessage,
      meta: this.meta,
      retryable: this.retryable,
    };
  }
}

// ====================================================================
// SPECIFIC ERROR CLASSES
// ====================================================================

// --------------------------------------------------------------------
// Database Errors
// --------------------------------------------------------------------

export class DatabaseError extends AppError {
  constructor(config: {
    code: string;
    userMessage: string;
    technicalMessage?: string;
    table?: string;
    operation?: 'select' | 'insert' | 'update' | 'delete';
    originalError?: PostgrestError | unknown;
    meta?: Partial<AppErrorMeta>;
  }) {
    super({
      code: `DB_${config.code}`,
      category: ErrorCategory.DATABASE,
      severity: ErrorSeverity.HIGH,
      userMessage: config.userMessage,
      technicalMessage: config.technicalMessage || config.userMessage,
      originalError: config.originalError,
      retryable: true,
      meta: {
        ...config.meta,
        context: {
          ...config.meta?.context,
          table: config.table,
          operation: config.operation,
        },
      },
    });
    this.name = 'DatabaseError';
  }
}

// --------------------------------------------------------------------
// Network Errors
// --------------------------------------------------------------------

export class NetworkError extends AppError {
  constructor(config: {
    userMessage?: string;
    technicalMessage?: string;
    url?: string;
    method?: string;
    originalError?: unknown;
    meta?: Partial<AppErrorMeta>;
  }) {
    super({
      code: 'NETWORK_ERROR',
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      userMessage: config.userMessage || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตของคุณ',
      technicalMessage: config.technicalMessage || 'Network request failed',
      originalError: config.originalError,
      retryable: true,
      meta: {
        ...config.meta,
        context: {
          ...config.meta?.context,
          url: config.url,
          method: config.method,
        },
      },
    });
    this.name = 'NetworkError';
  }
}

// --------------------------------------------------------------------
// Authentication Errors
// --------------------------------------------------------------------

export class AuthenticationError extends AppError {
  constructor(config: {
    code: string;
    userMessage: string;
    technicalMessage?: string;
    originalError?: AuthError | unknown;
    meta?: Partial<AppErrorMeta>;
  }) {
    super({
      code: `AUTH_${config.code}`,
      category: ErrorCategory.AUTH,
      severity: ErrorSeverity.HIGH,
      userMessage: config.userMessage,
      technicalMessage: config.technicalMessage || config.userMessage,
      originalError: config.originalError,
      retryable: config.code !== 'INVALID_CREDENTIALS', // Don't retry wrong password
      meta: config.meta,
    });
    this.name = 'AuthenticationError';
  }
}

// --------------------------------------------------------------------
// Permission Errors (RLS, Role-based)
// --------------------------------------------------------------------

export class PermissionError extends AppError {
  constructor(config: {
    code: string;
    userMessage: string;
    requiredRole?: string;
    requiredPermission?: string;
    resource?: string;
    originalError?: PostgrestError | unknown;
    meta?: Partial<AppErrorMeta>;
  }) {
    super({
      code: `PERM_${config.code}`,
      category: ErrorCategory.PERMISSION,
      severity: ErrorSeverity.HIGH,
      userMessage: config.userMessage,
      technicalMessage: `Permission denied: ${config.requiredPermission || config.resource} required`,
      originalError: config.originalError,
      retryable: false, // Permission errors are not retryable without changes
      meta: {
        ...config.meta,
        context: {
          ...config.meta?.context,
          requiredRole: config.requiredRole,
          requiredPermission: config.requiredPermission,
          resource: config.resource,
        },
      },
    });
    this.name = 'PermissionError';
  }
}

// --------------------------------------------------------------------
// Tenant Errors (Multi-tenant isolation)
// --------------------------------------------------------------------

export class TenantError extends AppError {
  constructor(config: {
    code: string;
    userMessage: string;
    tenantId?: string;
    originalError?: unknown;
    meta?: Partial<AppErrorMeta>;
  }) {
    super({
      code: `TENANT_${config.code}`,
      category: ErrorCategory.TENANT,
      severity: ErrorSeverity.HIGH,
      userMessage: config.userMessage,
      technicalMessage: `Tenant error: ${config.code}`,
      originalError: config.originalError,
      retryable: false,
      meta: {
        ...config.meta,
        context: {
          ...config.meta?.context,
          tenantId: config.tenantId,
        },
      },
    });
    this.name = 'TenantError';
  }
}

// --------------------------------------------------------------------
// Validation Errors
// --------------------------------------------------------------------

export class ValidationError extends AppError {
  constructor(config: {
    code: string;
    userMessage: string;
    field?: string;
    value?: any;
    meta?: Partial<AppErrorMeta>;
  }) {
    super({
      code: `VALID_${config.code}`,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      userMessage: config.userMessage,
      technicalMessage: `Validation failed for field: ${config.field || 'unknown'}`,
      retryable: false, // Validation errors need user input changes
      meta: {
        ...config.meta,
        context: {
          ...config.meta?.context,
          field: config.field,
          value: config.value,
        },
      },
    });
    this.name = 'ValidationError';
  }
}

// --------------------------------------------------------------------
// Not Found Errors
// --------------------------------------------------------------------

export class NotFoundError extends AppError {
  constructor(config: {
    resource: string;
    id?: string;
    meta?: Partial<AppErrorMeta>;
  }) {
    super({
      code: 'NOT_FOUND',
      category: ErrorCategory.NOT_FOUND,
      severity: ErrorSeverity.MEDIUM,
      userMessage: `ไม่พบ${config.resource}${config.id ? ` (ID: ${config.id})` : ''}`,
      technicalMessage: `${config.resource} not found${config.id ? ` with id: ${config.id}` : ''}`,
      retryable: false,
      meta: {
        ...config.meta,
        context: {
          ...config.meta?.context,
          resource: config.resource,
          id: config.id,
        },
      },
    });
    this.name = 'NotFoundError';
  }
}

// --------------------------------------------------------------------
// Business Logic Errors
// --------------------------------------------------------------------

export class BusinessLogicError extends AppError {
  constructor(config: {
    code: string;
    userMessage: string;
    technicalMessage?: string;
    meta?: Partial<AppErrorMeta>;
  }) {
    super({
      code: `BIZ_${config.code}`,
      category: ErrorCategory.BUSINESS_LOGIC,
      severity: ErrorSeverity.MEDIUM,
      userMessage: config.userMessage,
      technicalMessage: config.technicalMessage || config.userMessage,
      retryable: false,
      meta: config.meta,
    });
    this.name = 'BusinessLogicError';
  }
}

// ====================================================================
// ERROR CODES CONSTANTS
// ====================================================================

/**
 * Database error codes mapping
 * Based on PostgreSQL error codes and Supabase errors
 */
export const DB_ERROR_CODES = {
  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT: 'TIMEOUT',

  // Query errors
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  DUPLICATE_KEY: 'DUPLICATE_KEY',

  // Table/Record errors
  TABLE_NOT_FOUND: 'TABLE_NOT_FOUND',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',

  // RLS errors
  RLS_VIOLATION: 'RLS_VIOLATION',
  POLICY_VIOLATION: 'POLICY_VIOLATION',
} as const;

/**
 * Authentication error codes
 */
export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
} as const;

/**
 * Permission error codes
 */
export const PERMISSION_ERROR_CODES = {
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',
  MISSING_PERMISSION: 'MISSING_PERMISSION',
  TENANT_ACCESS_DENIED: 'TENANT_ACCESS_DENIED',
  RESOURCE_ACCESS_DENIED: 'RESOURCE_ACCESS_DENIED',
} as const;

/**
 * Validation error codes
 */
export const VALIDATION_ERROR_CODES = {
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_LENGTH: 'INVALID_LENGTH',
  INVALID_RANGE: 'INVALID_RANGE',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PHONE: 'INVALID_PHONE',
} as const;

// ====================================================================
// TYPE GUARDS
// ====================================================================

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is Supabase PostgrestError
 */
export function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'code' in error &&
    'details' in error &&
    'hint' in error
  );
}

/**
 * Type guard to check if error is Supabase AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'status' in error &&
    'name' in error
  );
}

/**
 * Type guard to check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // Common network error messages
    const networkMessages = [
      'Failed to fetch',
      'Network request failed',
      'NetworkError',
    ];
    return networkMessages.some(msg => error.message.includes(msg));
  }
  return false;
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

/**
 * Extract user-friendly error message from any error
 */
export function getUserErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.userMessage;
  }

  if (isPostgrestError(error)) {
    // Map common PostgreSQL error codes to user messages
    const errorMessages: Record<string, string> = {
      '23505': 'ข้อมูลนี้มีอยู่ในระบบแล้ว',
      '23503': 'ไม่สามารถลบข้อมูลนี้ได้เนื่องจากมีข้อมูลอื่นเชื่อมโยงอยู่',
      '23514': 'ข้อมูลไม่ถูกต้องตามเงื่อนไขที่กำหนด',
      '42501': 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้',
      'PGRST116': 'ไม่พบข้อมูลที่ค้นหา',
    };

    return errorMessages[error.code] || 'เกิดข้อผิดพลาดในฐานข้อมูล กรุณาลองใหม่';
  }

  if (isAuthError(error)) {
    const authMessages: Record<string, string> = {
      'Invalid login credentials': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      'Email not confirmed': 'กรุณายืนยันอีเมลของคุณก่อนเข้าใช้งาน',
      'User already registered': 'อีเมลนี้ถูกลงทะเบียนแล้ว',
    };

    return authMessages[error.message] || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ กรุณาลองใหม่';
}

/**
 * Get error severity from any error
 */
export function getErrorSeverity(error: unknown): ErrorSeverity {
  if (isAppError(error)) {
    return error.severity;
  }

  if (isAuthError(error)) {
    return ErrorSeverity.HIGH;
  }

  if (isNetworkError(error)) {
    return ErrorSeverity.MEDIUM;
  }

  return ErrorSeverity.MEDIUM;
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (isAppError(error)) {
    return error.retryable;
  }

  if (isNetworkError(error)) {
    return true;
  }

  // Some Postgrest errors are retryable
  if (isPostgrestError(error)) {
    const retryableCodes = ['08001', '08004', '08006', '08007']; // Connection errors
    return retryableCodes.includes(error.code);
  }

  return false;
}

/**
 * Log error to console with structured format
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const logData = {
    timestamp: new Date().toISOString(),
    error: isAppError(error) ? error.toJSON() : error,
    context,
  };

  const severity = getErrorSeverity(error);

  switch (severity) {
    case ErrorSeverity.CRITICAL:
    case ErrorSeverity.HIGH:
      console.error('[ERROR]', logData);
      break;
    case ErrorSeverity.MEDIUM:
      console.warn('[WARN]', logData);
      break;
    default:
      console.log('[INFO]', logData);
  }
}

// Export all types
export type {
  AppErrorMeta,
};
