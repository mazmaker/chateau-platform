// ====================================================================
// API ERROR HANDLER FOR CHATEAU PLATFORM
// ====================================================================
// Centralized error handling for Supabase API calls
// Converts Supabase errors to AppError with user-friendly messages
// ====================================================================

import { PostgrestError, AuthError } from '@supabase/supabase-js';
import {
  AppError,
  DatabaseError,
  NetworkError,
  AuthenticationError,
  PermissionError,
  NotFoundError,
  BusinessLogicError,
  ErrorCategory,
  isAppError,
  isPostgrestError,
  isAuthError,
  isNetworkError,
  getUserErrorMessage,
  logError,
  ErrorSeverity,
  AUTH_ERROR_CODES,
  PERMISSION_ERROR_CODES,
} from '@/types/errors';

// ====================================================================
// SUPABASE ERROR CODE MAPPINGS
// ====================================================================

/**
 * PostgreSQL error codes to AppError mappings
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const POSTGRESQL_ERROR_MAP: Record<string, { code: string; message: string }> = {
  // Connection errors (Class 08)
  '08001': { code: 'CONNECTION_FAILED', message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' },
  '08003': { code: 'CONNECTION_NOT_OPEN', message: 'การเชื่อมต่อถูกปิดแล้ว' },
  '08004': { code: 'CONNECTION_REJECTED', message: 'การเชื่อมต่อถูกปฏิเสธ' },
  '08006': { code: 'CONNECTION_FAILED', message: 'การเชื่อมต่อล้มเหลว' },
  '08007': { code: 'TRANSACTION_ERROR', message: 'เกิดข้อผิดพลาดในระบบ transaction' },

  // Data errors (Class 22)
  '22001': { code: 'STRING_TOO_LONG', message: 'ข้อมูลยาวเกินไป' },
  '22004': { code: 'NULL_VALUE_NOT_ALLOWED', message: 'ต้องระบุค่านี้' },
  '22012': { code: 'DIVISION_BY_ZERO', message: 'ห้ามหารด้วยศูนย์' },
  '22003': { code: 'NUMERIC_OUT_OF_RANGE', message: 'ค่าตัวเลขเกินช่วงที่กำหนด' },

  // Exception conditions (Class 23)
  '23001': { code: 'VIOLATES_CONSTRAINT', message: 'ข้อมูลไม่ถูกต้องตามเงื่อนไข' },
  '23502': { code: 'NOT_NULL_VIOLATION', message: 'ต้องระบุค่าในช่องนี้' },
  '23503': { code: 'FOREIGN_KEY_VIOLATION', message: 'ไม่สามารถลบข้อมูลได้เนื่องจากมีข้อมูลอื่นเชื่อมโยง' },
  '23505': { code: 'UNIQUE_VIOLATION', message: 'ข้อมูลนี้มีอยู่ในระบบแล้ว' },
  '23514': { code: 'CHECK_VIOLATION', message: 'ข้อมูลไม่ถูกต้องตามเงื่อนไขที่กำหนด' },

  // Integrity constraint violation (Class 23)
  '23000': { code: 'INTEGRITY_VIOLATION', message: 'ข้อมูลไม่สอดคล้องกัน' },

  // Invalid cursor specification (Class 24)
  '24000': { code: 'INVALID_CURSOR', message: 'ตัวชี้ไม่ถูกต้อง' },

  // Invalid transaction initiation (Class 25)
  '25000': { code: 'INVALID_TRANSACTION', message: 'Transaction ไม่ถูกต้อง' },

  // Invalid SQL statement name (Class 26)
  '26000': { code: 'INVALID_STATEMENT', message: 'คำสั่ง SQL ไม่ถูกต้อง' },

  // Triggered data change violation (Class 27)
  '27000': { code: 'TRIGGERED_DATA_CHANGE', message: 'ข้อมูลถูกเปลี่ยนแปลงโดย trigger' },

  // Invalid authorization specification (Class 28)
  '28000': { code: 'INVALID_AUTHORIZATION', message: 'การอนุญาตไม่ถูกต้อง' },

  // Invalid transaction termination (Class 2B)
  '2B000': { code: 'TRANSACTION_TERMINATION', message: 'การสิ้นสุด transaction ไม่ถูกต้อง' },

  // SQL statement not yet complete (Class 30)
  '03000': { code: 'INCOMPLETE_STATEMENT', message: 'คำสั่ง SQL ยังไม่สมบูรณ์' },

  // Connection exception (Class 08 - already covered above)
  // Insufficient resources (Class 53)
  '53000': { code: 'INSUFFICIENT_RESOURCES', message: 'ทรัพยากรไม่เพียงพอ' },
  '53100': { code: 'DISK_FULL', message: 'พื้นที่จัดเก็บเต็ม' },
  '53200': { code: 'OUT_OF_MEMORY', message: 'หน่วยความจำไม่เพียงพอ' },
  '53300': { code: 'TOO_MANY_CONNECTIONS', message: 'การเชื่อมต่อมีมากเกินไป' },

  // Program limit exceeded (Class 54)
  '54000': { code: 'PROGRAM_LIMIT_EXCEEDED', message: 'เกินขีดจำกัดของโปรแกรม' },
  '54001': { code: 'STATEMENT_TOO_COMPLEX', message: 'คำสั่งซับซ้อนเกินไป' },

  // Object not in prerequisite state (Class 55)
  '55000': { code: 'OBJECT_NOT_IN_PREREQUISITE_STATE', message: 'ออบเจ็กต์ไม่พร้อมใช้งาน' },
  '55006': { code: 'OBJECT_IN_USE', message: 'ออบเจ็กต์กำลังถูกใช้อยู่' },

  // Operator intervention (Class 57)
  '57000': { code: 'OPERATOR_INTERVENTION', message: 'มีการแทรกแซงจากระบบ' },
  '57014': { code: 'QUERY_CANCELLED', message: 'คำสั่งถูกยกเลิก' },

  // System error (Class 58)
  '58000': { code: 'SYSTEM_ERROR', message: 'ระบบเกิดข้อผิดพลาด' },
  '58030': { code: 'IO_ERROR', message: 'อ่าน/เขียนข้อมูลผิดพลาด' },

  // Configuration file error (Class F0)
  'F0000': { code: 'CONFIG_FILE_ERROR', message: 'ไฟล์การตั้งค่าผิดพลาด' },
  'F0001': { code: 'LOCK_FILE_EXISTS', message: 'ไฟล์ล็อกมีอยู่แล้ว' },
};

/**
 * Supabase/Postgrest specific error codes
 */
const SUPABASE_ERROR_MAP: Record<string, { code: string; message: string }> = {
  'PGRST116': { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลที่ค้นหา' },
  'PGRST204': { code: 'NO_CONTENT', message: 'ไม่มีข้อมูลที่ส่งคืน' },
  'JWT': { code: 'INVALID_TOKEN', message: 'Token ไม่ถูกต้องหรือหมดอายุ' },
  'RLS': { code: 'RLS_VIOLATION', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
};

/**
 * Authentication error mappings
 */
const AUTH_ERROR_MAP: Record<string, { code: string; message: string }> = {
  'Email not confirmed': { code: 'EMAIL_NOT_VERIFIED', message: 'กรุณายืนยันอีเมลของคุณก่อนเข้าใช้งาน' },
  'Invalid login credentials': { code: 'INVALID_CREDENTIALS', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
  'User already registered': { code: 'EMAIL_ALREADY_EXISTS', message: 'อีเมลนี้ถูกลงทะเบียนแล้ว' },
  'Password should be at least 6 characters': { code: 'WEAK_PASSWORD', message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
  'Signups not allowed': { code: 'SIGNUPS_DISABLED', message: 'ระบบไม่เปิดรับสมัครสมาชิกใหม่' },
  'Email rate limit exceeded': { code: 'RATE_LIMIT_EXCEEDED', message: 'ส่งอีเมลถี่เกินไป กรุณารอสักครู่' },
};

// ====================================================================
// TABLE NAMES FOR ERROR CONTEXT
// ====================================================================

const TABLE_NAMES_THAI: Record<string, string> = {
  tenants: 'องค์กร',
  users: 'ผู้ใช้',
  user_tenants: 'ความสัมพันธ์ผู้ใช้-องค์กร',
  properties: 'ทรัพย์สิน',
  units: 'หน่วยทรัพย์สิน',
  customers: 'ลูกค้า',
  bookings: 'การจอง',
  payments: 'การชำระเงิน',
  leads: 'ลูกค้าสนใจ',
  campaigns: 'แคมเปญ',
  notifications: 'การแจ้งเตือน',
  audit_logs: 'บันทึกกิจกรรม',
};

function getTableName(table?: string): string {
  if (!table) return '';
  return TABLE_NAMES_THAI[table] || table;
}

// ====================================================================
// MAIN ERROR HANDLING FUNCTION
// ====================================================================

/**
 * Main function to convert any error to AppError
 * @param error - The error to handle
 * @param context - Additional context for the error
 * @returns AppError instance
 */
export function handleApiError(
  error: unknown,
  context?: {
    table?: string;
    operation?: 'select' | 'insert' | 'update' | 'delete';
    action?: string;
    userId?: string;
    tenantId?: string;
  }
): AppError {
  // Already an AppError, return as-is
  if (isAppError(error)) {
    return error;
  }

  // Network error
  if (isNetworkError(error)) {
    return new NetworkError({
      technicalMessage: error instanceof Error ? error.message : undefined,
      meta: { userId: context?.userId, tenantId: context?.tenantId },
    });
  }

  // Supabase PostgrestError
  if (isPostgrestError(error)) {
    return handlePostgrestError(error, context);
  }

  // Supabase AuthError
  if (isAuthError(error)) {
    return handleAuthError(error, context);
  }

  // Generic Error
  if (error instanceof Error) {
    return new AppError({
      code: 'UNKNOWN_ERROR',
      category: 'UNKNOWN' as any,
      severity: ErrorSeverity.MEDIUM,
      userMessage: getUserErrorMessage(error),
      technicalMessage: error.message,
      originalError: error,
      meta: { userId: context?.userId, tenantId: context?.tenantId },
    });
  }

  // Unknown error type
  return new AppError({
    code: 'UNKNOWN_ERROR',
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    userMessage: getUserErrorMessage(error),
    technicalMessage: String(error),
    originalError: error,
    meta: { userId: context?.userId, tenantId: context?.tenantId },
  });
}

// ====================================================================
// POSTGREST ERROR HANDLER
// ====================================================================

function handlePostgrestError(
  error: PostgrestError,
  context?: {
    table?: string;
    operation?: 'select' | 'insert' | 'update' | 'delete';
    action?: string;
    userId?: string;
    tenantId?: string;
  }
): AppError {
  const tableName = getTableName(context?.table);

  // Check PostgreSQL error code map
  const pgError = POSTGRESQL_ERROR_MAP[error.code];
  if (pgError) {
    // Special handling for permission/RLS errors
    if (error.code === '42501' || error.message.includes('RLS')) {
      return new PermissionError({
        code: PERMISSION_ERROR_CODES.TENANT_ACCESS_DENIED,
        userMessage: `คุณไม่มีสิทธิ์เข้าถึง${tableName}`,
        resource: tableName,
        originalError: error,
        meta: { userId: context?.userId, tenantId: context?.tenantId },
      });
    }

    // Special handling for unique violations
    if (error.code === '23505') {
      return new BusinessLogicError({
        code: 'DUPLICATE_ENTRY',
        userMessage: `ข้อมูล${tableName}นี้มีอยู่ในระบบแล้ว`,
        technicalMessage: error.message,
        meta: { userId: context?.userId, tenantId: context?.tenantId },
      });
    }

    // General database error
    return new DatabaseError({
      code: pgError.code,
      userMessage: pgError.message,
      technicalMessage: error.message,
      table: context?.table,
      operation: context?.operation,
      originalError: error,
      meta: { userId: context?.userId, tenantId: context?.tenantId },
    });
  }

  // Check Supabase-specific error codes
  const supabaseError = SUPABASE_ERROR_MAP[error.code];
  if (supabaseError) {
    if (supabaseError.code === 'NOT_FOUND') {
      return new NotFoundError({
        resource: tableName,
        meta: { userId: context?.userId, tenantId: context?.tenantId },
      });
    }

    return new DatabaseError({
      code: supabaseError.code,
      userMessage: supabaseError.message,
      technicalMessage: error.message,
      table: context?.table,
      operation: context?.operation,
      originalError: error,
      meta: { userId: context?.userId, tenantId: context?.tenantId },
    });
  }

  // RLS violation (common pattern in error message)
  if (
    error.message.includes('permission denied') ||
    error.message.includes('RLS') ||
    error.message.includes('row-level security')
  ) {
    return new PermissionError({
      code: PERMISSION_ERROR_CODES.TENANT_ACCESS_DENIED,
      userMessage: `คุณไม่มีสิทธิ์เข้าถึง${tableName}`,
      resource: tableName,
      originalError: error,
      meta: { userId: context?.userId, tenantId: context?.tenantId },
    });
  }

  // Default database error
  return new DatabaseError({
    code: 'DATABASE_ERROR',
    userMessage: `เกิดข้อผิดพลาดในการ${context?.operation || 'ทำงานกับ'}${tableName}`,
    technicalMessage: error.message,
    table: context?.table,
    operation: context?.operation,
    originalError: error,
    meta: { userId: context?.userId, tenantId: context?.tenantId },
  });
}

// ====================================================================
// AUTH ERROR HANDLER
// ====================================================================

function handleAuthError(
  error: AuthError,
  context?: {
    action?: string;
    userId?: string;
    tenantId?: string;
  }
): AuthenticationError {
  // Check auth error map
  const mappedError = AUTH_ERROR_MAP[error.message];
  if (mappedError) {
    return new AuthenticationError({
      code: mappedError.code,
      userMessage: mappedError.message,
      technicalMessage: error.message,
      originalError: error,
      meta: {
        userId: context?.userId,
        tenantId: context?.tenantId,
        action: context?.action,
      },
    });
  }

  // Check status code
  if (error.status === 401) {
    return new AuthenticationError({
      code: AUTH_ERROR_CODES.SESSION_EXPIRED,
      userMessage: 'เซสชันของคุณหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่',
      technicalMessage: 'Session expired',
      originalError: error,
      meta: { userId: context?.userId, tenantId: context?.tenantId },
    });
  }

  if (error.status === 403) {
    return new AuthenticationError({
      code: AUTH_ERROR_CODES.TOKEN_INVALID,
      userMessage: 'ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่',
      technicalMessage: 'Access forbidden',
      originalError: error,
      meta: { userId: context?.userId, tenantId: context?.tenantId },
    });
  }

  // Default auth error
  return new AuthenticationError({
    code: 'AUTH_ERROR',
    userMessage: getUserErrorMessage(error),
    technicalMessage: error.message,
    originalError: error,
    meta: {
      userId: context?.userId,
      tenantId: context?.tenantId,
      action: context?.action,
    },
  });
}

// ====================================================================
// HELPER FUNCTIONS FOR COMMON OPERATIONS
// ====================================================================

/**
 * Wrap a Supabase query with error handling
 * @param queryFn - The async function to execute
 * @param context - Error context
 * @returns The result or throws AppError
 */
export async function withErrorHandling<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  context?: {
    table?: string;
    operation?: 'select' | 'insert' | 'update' | 'delete';
    action?: string;
    userId?: string;
    tenantId?: string;
  }
): Promise<T> {
  try {
    const result = await queryFn();

    if (result.error) {
      throw handleApiError(result.error, context);
    }

    if (result.data === null) {
      throw new NotFoundError({
        resource: getTableName(context?.table) || 'ข้อมูล',
        meta: { userId: context?.userId, tenantId: context?.tenantId },
      });
    }

    return result.data;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleApiError(error, context);
  }
}

/**
 * Safe query execution - returns null instead of throwing on not found
 * @param queryFn - The async function to execute
 * @param context - Error context
 * @returns The result or null on error
 */
export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  context?: {
    table?: string;
    operation?: 'select' | 'insert' | 'update' | 'delete';
    action?: string;
    userId?: string;
    tenantId?: string;
  }
): Promise<T | null> {
  try {
    return await withErrorHandling(queryFn, context);
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') {
      logError(error, context);
      return null;
    }
    throw error;
  }
}

/**
 * Batch query with error aggregation
 * @param queries - Array of query functions with names
 * @param context - Shared error context
 * @returns Object with results and errors
 */
export async function batchQuery<T extends Record<string, any>>(
  queries: Array<{
    name: string;
    fn: () => Promise<{ data: any; error: PostgrestError | null }>;
  }>,
  context?: {
    userId?: string;
    tenantId?: string;
  }
): Promise<{
  results: Partial<T>;
  errors: Array<{ name: string; error: AppError }>;
}> {
  const results: Partial<T> = {};
  const errors: Array<{ name: string; error: AppError }> = [];

  await Promise.all(
    queries.map(async (query) => {
      try {
        const result = await withErrorHandling(query.fn, {
          ...context,
          action: query.name,
        });
        results[query.name as keyof T] = result;
      } catch (error) {
        if (isAppError(error)) {
          errors.push({ name: query.name, error });
          logError(error, { ...context, query: query.name });
        }
      }
    })
  );

  return { results, errors };
}

/**
 * Retry query with exponential backoff
 * @param queryFn - The async function to execute
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param context - Error context
 * @returns The result
 */
export async function retryQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  maxRetries: number = 3,
  context?: {
    table?: string;
    operation?: 'select' | 'insert' | 'update' | 'delete';
    action?: string;
    userId?: string;
    tenantId?: string;
  }
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withErrorHandling(queryFn, context);
    } catch (error) {
      lastError = error;

      if (isAppError(error)) {
        // Don't retry if error is not retryable
        if (!error.retryable) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError;
}

// ====================================================================
// EXPORTS
// ====================================================================
