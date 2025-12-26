export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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
          subscription_plan: 'starter' | 'professional' | 'enterprise'
          max_properties: number
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          domain?: string | null
          status?: 'trial' | 'active' | 'suspended' | 'cancelled'
          subscription_plan?: 'starter' | 'professional' | 'enterprise'
          max_properties?: number
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          domain?: string | null
          status?: 'trial' | 'active' | 'suspended' | 'cancelled'
          subscription_plan?: 'starter' | 'professional' | 'enterprise'
          max_properties?: number
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tenants_domain_key'
            columns: ['domain']
            isOneToOne: true
            referencedRelation: 'tenants'
            referencedColumns: ['domain']
          },
          {
            foreignKeyName: 'tenants_slug_key'
            columns: ['slug']
            isOneToOne: true
            referencedRelation: 'tenants'
            referencedColumns: ['slug']
          }
        ]
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          tenant_id: string
          role: 'owner' | 'admin' | 'manager' | 'staff'
          is_active: boolean
          last_sign_in_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          tenant_id: string
          role?: 'owner' | 'admin' | 'manager' | 'staff'
          is_active?: boolean
          last_sign_in_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          tenant_id?: string
          role?: 'owner' | 'admin' | 'manager' | 'staff'
          is_active?: boolean
          last_sign_in_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'users_email_tenant_id_key'
            columns: ['email', 'tenant_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['email', 'tenant_id']
          },
          {
            foreignKeyName: 'users_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
        ]
      }
      properties: {
        Row: {
          id: string
          tenant_id: string
          name: string
          type: 'apartment' | 'house' | 'villa' | 'condo' | 'commercial'
          description: string | null
          address: Json
          amenities: Json
          base_price: string
          currency: string
          max_guests: number
          bedrooms: number
          bathrooms: number
          size_sqft: number | null
          images: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          type: 'apartment' | 'house' | 'villa' | 'condo' | 'commercial'
          description?: string | null
          address: Json
          amenities?: Json
          base_price: string
          currency?: string
          max_guests?: number
          bedrooms?: number
          bathrooms?: number
          size_sqft?: number | null
          images?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          type?: 'apartment' | 'house' | 'villa' | 'condo' | 'commercial'
          description?: string | null
          address?: Json
          amenities?: Json
          base_price?: string
          currency?: string
          max_guests?: number
          bedrooms?: number
          bathrooms?: number
          size_sqft?: number | null
          images?: Json
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'properties_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
        ]
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
          id_document: Json
          preferences: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          email: string
          full_name: string
          phone?: string | null
          date_of_birth?: string | null
          nationality?: string | null
          id_document?: Json
          preferences?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          email?: string
          full_name?: string
          phone?: string | null
          date_of_birth?: string | null
          nationality?: string | null
          id_document?: Json
          preferences?: Json
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customers_email_tenant_id_key'
            columns: ['email', 'tenant_id']
            isOneToOne: true
            referencedRelation: 'customers'
            referencedColumns: ['email', 'tenant_id']
          },
          {
            foreignKeyName: 'customers_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
        ]
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
          total_amount: string
          currency: string
          status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
          special_requests: string | null
          notes: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          property_id: string
          customer_id: string
          check_in_date: string
          check_out_date: string
          guests?: number
          total_amount: string
          currency?: string
          status?: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
          special_requests?: string | null
          notes?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          property_id?: string
          customer_id?: string
          check_in_date?: string
          check_out_date?: string
          guests?: number
          total_amount?: string
          currency?: string
          status?: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
          special_requests?: string | null
          notes?: Json
          created_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bookings_check_dates'
            columns: ['check_in_date', 'check_out_date']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['check_in_date', 'check_out_date']
          },
          {
            foreignKeyName: 'bookings_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_property_id_fkey'
            columns: ['property_id']
            referencedRelation: 'properties'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      tenant_status: 'trial' | 'active' | 'suspended' | 'cancelled'
      subscription_plan: 'starter' | 'professional' | 'enterprise'
      user_role: 'owner' | 'admin' | 'sales'
      booking_status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
      property_type: 'apartment' | 'house' | 'villa' | 'condo' | 'commercial'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}