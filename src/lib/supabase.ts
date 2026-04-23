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
          status: 'trial' | 'active' | 'suspended' | 'cancelled'
          subscription_plan: 'free' | 'professional' | 'enterprise'
          max_properties: number
          settings: any
          logo_url: string | null
          primary_color: string
          secondary_color: string
          custom_domain: string | null
          billing_email: string | null
          trial_ends_at: string | null
          subscription_current_period_start: string | null
          subscription_current_period_end: string | null
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
          metadata: any
          email_verified: boolean
          last_sign_in_at: string | null
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
          role: 'owner' | 'admin' | 'sales'
          is_active: boolean
          invited_by: string | null
          invited_at: string | null
          joined_at: string
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
          name: string
          type: 'apartment' | 'house' | 'villa' | 'condo' | 'commercial'
          description: string | null
          address: any
          amenities: any[]
          base_price: number
          currency: string
          max_guests: number
          bedrooms: number
          bathrooms: number
          size_sqft: number | null
          images: any[]
          is_active: boolean
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
          email: string
          full_name: string
          phone: string | null
          date_of_birth: string | null
          nationality: string | null
          id_document: any
          preferences: any
          is_active: boolean
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
          check_in_date: string
          check_out_date: string
          guests: number
          total_amount: number
          currency: string
          status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
          special_requests: string | null
          notes: any
          created_by: string | null
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