export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          activity_type: string | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          activity_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_project_assignments: {
        Row: {
          admin_user_id: string
          assigned_at: string
          assigned_by: string | null
          id: string
          notes: string | null
          project_id: string
          revoked_at: string | null
          tenant_id: string
        }
        Insert: {
          admin_user_id: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          notes?: string | null
          project_id: string
          revoked_at?: string | null
          tenant_id: string
        }
        Update: {
          admin_user_id?: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          revoked_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_project_assignments_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_project_assignments_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_project_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_project_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_project_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_project_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      agent_unit_assignments: {
        Row: {
          agent_user_id: string
          assigned_at: string
          assigned_by: string | null
          id: string
          revoked_at: string | null
          tenant_id: string
          unit_id: string
        }
        Insert: {
          agent_user_id: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          revoked_at?: string | null
          tenant_id: string
          unit_id: string
        }
        Update: {
          agent_user_id?: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          revoked_at?: string | null
          tenant_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_unit_assignments_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_unit_assignments_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_unit_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_unit_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_unit_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_unit_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "agent_unit_assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          check_in_date: string
          check_out_date: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string
          guests: number | null
          id: string
          notes: Json | null
          property_id: string
          special_requests: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          tenant_id: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          check_in_date: string
          check_out_date: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id: string
          guests?: number | null
          id?: string
          notes?: Json | null
          property_id: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          tenant_id: string
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          check_in_date?: string
          check_out_date?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string
          guests?: number | null
          id?: string
          notes?: Json | null
          property_id?: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          tenant_id?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      campaigns: {
        Row: {
          activities: string[] | null
          approval_status: string | null
          approved_at: string | null
          approver_id: string | null
          attachment_urls: Json | null
          campaign_code: string
          campaign_name: string
          campaign_type: string | null
          campaign_url: string | null
          clicks_count: number | null
          created_at: string | null
          created_by: string | null
          cta_text: string | null
          cta_url: string | null
          ctr: number | null
          detail: string | null
          end_date: string
          frequency: string | null
          headline: string | null
          id: string
          image_url: string | null
          impressions_count: number | null
          message_body: string | null
          property_id: string | null
          recipients_count: number | null
          schedule_type: string | null
          scheduled_at: string | null
          segments: string[] | null
          start_date: string
          status: string | null
          template: string | null
          tenant_id: string
          updated_at: string | null
          utm_params: Json | null
        }
        Insert: {
          activities?: string[] | null
          approval_status?: string | null
          approved_at?: string | null
          approver_id?: string | null
          attachment_urls?: Json | null
          campaign_code: string
          campaign_name: string
          campaign_type?: string | null
          campaign_url?: string | null
          clicks_count?: number | null
          created_at?: string | null
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          ctr?: number | null
          detail?: string | null
          end_date: string
          frequency?: string | null
          headline?: string | null
          id?: string
          image_url?: string | null
          impressions_count?: number | null
          message_body?: string | null
          property_id?: string | null
          recipients_count?: number | null
          schedule_type?: string | null
          scheduled_at?: string | null
          segments?: string[] | null
          start_date: string
          status?: string | null
          template?: string | null
          tenant_id: string
          updated_at?: string | null
          utm_params?: Json | null
        }
        Update: {
          activities?: string[] | null
          approval_status?: string | null
          approved_at?: string | null
          approver_id?: string | null
          attachment_urls?: Json | null
          campaign_code?: string
          campaign_name?: string
          campaign_type?: string | null
          campaign_url?: string | null
          clicks_count?: number | null
          created_at?: string | null
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          ctr?: number | null
          detail?: string | null
          end_date?: string
          frequency?: string | null
          headline?: string | null
          id?: string
          image_url?: string | null
          impressions_count?: number | null
          message_body?: string | null
          property_id?: string | null
          recipients_count?: number | null
          schedule_type?: string | null
          scheduled_at?: string | null
          segments?: string[] | null
          start_date?: string
          status?: string | null
          template?: string | null
          tenant_id?: string
          updated_at?: string | null
          utm_params?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      company_settings: {
        Row: {
          billing_automation: Json | null
          company_name: string | null
          created_at: string | null
          id: string
          logo_storage_path: string | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          billing_automation?: Json | null
          company_name?: string | null
          created_at?: string | null
          id?: string
          logo_storage_path?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          billing_automation?: Json | null
          company_name?: string | null
          created_at?: string | null
          id?: string
          logo_storage_path?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      customer_interactions: {
        Row: {
          attachments: Json | null
          content: string | null
          created_at: string | null
          customer_id: string
          direction: string | null
          duration_minutes: number | null
          id: string
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          staff_id: string
          status: string | null
          subject: string | null
          tenant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          content?: string | null
          created_at?: string | null
          customer_id: string
          direction?: string | null
          duration_minutes?: number | null
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          staff_id: string
          status?: string | null
          subject?: string | null
          tenant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          content?: string | null
          created_at?: string | null
          customer_id?: string
          direction?: string | null
          duration_minutes?: number | null
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          staff_id?: string
          status?: string | null
          subject?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          acquisition_source: string | null
          auth_user_id: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          id_document: Json | null
          is_active: boolean | null
          line_user_id: string | null
          nationality: string | null
          phone: string | null
          preferences: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          acquisition_source?: string | null
          auth_user_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_document?: Json | null
          is_active?: boolean | null
          line_user_id?: string | null
          nationality?: string | null
          phone?: string | null
          preferences?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          acquisition_source?: string | null
          auth_user_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_document?: Json | null
          is_active?: boolean | null
          line_user_id?: string | null
          nationality?: string | null
          phone?: string | null
          preferences?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      error_logs: {
        Row: {
          component_name: string | null
          created_at: string | null
          error_level: string
          error_message: string
          error_stack: string | null
          id: string
          metadata: Json | null
          page_url: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component_name?: string | null
          created_at?: string | null
          error_level: string
          error_message: string
          error_stack?: string | null
          id?: string
          metadata?: Json | null
          page_url?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component_name?: string | null
          created_at?: string | null
          error_level?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          metadata?: Json | null
          page_url?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_status_logs: {
        Row: {
          change_type: string
          changed_by: string
          created_at: string | null
          id: string
          invoice_id: string
          metadata: Json | null
          new_status: string
          notes: string | null
          old_status: string
          payment_info: Json | null
          reason: string | null
          tenant_id: string
        }
        Insert: {
          change_type?: string
          changed_by: string
          created_at?: string | null
          id?: string
          invoice_id: string
          metadata?: Json | null
          new_status: string
          notes?: string | null
          old_status: string
          payment_info?: Json | null
          reason?: string | null
          tenant_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string
          created_at?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json | null
          new_status?: string
          notes?: string | null
          old_status?: string
          payment_info?: Json | null
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_status_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_status_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_status_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          due_date: string
          id: string
          invoice_number: string
          paid_at: string | null
          status: string
          subscription_plan: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          due_date: string
          id?: string
          invoice_number: string
          paid_at?: string | null
          status?: string
          subscription_plan?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          paid_at?: string | null
          status?: string
          subscription_plan?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      lead_interests: {
        Row: {
          created_at: string | null
          id: string
          interest_level: string | null
          lead_id: string
          notes: string | null
          property_id: string
          status: string | null
          tenant_id: string
          unit_id: string
          updated_at: string | null
          viewing_date: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interest_level?: string | null
          lead_id: string
          notes?: string | null
          property_id: string
          status?: string | null
          tenant_id: string
          unit_id: string
          updated_at?: string | null
          viewing_date?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interest_level?: string | null
          lead_id?: string
          notes?: string | null
          property_id?: string
          status?: string | null
          tenant_id?: string
          unit_id?: string
          updated_at?: string | null
          viewing_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_interests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "lead_interests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          age: number | null
          assigned_to: string | null
          brochure_downloads: number | null
          company_name: string | null
          conversion_probability: number | null
          created_at: string | null
          credit_score: number | null
          customer_id: string | null
          decision_maker: boolean | null
          down_payment_ready: number | null
          dti_ratio: number | null
          education: string | null
          employment_type: string | null
          engagement_score: number | null
          estimated_interest_rate: number | null
          estimated_monthly_payment: number | null
          estimated_value: number | null
          existing_properties: number | null
          expected_close_date: string | null
          financial_score: number | null
          financing_approved: boolean | null
          fit_score: number | null
          gender: string | null
          has_co_borrower: boolean | null
          household_size: number | null
          id: string
          is_first_time_buyer: boolean | null
          last_contact_date: string | null
          loan_approval_probability: number | null
          loan_last_updated: string | null
          loan_term_years: number | null
          ltv_ratio: number | null
          marital_status: string | null
          max_loan_amount: number | null
          metadata: Json | null
          monthly_debt: number | null
          monthly_income: number | null
          next_follow_up: string | null
          notes: string | null
          number_of_dependents: number | null
          pages_viewed: number | null
          potential_score: number | null
          priority: string | null
          property_id: string | null
          savings: number | null
          score_last_updated: string | null
          site_visit_attended: boolean | null
          sold_property_recently: boolean | null
          source: string | null
          status: string | null
          tenant_id: string
          time_on_site: number | null
          unit_id: string | null
          updated_at: string | null
          urgency_level: string | null
          urgency_score: number | null
          website_visits: number | null
          workplace: string | null
          years_employed: number | null
        }
        Insert: {
          age?: number | null
          assigned_to?: string | null
          brochure_downloads?: number | null
          company_name?: string | null
          conversion_probability?: number | null
          created_at?: string | null
          credit_score?: number | null
          customer_id?: string | null
          decision_maker?: boolean | null
          down_payment_ready?: number | null
          dti_ratio?: number | null
          education?: string | null
          employment_type?: string | null
          engagement_score?: number | null
          estimated_interest_rate?: number | null
          estimated_monthly_payment?: number | null
          estimated_value?: number | null
          existing_properties?: number | null
          expected_close_date?: string | null
          financial_score?: number | null
          financing_approved?: boolean | null
          fit_score?: number | null
          gender?: string | null
          has_co_borrower?: boolean | null
          household_size?: number | null
          id?: string
          is_first_time_buyer?: boolean | null
          last_contact_date?: string | null
          loan_approval_probability?: number | null
          loan_last_updated?: string | null
          loan_term_years?: number | null
          ltv_ratio?: number | null
          marital_status?: string | null
          max_loan_amount?: number | null
          metadata?: Json | null
          monthly_debt?: number | null
          monthly_income?: number | null
          next_follow_up?: string | null
          notes?: string | null
          number_of_dependents?: number | null
          pages_viewed?: number | null
          potential_score?: number | null
          priority?: string | null
          property_id?: string | null
          savings?: number | null
          score_last_updated?: string | null
          site_visit_attended?: boolean | null
          sold_property_recently?: boolean | null
          source?: string | null
          status?: string | null
          tenant_id: string
          time_on_site?: number | null
          unit_id?: string | null
          updated_at?: string | null
          urgency_level?: string | null
          urgency_score?: number | null
          website_visits?: number | null
          workplace?: string | null
          years_employed?: number | null
        }
        Update: {
          age?: number | null
          assigned_to?: string | null
          brochure_downloads?: number | null
          company_name?: string | null
          conversion_probability?: number | null
          created_at?: string | null
          credit_score?: number | null
          customer_id?: string | null
          decision_maker?: boolean | null
          down_payment_ready?: number | null
          dti_ratio?: number | null
          education?: string | null
          employment_type?: string | null
          engagement_score?: number | null
          estimated_interest_rate?: number | null
          estimated_monthly_payment?: number | null
          estimated_value?: number | null
          existing_properties?: number | null
          expected_close_date?: string | null
          financial_score?: number | null
          financing_approved?: boolean | null
          fit_score?: number | null
          gender?: string | null
          has_co_borrower?: boolean | null
          household_size?: number | null
          id?: string
          is_first_time_buyer?: boolean | null
          last_contact_date?: string | null
          loan_approval_probability?: number | null
          loan_last_updated?: string | null
          loan_term_years?: number | null
          ltv_ratio?: number | null
          marital_status?: string | null
          max_loan_amount?: number | null
          metadata?: Json | null
          monthly_debt?: number | null
          monthly_income?: number | null
          next_follow_up?: string | null
          notes?: string | null
          number_of_dependents?: number | null
          pages_viewed?: number | null
          potential_score?: number | null
          priority?: string | null
          property_id?: string | null
          savings?: number | null
          score_last_updated?: string | null
          site_visit_attended?: boolean | null
          sold_property_recently?: boolean | null
          source?: string | null
          status?: string | null
          tenant_id?: string
          time_on_site?: number | null
          unit_id?: string | null
          updated_at?: string | null
          urgency_level?: string | null
          urgency_score?: number | null
          website_visits?: number | null
          workplace?: string | null
          years_employed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "leads_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_text: string | null
          action_url: string | null
          channels: Json | null
          created_at: string | null
          customer_id: string | null
          data: Json | null
          expires_at: string | null
          id: string
          is_read: boolean | null
          is_sent: boolean | null
          message: string
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          sent_at: string | null
          tenant_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string | null
        }
        Insert: {
          action_text?: string | null
          action_url?: string | null
          channels?: Json | null
          created_at?: string | null
          customer_id?: string | null
          data?: Json | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          is_sent?: boolean | null
          message: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_at?: string | null
          tenant_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Update: {
          action_text?: string | null
          action_url?: string | null
          channels?: Json | null
          created_at?: string | null
          customer_id?: string | null
          data?: Json | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          is_sent?: boolean | null
          message?: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_at?: string | null
          tenant_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          notes: string | null
          payment_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          payment_date: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          payment_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_id: string | null
          invoice_number: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string
          payment_status: string
          tenant_id: string
          transaction_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          tenant_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          tenant_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          billing_settings: Json | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          last_login: string | null
          last_name: string | null
          phone: string | null
          role: string
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          billing_settings?: Json | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          last_name?: string | null
          phone?: string | null
          role?: string
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          billing_settings?: Json | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          last_name?: string | null
          phone?: string | null
          role?: string
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      projects: {
        Row: {
          address: Json
          amenities: Json | null
          building_count: number | null
          code: string | null
          completion_date: string | null
          created_at: string | null
          description: string | null
          developer: string | null
          facilities: Json | null
          favorite_count: number | null
          floor_plans: Json | null
          google_maps_url: string | null
          id: string
          images: Json | null
          inquiry_count: number | null
          is_active: boolean | null
          is_featured: boolean | null
          latitude: number | null
          launch_date: string | null
          longitude: number | null
          meta_description: string | null
          meta_title: string | null
          name: string
          nearby_places: Json | null
          price_avg_per_sqm: number | null
          price_max: number | null
          price_min: number | null
          slug: string | null
          tenant_id: string
          total_area_sqm: number | null
          total_units: number | null
          transport: Json | null
          updated_at: string | null
          videos: Json | null
          view_count: number | null
          virtual_tour_url: string | null
        }
        Insert: {
          address: Json
          amenities?: Json | null
          building_count?: number | null
          code?: string | null
          completion_date?: string | null
          created_at?: string | null
          description?: string | null
          developer?: string | null
          facilities?: Json | null
          favorite_count?: number | null
          floor_plans?: Json | null
          google_maps_url?: string | null
          id?: string
          images?: Json | null
          inquiry_count?: number | null
          is_active?: boolean | null
          is_featured?: boolean | null
          latitude?: number | null
          launch_date?: string | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          nearby_places?: Json | null
          price_avg_per_sqm?: number | null
          price_max?: number | null
          price_min?: number | null
          slug?: string | null
          tenant_id: string
          total_area_sqm?: number | null
          total_units?: number | null
          transport?: Json | null
          updated_at?: string | null
          videos?: Json | null
          view_count?: number | null
          virtual_tour_url?: string | null
        }
        Update: {
          address?: Json
          amenities?: Json | null
          building_count?: number | null
          code?: string | null
          completion_date?: string | null
          created_at?: string | null
          description?: string | null
          developer?: string | null
          facilities?: Json | null
          favorite_count?: number | null
          floor_plans?: Json | null
          google_maps_url?: string | null
          id?: string
          images?: Json | null
          inquiry_count?: number | null
          is_active?: boolean | null
          is_featured?: boolean | null
          latitude?: number | null
          launch_date?: string | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          nearby_places?: Json | null
          price_avg_per_sqm?: number | null
          price_max?: number | null
          price_min?: number | null
          slug?: string | null
          tenant_id?: string
          total_area_sqm?: number | null
          total_units?: number | null
          transport?: Json | null
          updated_at?: string | null
          videos?: Json | null
          view_count?: number | null
          virtual_tour_url?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: Json
          amenities: Json | null
          attachments: Json | null
          base_price: number
          bathrooms: number | null
          bedrooms: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          developer: string | null
          district_id: number | null
          floor_count: number | null
          has_facilities: boolean | null
          id: string
          images: Json | null
          information_links: Json | null
          is_active: boolean | null
          is_featured: boolean | null
          location_lat: number | null
          location_lng: number | null
          master_plan_url: string | null
          max_guests: number | null
          name: string
          nearby: Json | null
          province_id: number | null
          size_sqft: number | null
          sub_district_id: number | null
          tenant_id: string
          thumbnail_url: string | null
          total_units: number | null
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string | null
        }
        Insert: {
          address: Json
          amenities?: Json | null
          attachments?: Json | null
          base_price: number
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          developer?: string | null
          district_id?: number | null
          floor_count?: number | null
          has_facilities?: boolean | null
          id?: string
          images?: Json | null
          information_links?: Json | null
          is_active?: boolean | null
          is_featured?: boolean | null
          location_lat?: number | null
          location_lng?: number | null
          master_plan_url?: string | null
          max_guests?: number | null
          name: string
          nearby?: Json | null
          province_id?: number | null
          size_sqft?: number | null
          sub_district_id?: number | null
          tenant_id: string
          thumbnail_url?: string | null
          total_units?: number | null
          type: Database["public"]["Enums"]["property_type"]
          updated_at?: string | null
        }
        Update: {
          address?: Json
          amenities?: Json | null
          attachments?: Json | null
          base_price?: number
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          developer?: string | null
          district_id?: number | null
          floor_count?: number | null
          has_facilities?: boolean | null
          id?: string
          images?: Json | null
          information_links?: Json | null
          is_active?: boolean | null
          is_featured?: boolean | null
          location_lat?: number | null
          location_lng?: number | null
          master_plan_url?: string | null
          max_guests?: number | null
          name?: string
          nearby?: Json | null
          province_id?: number | null
          size_sqft?: number | null
          sub_district_id?: number | null
          tenant_id?: string
          thumbnail_url?: string | null
          total_units?: number | null
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      sales_project_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          project_id: string
          revoked_at: string | null
          sales_user_id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          project_id: string
          revoked_at?: string | null
          sales_user_id: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          project_id?: string
          revoked_at?: string | null
          sales_user_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_project_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_project_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_project_assignments_sales_user_id_fkey"
            columns: ["sales_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_project_assignments_sales_user_id_fkey"
            columns: ["sales_user_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_project_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_project_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      sales_unit_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          revoked_at: string | null
          sales_user_id: string
          tenant_id: string
          unit_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          revoked_at?: string | null
          sales_user_id: string
          tenant_id: string
          unit_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          revoked_at?: string | null
          sales_user_id?: string
          tenant_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_unit_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_unit_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_unit_assignments_sales_user_id_fkey"
            columns: ["sales_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_unit_assignments_sales_user_id_fkey"
            columns: ["sales_user_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_unit_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_unit_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "sales_unit_assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_members: {
        Row: {
          added_at: string | null
          member_id: string
          member_type: string
          segment_id: string
          tenant_id: string
        }
        Insert: {
          added_at?: string | null
          member_id: string
          member_type: string
          segment_id: string
          tenant_id: string
        }
        Update: {
          added_at?: string | null
          member_id?: string
          member_type?: string
          segment_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_members_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      segments: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          filter_rules: Json | null
          id: string
          is_active: boolean | null
          member_count: number | null
          name: string
          target_type: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filter_rules?: Json | null
          id?: string
          is_active?: boolean | null
          member_count?: number | null
          name: string
          target_type?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filter_rules?: Json | null
          id?: string
          is_active?: boolean | null
          member_count?: number | null
          name?: string
          target_type?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "segments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      system_settings: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          key: string
          tenant_id: string | null
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          key: string
          tenant_id?: string | null
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          key?: string
          tenant_id?: string | null
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      tenants: {
        Row: {
          billing_address: string | null
          billing_email: string | null
          billing_phone: string | null
          created_at: string | null
          domain: string | null
          email: string | null
          id: string
          max_properties: number | null
          name: string
          settings: Json | null
          slug: string
          status: Database["public"]["Enums"]["tenant_status"] | null
          subscription_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          suspended_at: string | null
          suspension_reason: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          billing_address?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          created_at?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          max_properties?: number | null
          name: string
          settings?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"] | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          suspended_at?: string | null
          suspension_reason?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_address?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          created_at?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          max_properties?: number | null
          name?: string
          settings?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"] | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          suspended_at?: string | null
          suspension_reason?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      th_districts: {
        Row: {
          code: string
          id: number
          name_en: string
          name_th: string
          province_id: number | null
        }
        Insert: {
          code: string
          id?: number
          name_en: string
          name_th: string
          province_id?: number | null
        }
        Update: {
          code?: string
          id?: number
          name_en?: string
          name_th?: string
          province_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "th_districts_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "th_provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      th_geographies: {
        Row: {
          id: number
          name_en: string | null
          name_th: string
        }
        Insert: {
          id?: number
          name_en?: string | null
          name_th: string
        }
        Update: {
          id?: number
          name_en?: string | null
          name_th?: string
        }
        Relationships: []
      }
      th_provinces: {
        Row: {
          code: string
          geography_id: number | null
          id: number
          name_en: string
          name_th: string
        }
        Insert: {
          code: string
          geography_id?: number | null
          id?: number
          name_en: string
          name_th: string
        }
        Update: {
          code?: string
          geography_id?: number | null
          id?: number
          name_en?: string
          name_th?: string
        }
        Relationships: [
          {
            foreignKeyName: "th_provinces_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "th_geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      th_sub_districts: {
        Row: {
          code: string
          district_id: number | null
          id: number
          name_en: string
          name_th: string
          province_id: number | null
        }
        Insert: {
          code: string
          district_id?: number | null
          id?: number
          name_en: string
          name_th: string
          province_id?: number | null
        }
        Update: {
          code?: string
          district_id?: number | null
          id?: number
          name_en?: string
          name_th?: string
          province_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "th_sub_districts_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "th_districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "th_sub_districts_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "th_provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      th_zipcodes: {
        Row: {
          id: number
          sub_district_code: string
          zipcode: string
        }
        Insert: {
          id?: number
          sub_district_code: string
          zipcode: string
        }
        Update: {
          id?: number
          sub_district_code?: string
          zipcode?: string
        }
        Relationships: []
      }
      triggers: {
        Row: {
          action_config: Json | null
          action_type: string
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          event_type: string
          fired_count: number | null
          id: string
          is_active: boolean | null
          last_fired_at: string | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_type: string
          fired_count?: number | null
          id?: string
          is_active?: boolean | null
          last_fired_at?: string | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_type?: string
          fired_count?: number | null
          id?: string
          is_active?: boolean | null
          last_fired_at?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "triggers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "triggers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "triggers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "triggers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      units: {
        Row: {
          area_sqm: number
          availability_date: string | null
          balcony: boolean | null
          bathrooms: number | null
          bedrooms: number | null
          building: string | null
          created_at: string | null
          deposit_amount: number | null
          discount_amount: number | null
          facing_direction: string | null
          floor_count: number | null
          floor_number: number | null
          floor_plan: Json | null
          floor_plan_url: string | null
          furnishing: string | null
          garden: boolean | null
          id: string
          images: Json | null
          land_area_sqw: number | null
          layout_description: string | null
          locked_by: string | null
          locked_until: string | null
          notes: string | null
          parking_spaces: number | null
          plot_number: string | null
          pool: boolean | null
          price: number
          price_per_sqm: number | null
          project_id: string
          promo_price: number | null
          reservation_date: string | null
          reservation_notes: string | null
          reserved_at: string | null
          reserved_customer_lead_id: string | null
          reserved_customer_name: string | null
          reserved_customer_phone: string | null
          sold_at: string | null
          specifications: Json | null
          status: string | null
          tenant_id: string
          thumbnail_url: string | null
          tour_3d_url: string | null
          unit_number: string
          unit_type: string | null
          updated_at: string | null
          view: string | null
        }
        Insert: {
          area_sqm: number
          availability_date?: string | null
          balcony?: boolean | null
          bathrooms?: number | null
          bedrooms?: number | null
          building?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          discount_amount?: number | null
          facing_direction?: string | null
          floor_count?: number | null
          floor_number?: number | null
          floor_plan?: Json | null
          floor_plan_url?: string | null
          furnishing?: string | null
          garden?: boolean | null
          id?: string
          images?: Json | null
          land_area_sqw?: number | null
          layout_description?: string | null
          locked_by?: string | null
          locked_until?: string | null
          notes?: string | null
          parking_spaces?: number | null
          plot_number?: string | null
          pool?: boolean | null
          price: number
          price_per_sqm?: number | null
          project_id: string
          promo_price?: number | null
          reservation_date?: string | null
          reservation_notes?: string | null
          reserved_at?: string | null
          reserved_customer_lead_id?: string | null
          reserved_customer_name?: string | null
          reserved_customer_phone?: string | null
          sold_at?: string | null
          specifications?: Json | null
          status?: string | null
          tenant_id: string
          thumbnail_url?: string | null
          tour_3d_url?: string | null
          unit_number: string
          unit_type?: string | null
          updated_at?: string | null
          view?: string | null
        }
        Update: {
          area_sqm?: number
          availability_date?: string | null
          balcony?: boolean | null
          bathrooms?: number | null
          bedrooms?: number | null
          building?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          discount_amount?: number | null
          facing_direction?: string | null
          floor_count?: number | null
          floor_number?: number | null
          floor_plan?: Json | null
          floor_plan_url?: string | null
          furnishing?: string | null
          garden?: boolean | null
          id?: string
          images?: Json | null
          land_area_sqw?: number | null
          layout_description?: string | null
          locked_by?: string | null
          locked_until?: string | null
          notes?: string | null
          parking_spaces?: number | null
          plot_number?: string | null
          pool?: boolean | null
          price?: number
          price_per_sqm?: number | null
          project_id?: string
          promo_price?: number | null
          reservation_date?: string | null
          reservation_notes?: string | null
          reserved_at?: string | null
          reserved_customer_lead_id?: string | null
          reserved_customer_name?: string | null
          reserved_customer_phone?: string | null
          sold_at?: string | null
          specifications?: Json | null
          status?: string | null
          tenant_id?: string
          thumbnail_url?: string | null
          tour_3d_url?: string | null
          unit_number?: string
          unit_type?: string | null
          updated_at?: string | null
          view?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_reserved_lead_fkey"
            columns: ["reserved_customer_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tenants: {
        Row: {
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          joined_at: string | null
          last_login_at: string | null
          permissions: Json | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          last_login_at?: string | null
          permissions?: Json | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          last_login_at?: string | null
          permissions?: Json | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_id: string | null
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string | null
          email: string
          first_login_at: string | null
          full_name: string | null
          id: string
          invite_accepted_at: string | null
          invite_expires_at: string | null
          invite_token: string | null
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          last_sign_in_at: string | null
          old_id: string | null
          password_reset_required: boolean | null
          password_set_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          signup_expires_at: string | null
          signup_token: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          auth_id?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          first_login_at?: string | null
          full_name?: string | null
          id?: string
          invite_accepted_at?: string | null
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          last_sign_in_at?: string | null
          old_id?: string | null
          password_reset_required?: boolean | null
          password_set_at?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          signup_expires_at?: string | null
          signup_token?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          auth_id?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          first_login_at?: string | null
          full_name?: string | null
          id?: string
          invite_accepted_at?: string | null
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          last_sign_in_at?: string | null
          old_id?: string | null
          password_reset_required?: boolean | null
          password_set_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          signup_expires_at?: string | null
          signup_token?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
    }
    Views: {
      users_with_roles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          subscription_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          tenant_id: string | null
          tenant_name: string | null
          tenant_slug: string | null
          tenant_status: Database["public"]["Enums"]["tenant_status"] | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_member_segments: {
        Row: {
          member_id: string | null
          member_type: string | null
          segment_codes: string[] | null
          segment_count: number | null
          segment_names: string[] | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "segment_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "users_with_roles"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite_and_create_user: {
        Args: { p_invite_token: string; p_password: string }
        Returns: Json
      }
      check_and_fix_identity: { Args: { p_user_id: string }; Returns: Json }
      check_and_fix_password: {
        Args: { p_password: string; p_user_id: string }
        Returns: Json
      }
      complete_user_signup: {
        Args: { p_auth_user_id?: string; p_signup_token: string }
        Returns: Json
      }
      create_user_with_password: {
        Args: {
          p_email: string
          p_full_name: string
          p_is_active?: boolean
          p_password: string
          p_role: string
          p_tenant_id: string
        }
        Returns: Json
      }
      debug_auth_user: { Args: { p_email: string }; Returns: Json }
      debug_auth_users: { Args: never; Returns: Json }
      delete_auth_user_by_email: { Args: { p_email: string }; Returns: Json }
      delete_auth_user_by_id: { Args: { p_user_id: string }; Returns: Json }
      evaluate_segment_rules: {
        Args: { p_filter_rules: Json; p_tenant_id: string }
        Returns: {
          member_id: string
          member_type: string
        }[]
      }
      generate_booking_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      get_current_user_tenant_id: { Args: never; Returns: string }
      get_error_stats: {
        Args: never
        Returns: {
          error_count: number
          errors_this_week: number
          errors_today: number
          info_count: number
          total_errors: number
          unresolved_errors: number
          warning_count: number
        }[]
      }
      get_instance_info: { Args: never; Returns: Json }
      get_lead_payment_summary: {
        Args: { p_lead_id: string }
        Returns: {
          payment_count: number
          property_name: string
          total_amount: number
          total_outstanding: number
          total_paid: number
          unit_number: string
        }[]
      }
      get_or_create_company_settings: {
        Args: { p_tenant_id: string }
        Returns: {
          company_name: string
          created_at: string
          logo_storage_path: string
          logo_url: string
          primary_color: string
          secondary_color: string
          setting_id: string
          tenant_id: string
          updated_at: string
        }[]
      }
      get_recent_activities: {
        Args: { limit_count?: number }
        Returns: {
          activity_type: string
          created_at: string
          description: string
          id: string
          tenant_name: string
        }[]
      }
      get_recent_errors: {
        Args: { include_resolved?: boolean; limit_count?: number }
        Returns: {
          component_name: string
          created_at: string
          error_level: string
          error_message: string
          id: string
          page_url: string
          resolved: boolean
          tenant_id: string
          tenant_name: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_user_by_auth_id: { Args: { p_auth_id: string }; Returns: Json }
      invite_user: {
        Args: {
          p_email: string
          p_full_name: string
          p_invited_by: string
          p_role: string
          p_tenant_id: string
        }
        Returns: Json
      }
      invite_user_v2: {
        Args: {
          p_email: string
          p_full_name: string
          p_invited_by: string
          p_redirect_url?: string
          p_role: string
          p_tenant_id: string
        }
        Returns: Json
      }
      is_admin_or_above: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      log_activity: {
        Args: {
          p_activity_type: string
          p_description: string
          p_metadata?: Json
          p_tenant_id: string
          p_user_id: string
        }
        Returns: string
      }
      log_error: {
        Args: {
          p_component_name?: string
          p_error_level: string
          p_error_message: string
          p_error_stack?: string
          p_metadata?: Json
          p_page_url?: string
          p_tenant_id: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      normalize_thai_phone: { Args: { p: string }; Returns: string }
      recreate_auth_user_properly: {
        Args: { p_password: string; p_user_id: string }
        Returns: Json
      }
      refresh_all_segments: {
        Args: never
        Returns: {
          member_count: number
          segment_id: string
          segment_name: string
        }[]
      }
      refresh_segment_members: {
        Args: { p_segment_id: string }
        Returns: number
      }
      remove_auth_user_by_email: { Args: { p_email: string }; Returns: Json }
      reset_all_passwords: { Args: never; Returns: Json }
      resolve_error: {
        Args: { p_error_id: string; p_resolved_by: string }
        Returns: boolean
      }
      revert_expired_unit_reservations: { Args: never; Returns: Json }
      send_password_reset_link: { Args: { p_email: string }; Returns: Json }
      show_all_identities: { Args: never; Returns: Json }
      test_accept_invite: {
        Args: { p_invite_token: string; p_password: string }
        Returns: Json
      }
      user_has_role: { Args: { required_role: string }; Returns: boolean }
    }
    Enums: {
      booking_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "cancelled"
      campaign_type:
        | "email"
        | "social"
        | "search"
        | "display"
        | "content"
        | "event"
      customer_source:
        | "walk_in"
        | "web_form"
        | "website"
        | "referral"
        | "social_media"
        | "advertising"
        | "other"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "negotiation"
        | "converted"
        | "lost"
      notification_type: "info" | "success" | "warning" | "error"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      property_type:
        | "apartment"
        | "house"
        | "villa"
        | "condo"
        | "commercial"
        | "single_house"
        | "twin_house"
        | "townhome"
      subscription_plan: "starter" | "professional" | "enterprise" | "free"
      tenant_status: "trial" | "active" | "suspended" | "cancelled"
      unit_status: "available" | "reserved" | "sold" | "unavailable"
      user_role: "owner" | "admin" | "sales" | "agent" | "customer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_status: [
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
      ],
      campaign_type: [
        "email",
        "social",
        "search",
        "display",
        "content",
        "event",
      ],
      customer_source: [
        "walk_in",
        "web_form",
        "website",
        "referral",
        "social_media",
        "advertising",
        "other",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "negotiation",
        "converted",
        "lost",
      ],
      notification_type: ["info", "success", "warning", "error"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      property_type: [
        "apartment",
        "house",
        "villa",
        "condo",
        "commercial",
        "single_house",
        "twin_house",
        "townhome",
      ],
      subscription_plan: ["starter", "professional", "enterprise", "free"],
      tenant_status: ["trial", "active", "suspended", "cancelled"],
      unit_status: ["available", "reserved", "sold", "unavailable"],
      user_role: ["owner", "admin", "sales", "agent", "customer"],
    },
  },
} as const

