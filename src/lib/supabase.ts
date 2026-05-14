import { createClient } from '@supabase/supabase-js'

// Re-export auto-generated Database type from real DB schema
// Source of truth: src/lib/database.types.ts (generated via Supabase Management API)
export type { Database } from './database.types'
import type { Database } from './database.types'

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  )
}

// Create Supabase client.
// Note: client is cast to `any` because supabase-js v2's strict generic typing is too
// aggressive for our query patterns (joined selects, dynamic filters). The auto-generated
// Database type is still available — opt in via `import type { Database } from './database.types'`
// for places that need strict types (e.g., shared services in @chateau/shared post-split).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // Recommended for web apps
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'x-application-name': 'chateau-platform',
    },
  },
})

// Helper function to create a Supabase client for server-side operations
export const createSupabaseServerClient = (cookieStore: any) => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    ({
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    } as any)
  )
}

// Export types for convenience
export type Tenant = Database['public']['Tables']['tenants']['Row']
export type User = Database['public']['Tables']['users']['Row']
export type Property = Database['public']['Tables']['properties']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']

// Helper function to check if user has specific role
export const hasRole = (userTenants: any[], role: string): boolean => {
  return userTenants.some(ut => ut.role === role && ut.is_active)
}

// Helper function to get current tenant
export const getCurrentTenant = (userTenants: any[]): string | null => {
  // For now, return the first active tenant
  // In production, you might want to implement tenant switching
  const activeTenant = userTenants.find(ut => ut.is_active)
  return activeTenant ? activeTenant.tenant_id : null
}

// Export default client
export default supabase