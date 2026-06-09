# Production-Ready API Layer Best Practices
## React/TypeScript SaaS Application - Multi-Tenant Real Estate Management Platform

## Table of Contents
1. [API Middleware Patterns](#api-middleware-patterns)
2. [API Versioning Strategies](#api-versioning-strategies)
3. [Supabase Integration](#supabase-integration)
4. [Complete Implementation Example](#complete-implementation-example)
5. [Monitoring and Performance](#monitoring-and-performance)
6. [Security Checklist](#security-checklist)

---

## API Middleware Patterns

### 1. Error Handling and Response Formatting

Create a centralized error handling middleware that ensures consistent response formats across your API:

```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  tenantId?: string;
  userId?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
    tenantId?: string;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    version: string;
  };
}

export class AppError extends Error implements ApiError {
  public statusCode: number;
  public isOperational: boolean;
  public tenantId?: string;
  public userId?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    tenantId?: string,
    userId?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.tenantId = tenantId;
    this.userId = userId;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized access';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  const response: ApiResponse = {
    success: false,
    error: {
      code: getErrorCode(err),
      message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      timestamp: new Date().toISOString(),
      requestId,
      tenantId: (req as any).tenantId
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      version: req.headers['api-version'] || '1.0'
    }
  };

  res.status(statusCode).json(response);
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getErrorCode(err: ApiError): string {
  if (err.statusCode === 400) return 'BAD_REQUEST';
  if (err.statusCode === 401) return 'UNAUTHORIZED';
  if (err.statusCode === 403) return 'FORBIDDEN';
  if (err.statusCode === 404) return 'NOT_FOUND';
  if (err.statusCode === 409) return 'CONFLICT';
  if (err.statusCode === 422) return 'VALIDATION_ERROR';
  if (err.statusCode === 429) return 'RATE_LIMIT_EXCEEDED';
  return 'INTERNAL_ERROR';
}
```

### 2. Request Logging and Monitoring

Implement comprehensive logging with structured data for production monitoring:

```typescript
// src/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface RequestLog {
  requestId: string;
  timestamp: string;
  method: string;
  url: string;
  userAgent: string;
  ip: string;
  tenantId?: string;
  userId?: string;
  duration?: number;
  statusCode?: number;
  error?: string;
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.headers['x-request-id'] = requestId;

  const startTime = Date.now();
  const logData: Partial<RequestLog> = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: getClientIp(req),
    tenantId: (req as any).tenantId,
    userId: (req as any).userId
  };

  // Log request
  console.log(JSON.stringify({
    type: 'request',
    ...logData
  }));

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;

    const responseLog = {
      type: 'response',
      ...logData,
      duration,
      statusCode: res.statusCode,
      contentLength: res.get('Content-Length')
    };

    if (res.statusCode >= 400) {
      responseLog.error = `HTTP ${res.statusCode}`;
    }

    console.log(JSON.stringify(responseLog));

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
         req.headers['x-real-ip'] as string ||
         req.connection.remoteAddress ||
         'unknown';
}

// Monitoring middleware for health checks and metrics
export const metricsCollector = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

    // Record metrics (you can send this to your monitoring system)
    recordApiMetric({
      method: req.method,
      path: req.route?.path || req.path,
      statusCode: res.statusCode,
      duration,
      tenantId: (req as any).tenantId,
      userAgent: req.headers['user-agent']
    });
  });

  next();
};

function recordApiMetric(data: any) {
  // Implement your metrics collection here
  // Examples: Prometheus, DataDog, New Relic, etc.
  console.log(JSON.stringify({
    type: 'metric',
    ...data,
    timestamp: new Date().toISOString()
  }));
}
```

### 3. Rate Limiting Implementation

Implement tiered rate limiting for different user types and endpoints:

```typescript
// src/middleware/rateLimiter.ts
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';

// Rate limiter configurations for different scenarios
export const rateLimiters = {
  // General API rate limiting
  general: new RateLimiterRedis({
    storeClient: createRedisClient(),
    keyPrefix: 'rl_general',
    points: 100, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 60, // Block for 60 seconds if limit exceeded
  }),

  // Auth endpoints - more restrictive
  auth: new RateLimiterRedis({
    storeClient: createRedisClient(),
    keyPrefix: 'rl_auth',
    points: 5, // Number of requests
    duration: 900, // Per 15 minutes
    blockDuration: 900,
  }),

  // Premium tier users
  premium: new RateLimiterRedis({
    storeClient: createRedisClient(),
    keyPrefix: 'rl_premium',
    points: 1000,
    duration: 60,
    blockDuration: 60,
  }),

  // Data intensive operations
  dataIntensive: new RateLimiterRedis({
    storeClient: createRedisClient(),
    keyPrefix: 'rl_data',
    points: 10,
    duration: 60,
    blockDuration: 60,
  }),
};

export const createRateLimitMiddleware = (limiterType: keyof typeof rateLimiters) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = getRateLimitKey(req);
      const limiter = rateLimiters[limiterType];

      await limiter.consume(key);
      next();
    } catch (rejRes: any) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;

      res.set('Retry-After', String(secs));
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
          retryAfter: secs
        }
      });
    }
  };
};

function getRateLimitKey(req: Request): string {
  const tenantId = (req as any).tenantId;
  const userId = (req as any).userId;
  const ip = getClientIp(req);

  // Priority: User ID > Tenant ID > IP Address
  return userId ? `user:${userId}` :
         tenantId ? `tenant:${tenantId}` :
         `ip:${ip}`;
}

function createRedisClient() {
  // Create and return Redis client instance
  // Implementation depends on your Redis setup
  return {
    // Redis client implementation
  };
}
```

### 4. Request Validation and Sanitization

Create robust validation middleware using express-validator:

```typescript
// src/middleware/validation.ts
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Common validation chains
export const validations = {
  // Real estate property validation
  createProperty: [
    body('title')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('description')
      .trim()
      .isLength({ min: 10, max: 2000 })
      .withMessage('Description must be between 10 and 2000 characters'),
    body('price')
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('type')
      .isIn(['apartment', 'house', 'commercial', 'land'])
      .withMessage('Invalid property type'),
    body('address')
      .isObject()
      .withMessage('Address must be an object'),
    body('address.street')
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Street address is required'),
    body('address.city')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('City is required'),
    body('address.postalCode')
      .trim()
      .matches(/^[A-Za-z0-9\s\-]+$/)
      .withMessage('Invalid postal code format'),
    body('features')
      .isArray()
      .optional()
      .withMessage('Features must be an array'),
    body('images')
      .isArray({ max: 20 })
      .withMessage('Maximum 20 images allowed'),
    body('tenantId')
      .isUUID()
      .withMessage('Valid tenant ID is required'),
  ],

  // User registration validation
  userRegistration: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character'),
    body('firstName')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    body('phone')
      .trim()
      .matches(/^\+?[\d\s\-\(\)]+$/)
      .withMessage('Invalid phone number format'),
    body('tenantId')
      .isUUID()
      .withMessage('Valid tenant ID is required'),
    body('role')
      .isIn(['admin', 'agent', 'viewer'])
      .withMessage('Invalid user role'),
  ],

  // Property search validation
  propertySearch: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('minPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum price must be positive'),
    query('maxPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum price must be positive'),
    query('propertyType')
      .optional()
      .isIn(['apartment', 'house', 'commercial', 'land'])
      .withMessage('Invalid property type'),
    query('sortBy')
      .optional()
      .isIn(['price', 'date', 'size', 'location'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
  ],
};

// Validation middleware
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    for (const validation of validations) {
      const result = await validation.run(req);
      if (!result.isEmpty()) break;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors.array().map(err => ({
            field: err.param,
            message: err.msg,
            value: err.value,
          })),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        }
      });
    }

    next();
  };
};

// Sanitization middleware
export const sanitize = (req: Request, res: Response, next: NextFunction) => {
  // Remove potential XSS from string inputs
  const sanitizeString = (value: any): any => {
    if (typeof value === 'string') {
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    }
    return value;
  };

  const sanitizeObject = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return sanitizeString(obj);
  };

  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);

  next();
};
```

---

## API Versioning Strategies

### 1. URL Versioning Implementation

```typescript
// src/routes/v1/propertyRoutes.ts
import { Router } from 'express';

const router = Router();

// Version 1 property routes
router.get('/properties', propertyController.getProperties);
router.post('/properties',
  createRateLimitMiddleware('general'),
  validate(validations.createProperty),
  propertyController.createProperty
);
router.get('/properties/:id', propertyController.getProperty);
router.put('/properties/:id', propertyController.updateProperty);
router.delete('/properties/:id', propertyController.deleteProperty);

export default router;
```

### 2. Header Versioning Implementation

```typescript
// src/middleware/apiVersion.ts
import { Request, Response, NextFunction } from 'express';

export interface VersionedRequest extends Request {
  apiVersion: string;
}

export const apiVersionMiddleware = (req: VersionedRequest, res: Response, next: NextFunction) => {
  // Try to get version from header first
  const versionFromHeader = req.headers['api-version'] as string;
  const versionFromAccept = req.headers.accept?.match(/application\/vnd\.realestate\.v(\d+)\+json/);

  const version = versionFromHeader ||
                 versionFromAccept?.[1] ||
                 req.baseUrl.match(/\/v(\d+)/)?.[1] ||
                 '1';

  req.apiVersion = version;

  // Set response headers
  res.setHeader('API-Version', version);
  res.setHeader('Supported-Versions', '1,2');

  // Check if version is supported
  const supportedVersions = ['1', '2'];
  if (!supportedVersions.includes(version)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'UNSUPPORTED_VERSION',
        message: `API version ${version} is not supported`,
        supportedVersions,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'],
      }
    });
  }

  next();
};

// Version-specific router
export const createVersionedRouter = () => {
  const router = Router();

  router.use(apiVersionMiddleware);

  // Route to version-specific handlers
  router.use((req: VersionedRequest, res: Response, next: NextFunction) => {
    req.baseUrl = `/v${req.apiVersion}`;
    next();
  });

  return router;
};
```

### 3. Backward Compatibility Implementation

```typescript
// src/controllers/propertyController.ts
import { Request, Response } from 'express';

class PropertyController {
  // Unified handler that supports multiple versions
  async getProperties(req: Request, res: Response) {
    const { apiVersion } = req as any;

    switch (apiVersion) {
      case '1':
        return this.getPropertiesV1(req, res);
      case '2':
        return this.getPropertiesV2(req, res);
      default:
        return this.getPropertiesV1(req, res);
    }
  }

  private async getPropertiesV1(req: Request, res: Response) {
    // Version 1 implementation - legacy format
    const properties = await propertyService.getPropertiesV1(req.query);

    res.json({
      success: true,
      data: properties.map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        address: `${p.address.street}, ${p.address.city}`,
        // V1 specific fields
        contact_info: {
          phone: p.agent.phone,
          email: p.agent.email
        }
      })),
      meta: {
        page: req.query.page || 1,
        total: properties.length
      }
    });
  }

  private async getPropertiesV2(req: Request, res: Response) {
    // Version 2 implementation - enhanced format
    const properties = await propertyService.getPropertiesV2(req.query);

    res.json({
      success: true,
      data: properties,
      meta: {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        total: properties.total,
        totalPages: Math.ceil(properties.total / (parseInt(req.query.limit as string) || 10)),
        filters: req.query,
        sorts: {
          available: ['price', 'date_created', 'size', 'location']
        }
      },
      links: {
        self: req.originalUrl,
        first: `${req.baseUrl}?page=1`,
        last: `${req.baseUrl}?page=${Math.ceil(properties.total / (parseInt(req.query.limit as string) || 10))}`,
        prev: properties.page > 1 ? `${req.baseUrl}?page=${properties.page - 1}` : null,
        next: properties.page < Math.ceil(properties.total / (parseInt(req.query.limit as string) || 10)) ?
              `${req.baseUrl}?page=${properties.page + 1}` : null
      }
    });
  }
}
```

### 4. Deprecation Policy Implementation

```typescript
// src/middleware/deprecation.ts
import { Request, Response, NextFunction } from 'express';

interface DeprecationRule {
  version: string;
  deprecationDate: string;
  sunsetDate: string;
  migrationGuide: string;
  recommendedVersion: string;
}

const deprecationRules: DeprecationRule[] = [
  {
    version: '1',
    deprecationDate: '2025-01-01',
    sunsetDate: '2025-07-01',
    migrationGuide: 'https://docs.realestate.com/migration/v1-to-v2',
    recommendedVersion: '2'
  }
];

export const deprecationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiVersion = (req as any).apiVersion || '1';
  const deprecationRule = deprecationRules.find(rule => rule.version === apiVersion);

  if (deprecationRule) {
    const now = new Date();
    const deprecationDate = new Date(deprecationRule.deprecationDate);
    const sunsetDate = new Date(deprecationRule.sunsetDate);

    // Set deprecation headers
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate.toISOString());
    res.setHeader('Link',
      `<${deprecationRule.migrationGuide}>; rel="deprecation"; type="text/html"`
    );

    // Add warning header
    res.setHeader('Warning',
      `299 - "API version ${apiVersion} is deprecated. Please migrate to version ${deprecationRule.recommendedVersion}. See ${deprecationRule.migrationGuide}"`
    );

    // If sunset date has passed, reject the request
    if (now > sunsetDate) {
      return res.status(410).json({
        success: false,
        error: {
          code: 'VERSION_DEPRECATED',
          message: `API version ${apiVersion} is no longer supported`,
          recommendedVersion: deprecationRule.recommendedVersion,
          migrationGuide: deprecationRule.migrationGuide,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        }
      });
    }
  }

  next();
};
```

---

## Supabase Integration

### 1. Supabase Client Configuration

```typescript
// src/config/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

class SupabaseManager {
  private static instance: SupabaseManager;
  private supabase: SupabaseClient<Database>;
  private adminClient: SupabaseClient<Database>;

  private constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_ANON_KEY!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Client with RLS policies
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'x-application-name': 'real-estate-platform'
        }
      }
    });

    // Admin client bypasses RLS
    this.adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      db: {
        schema: 'public'
      }
    });
  }

  public static getInstance(): SupabaseManager {
    if (!SupabaseManager.instance) {
      SupabaseManager.instance = new SupabaseManager();
    }
    return SupabaseManager.instance;
  }

  public getClient(tenantId?: string): SupabaseClient<Database> {
    if (tenantId) {
      // Create tenant-specific client
      const client = this.supabase;
      client.realtime.setAuth(this.supabase.supabaseKey);

      // Set tenant context for RLS
      client.rpc('set_tenant_context', { p_tenant_id: tenantId });

      return client;
    }
    return this.supabase;
  }

  public getAdminClient(): SupabaseClient<Database> {
    return this.adminClient;
  }

  // Connection pooling and performance optimization
  public async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.supabase.from('tenants').select('id').limit(1);
      return !error;
    } catch (error) {
      return false;
    }
  }

  // Batch operations for better performance
  public async batchInsert<T>(
    table: string,
    records: T[],
    tenantId: string
  ): Promise<{ data: T[] | null; error: any }> {
    const client = this.getClient(tenantId);

    return client.from(table as any).insert(records).select();
  }

  // Optimized queries with specific columns
  public async getProperties(
    tenantId: string,
    filters: any = {},
    pagination: { page: number; limit: number } = { page: 1, limit: 10 },
    columns: string = '*'
  ) {
    const client = this.getClient(tenantId);
    let query = client.from('properties').select(columns, { count: 'exact' });

    // Apply filters
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.minPrice) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters.maxPrice) {
      query = query.lte('price', filters.maxPrice);
    }
    if (filters.city) {
      query = query.ilike('address->>city', `%${filters.city}%`);
    }

    // Apply pagination
    const from = (pagination.page - 1) * pagination.limit;
    const to = from + pagination.limit - 1;

    return query.range(from, to);
  }
}

export default SupabaseManager;
```

### 2. Row Level Security (RLS) Implementation

```sql
-- SQL: Enable RLS and create policies for multi-tenant architecture

-- Enable RLS on all tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_views ENABLE ROW LEVEL SECURITY;

-- Create function to get current tenant context
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_tenant_id UUID;
BEGIN
  -- Get tenant ID from JWT claims
  current_tenant_id := auth.jwt() ->> 'tenant_id';

  -- Fallback to session variable
  IF current_tenant_id IS NULL THEN
    SELECT current_setting('app.current_tenant_id', true)::UUID
    INTO current_tenant_id;
  END IF;

  RETURN current_tenant_id;
END;
$$;

-- Set tenant context function
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, true);
END;
$$;

-- Property table RLS policies
CREATE POLICY "Users can view properties from their tenant"
ON properties
FOR SELECT
USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Users can insert properties for their tenant"
ON properties
FOR INSERT
WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Users can update properties from their tenant"
ON properties
FOR UPDATE
USING (tenant_id = get_current_tenant_id())
WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Admins can delete properties from their tenant"
ON properties
FOR DELETE
USING (
  tenant_id = get_current_tenant_id() AND
  auth.jwt() ->> 'role' = 'admin'
);

-- Users table RLS policies
CREATE POLICY "Users can view their own profile"
ON users
FOR SELECT
USING (
  id = auth.uid() OR
  (tenant_id = get_current_tenant_id() AND
   auth.jwt() ->> 'role' IN ('admin', 'manager'))
);

CREATE POLICY "Users can insert users for their tenant"
ON users
FOR INSERT
WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Users can update users in their tenant"
ON users
FOR UPDATE
USING (
  id = auth.uid() OR
  (tenant_id = get_current_tenant_id() AND
   auth.jwt() ->> 'role' IN ('admin', 'manager'))
)
WITH CHECK (
  tenant_id = get_current_tenant_id()
);

-- Property images RLS policies
CREATE POLICY "Users can view property images from their tenant"
ON property_images
FOR SELECT
USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Users can manage property images for their tenant"
ON property_images
FOR ALL
USING (tenant_id = get_current_tenant_id())
WITH CHECK (tenant_id = get_current_tenant_id());

-- Property views tracking (allow inserts for views)
CREATE POLICY "Track property views"
ON property_views
FOR INSERT
WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Users can view property view analytics from their tenant"
ON property_views
FOR SELECT
USING (
  tenant_id = get_current_tenant_id() AND
  auth.jwt() ->> 'role' IN ('admin', 'agent', 'manager')
);

-- Create indexes for RLS performance
CREATE INDEX idx_properties_tenant_id ON properties(tenant_id);
CREATE INDEX idx_properties_type ON properties(type) WHERE tenant_id = get_current_tenant_id();
CREATE INDEX idx_properties_price ON properties(price) WHERE tenant_id = get_current_tenant_id();
CREATE INDEX idx_properties_created_at ON properties(created_at) WHERE tenant_id = get_current_tenant_id();
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email) WHERE tenant_id = get_current_tenant_id();
CREATE INDEX idx_property_views_property_id ON property_views(property_id);
CREATE INDEX idx_property_views_tenant_id ON property_views(tenant_id);
```

### 3. Connection Pooling Configuration

```typescript
// src/config/database.ts
import { Pool } from 'pg';

// PostgreSQL connection pool for direct database operations
export const dbPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20, // Maximum number of connections
  min: 5,  // Minimum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  application_name: 'real-estate-api',
  // Connection pooling for multi-tenant
  // Each tenant gets its own connection when needed
});

// Health check function
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; details: any }> {
  const client = await dbPool.connect();
  try {
    const result = await client.query({
      text: 'SELECT 1 as health_check',
      name: 'health-check'
    });

    const poolInfo = {
      totalCount: dbPool.totalCount,
      idleCount: dbPool.idleCount,
      waitingCount: dbPool.waitingCount
    };

    return {
      healthy: result.rows.length > 0,
      details: poolInfo
    };
  } catch (error) {
    return {
      healthy: false,
      details: { error: (error as Error).message }
    };
  } finally {
    client.release();
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await dbPool.end();
});

process.on('SIGINT', async () => {
  await dbPool.end();
});
```

### 4. Performance Optimization Patterns

```typescript
// src/services/propertyService.ts
import SupabaseManager from '../config/supabase';

class PropertyService {
  private supabase: SupabaseManager;

  constructor() {
    this.supabase = SupabaseManager.getInstance();
  }

  // Optimized property search with caching
  async searchProperties(tenantId: string, criteria: any) {
    const cacheKey = `search:${tenantId}:${JSON.stringify(criteria)}`;

    // Try to get from cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Build optimized query
    const client = this.supabase.getClient(tenantId);
    let query = client
      .from('properties')
      .select(`
        *,
        images:property_images(url, is_primary),
        agent:users(name, email, phone),
        view_count:property_views(count)
      `, { count: 'exact' });

    // Apply filters efficiently
    if (criteria.priceRange) {
      query = query
        .gte('price', criteria.priceRange.min)
        .lte('price', criteria.priceRange.max);
    }

    if (criteria.location) {
      query = query.ilike('address->>city', `%${criteria.location}%`);
    }

    if (criteria.features && criteria.features.length > 0) {
      query = query.contains('features', criteria.features);
    }

    // Apply pagination
    const page = criteria.page || 1;
    const limit = Math.min(criteria.limit || 10, 100); // Max 100 items
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to search properties: ${error.message}`);
    }

    const result = {
      properties: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };

    // Cache for 5 minutes
    await this.setCache(cacheKey, result, 300);

    return result;
  }

  // Batch operations for better performance
  async createPropertyBatch(tenantId: string, properties: any[]) {
    const client = this.supabase.getClient(tenantId);

    // Use transaction for batch insert
    const { data, error } = await client.rpc('create_properties_batch', {
      p_tenant_id: tenantId,
      p_properties: properties
    });

    if (error) {
      throw new Error(`Failed to create properties batch: ${error.message}`);
    }

    return data;
  }

  // Real-time subscriptions with tenant isolation
  subscribeToPropertyUpdates(tenantId: string, callback: Function) {
    const client = this.supabase.getClient(tenantId);

    return client
      .channel(`properties:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
          filter: `tenant_id=eq.${tenantId}`
        },
        callback
      )
      .subscribe();
  }

  // Cache helper methods
  private async getFromCache(key: string): Promise<any | null> {
    // Implement your cache logic (Redis, etc.)
    return null;
  }

  private async setCache(key: string, value: any, ttl: number): Promise<void> {
    // Implement your cache logic (Redis, etc.)
  }
}
```

---

## Complete Implementation Example

### 1. Main Application Setup

```typescript
// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';

import { errorHandler, asyncHandler } from './middleware/errorHandler';
import { requestLogger, metricsCollector } from './middleware/requestLogger';
import { apiVersionMiddleware, createVersionedRouter } from './middleware/apiVersion';
import { deprecationMiddleware } from './middleware/deprecation';
import { sanitize, validate } from './middleware/validation';
import { createRateLimitMiddleware } from './middleware/rateLimiter';

// Import routes
import v1Routes from './routes/v1';
import v2Routes from './routes/v2';
import healthRoutes from './routes/health';

const app = express();
const server = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Request-ID',
    'API-Version'
  ]
}));

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging and monitoring
app.use(requestLogger);
app.use(metricsCollector);

// Sanitization
app.use(sanitize);

// API versioning
const versionRouter = createVersionedRouter();
app.use('/api', versionRouter);

// Health check (no versioning)
app.use('/health', healthRoutes);

// Versioned routes
app.use('/api/v1', v1Routes);
app.use('/api/v2', v2Routes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    }
  });
});

// Global error handler
app.use(errorHandler);

export { app, server };
```

### 2. Server Startup

```typescript
// src/server.ts
import { app, server } from './app';
import { config } from './config';
import { checkDatabaseHealth } from './config/database';
import SupabaseManager from './config/supabase';

async function startServer() {
  const port = config.port || 3000;

  // Health checks
  console.log('Performing health checks...');

  const dbHealth = await checkDatabaseHealth();
  if (!dbHealth.healthy) {
    console.error('Database health check failed:', dbHealth.details);
    process.exit(1);
  }

  const supabaseHealth = await SupabaseManager.getInstance().healthCheck();
  if (!supabaseHealth) {
    console.error('Supabase health check failed');
    process.exit(1);
  }

  console.log('All health checks passed');

  // Start server
  server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 Health endpoint: http://localhost:${port}/health`);
    console.log(`📖 API documentation: http://localhost:${port}/api/docs`);
  });

  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
```

### 3. Configuration Management

```typescript
// src/config/index.ts
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.number().default(3000),

  // Database
  database: z.object({
    url: z.string(),
    poolSize: z.number().default(20),
  }),

  // Supabase
  supabase: z.object({
    url: z.string(),
    anonKey: z.string(),
    serviceKey: z.string(),
  }),

  // Redis
  redis: z.object({
    host: z.string(),
    port: z.number(),
    password: z.string().optional(),
  }),

  // JWT
  jwt: z.object({
    secret: z.string(),
    expiresIn: z.string().default('24h'),
    refreshExpiresIn: z.string().default('7d'),
  }),

  // CORS
  cors: z.object({
    origins: z.array(z.string()).default(['http://localhost:3000']),
  }),

  // Rate limiting
  rateLimiting: z.object({
    windowMs: z.number().default(900000), // 15 minutes
    maxRequests: z.number().default(100),
  }),

  // Email
  email: z.object({
    provider: z.enum(['sendgrid', 'ses', 'smtp']),
    apiKey: z.string().optional(),
    from: z.string().email(),
  }),

  // File storage
  storage: z.object({
    provider: z.enum(['s3', 'supabase', 'local']),
    bucket: z.string(),
    region: z.string().optional(),
  }),
});

const config = configSchema.parse({
  nodeEnv: process.env.NODE_ENV,
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    url: process.env.DATABASE_URL,
    poolSize: parseInt(process.env.DB_POOL_SIZE || '20', 10),
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },

  cors: {
    origins: process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000'],
  },

  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'sendgrid',
    apiKey: process.env.EMAIL_API_KEY,
    from: process.env.EMAIL_FROM || 'noreply@realestate.com',
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'supabase',
    bucket: process.env.STORAGE_BUCKET || 'properties',
    region: process.env.STORAGE_REGION,
  },
});

export default config;
```

---

## Monitoring and Performance

### 1. Metrics Collection

```typescript
// src/monitoring/metrics.ts
import { Request, Response, NextFunction } from 'express';

interface ApiMetric {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  tenantId?: string;
  userAgent?: string;
  timestamp: string;
}

class MetricsCollector {
  private metrics: ApiMetric[] = [];
  private readonly maxMetrics = 10000;

  collect(req: Request, res: Response, duration: number) {
    const metric: ApiMetric = {
      method: req.method,
      path: req.route?.path || req.path,
      statusCode: res.statusCode,
      duration,
      tenantId: (req as any).tenantId,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Send to external monitoring system
    this.sendToMonitoringSystem(metric);
  }

  getMetrics(timeRange?: { from: string; to: string }): ApiMetric[] {
    if (!timeRange) {
      return this.metrics;
    }

    const from = new Date(timeRange.from);
    const to = new Date(timeRange.to);

    return this.metrics.filter(m => {
      const timestamp = new Date(m.timestamp);
      return timestamp >= from && timestamp <= to;
    });
  }

  getAggregatedMetrics() {
    const total = this.metrics.length;
    const errorCount = this.metrics.filter(m => m.statusCode >= 400).length;
    const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / total;

    // Group by status code
    const statusCodes = this.metrics.reduce((acc, m) => {
      acc[m.statusCode] = (acc[m.statusCode] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Group by tenant
    const tenantMetrics = this.metrics.reduce((acc, m) => {
      const tenant = m.tenantId || 'unknown';
      if (!acc[tenant]) {
        acc[tenant] = { count: 0, errors: 0, avgDuration: 0 };
      }
      acc[tenant].count++;
      if (m.statusCode >= 400) acc[tenant].errors++;
      return acc;
    }, {} as Record<string, any>);

    return {
      total,
      errorCount,
      errorRate: (errorCount / total) * 100,
      avgDuration,
      statusCodes,
      tenantMetrics,
    };
  }

  private async sendToMonitoringSystem(metric: ApiMetric) {
    // Implement integration with monitoring system
    // Examples: Prometheus, DataDog, New Relic, CloudWatch
  }
}

export const metricsCollector = new MetricsCollector();
```

### 2. Health Check Endpoint

```typescript
// src/routes/health.ts
import { Router } from 'express';
import { checkDatabaseHealth } from '../config/database';
import SupabaseManager from '../config/supabase';
import { metricsCollector } from '../monitoring/metrics';

const router = Router();

router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    checks: {} as Record<string, any>,
  };

  try {
    // Database health
    const dbHealth = await checkDatabaseHealth();
    health.checks.database = {
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      details: dbHealth.details,
    };

    // Supabase health
    const supabaseHealth = await SupabaseManager.getInstance().healthCheck();
    health.checks.supabase = {
      status: supabaseHealth ? 'healthy' : 'unhealthy',
    };

    // Memory usage
    health.checks.memory = {
      status: 'healthy',
      usage: process.memoryUsage(),
    };

    // Metrics summary
    health.checks.metrics = metricsCollector.getAggregatedMetrics();

    // Determine overall status
    const allHealthy = Object.values(health.checks)
      .every(check => check.status === 'healthy');

    if (!allHealthy) {
      health.status = 'degraded';
      res.status(503);
    }

  } catch (error) {
    health.status = 'unhealthy';
    health.checks.error = (error as Error).message;
    res.status(503);
  }

  res.json(health);
});

// Detailed health with metrics
router.get('/detailed', async (req, res) => {
  const timeRange = {
    from: req.query.from as string || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    to: req.query.to as string || new Date().toISOString(),
  };

  const metrics = metricsCollector.getMetrics(timeRange);

  res.json({
    summary: metricsCollector.getAggregatedMetrics(),
    metrics,
    timeRange,
  });
});

export default router;
```

---

## Security Checklist

### 1. Authentication & Authorization
- [ ] Implement JWT with refresh tokens
- [ ] Use Supabase Auth for authentication
- [ ] Implement role-based access control (RBAC)
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Validate JWT tokens on every request
- [ ] Implement proper logout and token revocation

### 2. Input Validation & Sanitization
- [ ] Validate all incoming data with express-validator
- [ ] Sanitize inputs to prevent XSS
- [ ] Implement rate limiting on all endpoints
- [ ] Use parameterized queries (Supabase handles this)
- [ ] Validate file uploads (type, size, content)
- [ ] Implement CSRF protection

### 3. API Security
- [ ] Use HTTPS/TLS for all communications
- [ ] Implement API versioning
- [ ] Set security headers with Helmet
- [ ] Configure CORS properly
- [ ] Implement request size limits
- [ ] Add API key authentication for external access

### 4. Data Protection
- [ ] Encrypt sensitive data at rest
- [ ] Mask sensitive data in logs
- [ ] Implement data retention policies
- [ ] Use environment variables for secrets
- [ ] Implement audit logging
- [ ] Regular security audits and penetration testing

### 5. Infrastructure Security
- [ ] Use managed database services (Supabase)
- [ ] Implement VPC/network isolation
- [ ] Regular backup and disaster recovery testing
- [ ] Monitor for unusual activity
- [ ] Implement automated security updates
- [ ] Use WAF (Web Application Firewall)

### 6. Compliance
- [ ] GDPR compliance for EU users
- [ ] CCPA compliance for California users
- [ ] SOC 2 compliance preparation
- [ ] Data privacy policy implementation
- [ ] Regular compliance audits

---

## Sources

1. **API Middleware Patterns**:
   - [Best practices when implementing Middleware](https://medium.com/@preeteeg/best-practices-when-implementing-middleware-162f0b12b2f6)
   - [Error Handling and Logging Best Practices for Production](https://akkaya.dev/blog/error-handling-logging-best-practices)
   - [How to Handle and Return Errors in a REST API](https://treblle.com/blog/rest-api-error-handling)

2. **API Versioning Strategies**:
   - [API Versioning Strategies: Best Practices Guide](https://daily.dev/blog/api-versioning-strategies-best-practices-guide)
   - [API Versioning Strategies - URL, Header, or Content Negotiation](https://www.usefulfunctions.co.uk/2025/11/06/api-versioning-url-header-or-negotiation/)
   - [Top 5 API Versioning Strategies (2025)](https://blog.dreamfactory.com/top-5-api-versioning-strategies-2025-dreamfactory)

3. **Supabase Integration**:
   - [Production Checklist | Supabase Docs](https://supabase.com/docs/guides/deployment/going-into-prod)
   - [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
   - [Best Practices for Supabase | Security, Scaling & Maintainability](https://www.leanware.co/insights/supabase-best-practices)

4. **Node.js/Express Implementation**:
   - [Implementing Rate Limiting in an Express + TypeScript Server](https://medium.com/@codebyaadi/implementing-rate-limiting-in-an-express-typescript-server-990a306132e5)
   - [Building a Robust Express API with TypeScript and express-validator](https://dev.to/justwonder/building-a-robust-express-api-with-typescript-and-express-validator-3i75)
   - [Security Best Practices for Express in Production](https://expressjs.com/en/advanced/best-practice-security.html)

5. **Security & Performance**:
   - [Using Helmet in Node.js to secure your application](https://blog.logrocket.com/using-helmet-node-js-secure-application/)
   - [API Security: Best Practices to Protect Your APIs in 2025](https://habtesoft.medium.com/api-security-best-practices-to-protect-your-apis-in-2025-77acf84dc1fb)
   - [Node.js and Express Tutorial: Building and Securing RESTful APIs](https://auth0.com/blog/node-js-and-express-tutorial-building-and-securing-restful-apis/)