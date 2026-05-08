// ====================================================================
// COMPLETE DATABASE TYPES FOR CHATEAU PLATFORM
// ====================================================================
// This file contains TypeScript types that match the comprehensive database schema
// Use these for type-safe database operations throughout the application
// ====================================================================

export enum TenantStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled'
}

export enum SubscriptionPlan {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

export enum UserRole {
  OWNER = 'owner',       // Platform Owner - manages all tenants, billing, subscriptions
  ADMIN = 'admin',       // Tenant Admin - manages own company, properties, leads, sales+agent permissions
  SALES = 'sales',       // In-house Sales Staff - sells projects assigned to them (project-scoped)
  AGENT = 'agent',       // External Broker (นายหน้า) - sells specific units assigned to them (unit-scoped)
  CUSTOMER = 'customer'  // End-buyer - views properties + own reservations (future scope)
}

export enum PropertyType {
  APARTMENT = 'apartment',
  HOUSE = 'house',
  VILLA = 'villa',
  CONDO = 'condo',
  COMMERCIAL = 'commercial',
  TOWNHOUSE = 'townhouse'
}

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  NEGOTIATION = 'negotiation',
  CONVERTED = 'converted',
  LOST = 'lost'
}

export enum CustomerSource {
  WALK_IN = 'walk_in',
  WEB_FORM = 'web_form',
  WEBSITE = 'website',
  REFERRAL = 'referral',
  SOCIAL_MEDIA = 'social_media',
  ADVERTISING = 'advertising',
  OTHER = 'other'
}

export enum CampaignType {
  EMAIL = 'email',
  SOCIAL = 'social',
  SEARCH = 'search',
  DISPLAY = 'display',
  CONTENT = 'content',
  EVENT = 'event'
}

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error'
}

// ====================================================================
// CORE ENTITY TYPES
// ====================================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  status: TenantStatus;
  subscription_plan: SubscriptionPlan;
  max_properties: number;
  max_users: number;
  trial_ends_at?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  custom_domain?: string;
  billing_email?: string;
  tax_id?: string;
  phone?: string;
  address?: any;
  settings: Record<string, any>;
  features: Record<string, any>;
  timezone: string;
  currency: string;
  properties_count: number;
  users_count: number;
  storage_used: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  date_of_birth?: string;
  metadata: Record<string, any>;
  preferences: Record<string, any>;
  email_verified: boolean;
  phone_verified: boolean;
  last_sign_in_at?: string;
  last_activity_at?: string;
  login_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserTenant {
  id: string;
  user_id: string;
  tenant_id: string;
  role: UserRole;
  is_active: boolean;
  permissions: string[];
  invited_by?: string;
  invited_at?: string;
  joined_at: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

// ====================================================================
// PROPERTY MANAGEMENT TYPES
// ====================================================================

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  code?: string;
  description?: string;
  property_type: PropertyType;
  address: any;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  developer?: string;
  completion_date?: string;
  building_count?: number;
  total_units?: number;
  total_area_sqm?: number;
  price_min?: number;
  price_max?: number;
  price_avg_per_sqm?: number;
  amenities: any[];
  facilities: any[];
  transport: any[];
  nearby_places: any[];
  images: any[];
  videos: any[];
  floor_plans: any[];
  virtual_tour_url?: string;
  is_active: boolean;
  is_featured: boolean;
  launch_date?: string;
  slug?: string;
  meta_title?: string;
  meta_description?: string;
  view_count: number;
  favorite_count: number;
  inquiry_count: number;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  tenant_id: string;
  project_id: string;
  unit_number: string;
  unit_type?: string;
  floor_number?: number;
  building?: string;
  area_sqm: number;
  bedrooms: number;
  bathrooms: number;
  parking_spaces: number;
  layout_description?: string;
  facing_direction?: string;
  balcony: boolean;
  garden: boolean;
  pool: boolean;
  price: number;
  price_per_sqm: number;
  discount_amount: number;
  status: string;
  availability_date?: string;
  images: any[];
  floor_plan?: any;
  specifications: Record<string, any>;
  notes?: string;
  locked_by?: string;
  locked_until?: string;
  created_at: string;
  updated_at: string;
}

// ====================================================================
// CRM TYPES
// ====================================================================

export interface Customer {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  nationality?: string;
  id_document?: any;
  address?: any;
  work_address?: any;
  emergency_contact?: any;
  budget_min?: number;
  budget_max?: number;
  preferred_locations: any[];
  preferred_property_types: any[];
  minimum_bedrooms?: number;
  minimum_area_sqm?: number;
  source: CustomerSource;
  lead_status: LeadStatus;
  lead_score: number;
  assigned_sales_id?: string;
  preferred_contact_method?: string;
  communication_preferences: Record<string, any>;
  documents: any[];
  verification_status: string;
  page_views: number;
  property_inquiries: number;
  viewing_count: number;
  favorite_properties: any[];
  notes?: string;
  last_contact_date?: string;
  next_follow_up_date?: string;
  tags: any[];
  custom_fields: Record<string, any>;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerInteraction {
  id: string;
  tenant_id: string;
  customer_id: string;
  type: string;
  direction?: string;
  duration_minutes?: number;
  subject?: string;
  content?: string;
  staff_id: string;
  status?: string;
  next_action?: string;
  next_action_date?: string;
  attachments: any[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ====================================================================
// BOOKING & SALES TYPES
// ====================================================================

export interface Booking {
  id: string;
  tenant_id: string;
  booking_number: string;
  project_id: string;
  unit_id: string;
  customer_id: string;
  type: string;
  status: BookingStatus;
  total_amount: number;
  currency: string;
  down_payment_amount: number;
  down_payment_paid: number;
  booking_date: string;
  check_in_date?: string;
  check_out_date?: string;
  created_by: string;
  sales_staff_id?: string;
  special_terms?: string;
  notes: Record<string, any>;
  documents: any[];
  confirmed_at?: string;
  cancelled_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  booking_id: string;
  type: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: PaymentStatus;
  payment_method?: string;
  transaction_reference?: string;
  receipt_url?: string;
  late_fee_amount: number;
  late_fee_paid: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ====================================================================
// MARKETING TYPES
// ====================================================================

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  type: CampaignType;
  start_date: string;
  end_date: string;
  budget?: number;
  actual_cost: number;
  target_audience: Record<string, any>;
  target_properties: any[];
  content: Record<string, any>;
  assets: any[];
  channels: any[];
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  converted_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignResponse {
  id: string;
  tenant_id: string;
  campaign_id: string;
  customer_id?: string;
  response_type?: string;
  response_data: Record<string, any>;
  responded_at: string;
  created_at: string;
}

// ====================================================================
// NOTIFICATION TYPES
// ====================================================================

export interface Notification {
  id: string;
  tenant_id: string;
  user_id?: string;
  customer_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  channels: any[];
  is_read: boolean;
  is_sent: boolean;
  sent_at?: string;
  read_at?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  action_url?: string;
  action_text?: string;
  data: Record<string, any>;
  expires_at?: string;
  created_at: string;
}

// ====================================================================
// SYSTEM ADMINISTRATION TYPES
// ====================================================================

export interface SystemSetting {
  id: string;
  tenant_id?: string;
  category: string;
  key: string;
  value: any;
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id?: string;
  user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// ====================================================================
// DATABASE INTERFACE
// ====================================================================

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: Tenant;
        Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Tenant, 'id' | 'created_at'>>;
      };
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at'>>;
      };
      user_tenants: {
        Row: UserTenant;
        Insert: Omit<UserTenant, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserTenant, 'id' | 'created_at'>>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Project, 'id' | 'created_at'>>;
      };
      units: {
        Row: Unit;
        Insert: Omit<Unit, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Unit, 'id' | 'created_at'>>;
      };
      customers: {
        Row: Customer;
        Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Customer, 'id' | 'created_at'>>;
      };
      customer_interactions: {
        Row: CustomerInteraction;
        Insert: Omit<CustomerInteraction, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CustomerInteraction, 'id' | 'created_at'>>;
      };
      bookings: {
        Row: Booking;
        Insert: Omit<Booking, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Booking, 'id' | 'created_at'>>;
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Payment, 'id' | 'created_at'>>;
      };
      campaigns: {
        Row: Campaign;
        Insert: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Campaign, 'id' | 'created_at'>>;
      };
      campaign_responses: {
        Row: CampaignResponse;
        Insert: Omit<CampaignResponse, 'id' | 'created_at'>;
        Update: Partial<Omit<CampaignResponse, 'id'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at'>;
        Update: Partial<Omit<Notification, 'id' | 'created_at'>>;
      };
      system_settings: {
        Row: SystemSetting;
        Insert: Omit<SystemSetting, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SystemSetting, 'id' | 'created_at'>>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'>;
        Update: Partial<Omit<AuditLog, 'id'>>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_tenant_with_owner: {
        Args: {
          tenant_name: string;
          owner_email: string;
          owner_full_name?: string;
          subscription_plan_param?: SubscriptionPlan;
        };
        Returns: string;
      };
      generate_booking_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_user_permissions: {
        Args: {
          p_user_id: string;
          p_tenant_id: string;
        };
        Returns: string[];
      };
    };
    Enums: {
      tenant_status: TenantStatus;
      subscription_plan: SubscriptionPlan;
      user_role: UserRole;
      property_type: PropertyType;
      booking_status: BookingStatus;
      payment_status: PaymentStatus;
      lead_status: LeadStatus;
      customer_source: CustomerSource;
      campaign_type: CampaignType;
      notification_type: NotificationType;
    };
  };
}

// ====================================================================
// UTILITY TYPES
// ====================================================================

export type UserWithTenants = User & {
  user_tenants?: (UserTenant & { tenants: Tenant })[];
};

export type UserWithCurrentTenant = UserWithTenants & {
  currentTenant?: Tenant;
  userRole?: UserRole;
};

export type ProjectWithUnits = Project & {
  units?: Unit[];
};

export type CustomerWithInteractions = Customer & {
  interactions?: CustomerInteraction[];
};

export type BookingWithDetails = Booking & {
  project?: Project;
  unit?: Unit;
  customer?: Customer;
  payments?: Payment[];
};

// Permission types
export type Permission = 'read' | 'write' | 'delete' | 'manage_users' | 'manage_settings' | 'manage_billing' | 'manage_customers' | 'manage_bookings';

export type RolePermissions = {
  owner: Permission[];
  admin: Permission[];
  sales: Permission[];
  agent: Permission[];
  customer: Permission[];
};

export const ROLE_PERMISSIONS: RolePermissions = {
  owner: ['read', 'write', 'delete', 'manage_users', 'manage_settings', 'manage_billing'],
  admin: ['read', 'write', 'delete', 'manage_users'],
  sales: ['read', 'write', 'manage_customers', 'manage_bookings'],
  agent: ['read', 'manage_customers'],
  customer: ['read']
};

// ====================================================================
// HELPER FUNCTIONS
// ====================================================================

export const hasPermission = (userRole: UserRole | undefined, permission: Permission): boolean => {
  if (!userRole) return false;
  const roleKey = userRole.toLowerCase() as keyof RolePermissions;
  return ROLE_PERMISSIONS[roleKey]?.includes(permission) || false;
};

export const canRead = (userRole: UserRole | undefined): boolean => hasPermission(userRole, 'read');
export const canWrite = (userRole: UserRole | undefined): boolean => hasPermission(userRole, 'write');
export const canDelete = (userRole: UserRole | undefined): boolean => hasPermission(userRole, 'delete');
export const canManageUsers = (userRole: UserRole | undefined): boolean => hasPermission(userRole, 'manage_users');
export const canManageSettings = (userRole: UserRole | undefined): boolean => hasPermission(userRole, 'manage_settings');
export const canManageBilling = (userRole: UserRole | undefined): boolean => hasPermission(userRole, 'manage_billing');

// ====================================================================
// EXPORTS
// ====================================================================

export * from './supabase'; // Keep existing supabase exports
