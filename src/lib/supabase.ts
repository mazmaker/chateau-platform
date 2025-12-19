import { createClient } from '@supabase/supabase-js'

// TypeScript types will be generated later with supabase gen types
export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          domain: string | null
          logo_url: string | null
          theme_config: any
          subscription_plan: 'standard' | 'premium'
          subscription_expires_at: string | null
          settings: any
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at'>>
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at'>>
      }
      user_tenants: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          role: 'owner' | 'admin' | 'sales' | 'viewer'
          permissions: any
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_tenants']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['user_tenants']['Row'], 'id' | 'created_at'>>
      }
      properties: {
        Row: {
          id: string
          tenant_id: string
          project_id: string | null
          unit_number: string
          title: string
          description: string | null
          property_type: string
          bedrooms: number | null
          bathrooms: number | null
          area_sqm: number | null
          price: number | null
          status: 'available' | 'reserved' | 'sold' | 'rented'
          images: any[]
          floor_plan: any | null
          specifications: any
          pricing_history: any[]
          lock_expires_at: string | null
          locked_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['properties']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['properties']['Row'], 'id' | 'created_at'>>
      }
      customers: {
        Row: {
          id: string
          tenant_id: string
          assigned_sales_id: string | null
          source: 'walk_in' | 'web_form' | 'line' | 'referral'
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          id_number: string | null
          address: string | null
          purpose: 'own_stay' | 'investment' | 'rental' | null
          budget_min: number | null
          budget_max: number | null
          preferred_provinces: string[] | null
          notes: string | null
          documents: any[]
          potential_score: number | null
          financial_score: number | null
          ai_analysis: any | null
          status: 'lead' | 'contacted' | 'qualified' | 'converted' | 'lost'
          last_contacted_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at'>>
      }
      bookings: {
        Row: {
          id: string
          tenant_id: string
          property_id: string
          customer_id: string
          sales_staff_id: string | null
          booking_number: string
          type: 'reservation' | 'sale' | 'rental'
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
          total_amount: number | null
          down_payment: number | null
          payment_schedule: any[]
          special_terms: string | null
          documents: any[]
          notes: string | null
          confirmed_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['bookings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['bookings']['Row'], 'id' | 'created_at'>>
      }
      // Add other tables as needed...
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  )
}

// Create Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flow: 'pkce', // Recommended for web apps
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
    {
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
    }
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