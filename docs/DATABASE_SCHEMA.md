# CHATEAU Platform - Database Schema Documentation

**Version**: 1.0.0
**Last Updated**: 2025-12-24
**Database**: PostgreSQL (Supabase)
**Region**: South Asia (Mumbai)

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Table Definitions](#table-definitions)
4. [Relationships](#relationships)
5. [Enums & Types](#enums--types)
6. [Indexes](#indexes)
7. [Row Level Security (RLS)](#row-level-security-rls)
8. [Triggers & Functions](#triggers--functions)
9. [Migration History](#migration-history)

---

## Overview

CHATEAU Platform uses a **multi-tenant architecture** where all data is isolated by `tenant_id`. This allows multiple organizations to use the same database while keeping their data completely separate.

```
┌─────────────────────────────────────────────────────────────┐
│                     CHATEAU PLATFORM                         │
│                  Multi-Tenant Property System                │
│                   PostgreSQL 17 + Supabase                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Multi-Tenancy Pattern

```
┌─────────────────┐     ┌──────────────────┐
│     TENANTS     │────►│      USERS       │
│                 │     │                  │
│ • Organization  │     │ • Authentication │
│ • Settings      │     │ • Authorization  │
│ • Subscription  │     │ • Role-based     │
└─────────────────┘     └──────────────────┘
         │
         │
         ├──────────────────┬──────────────────┬──────────────┐
         ▼                  ▼                  ▼              ▼
   ┌───────────┐     ┌─────────────┐    ┌──────────┐   ┌─────────┐
   │PROPERTIES │     │  CUSTOMERS  │    │ BOOKINGS │   │  ...    │
   │           │     │             │    │          │   │         │
   │ tenant_id │     │  tenant_id  │    │tenant_id │   │tenant_id│
   └───────────┘     └─────────────┘    └──────────┘   └─────────┘
```

---

## Table Definitions

### 1. tenants

Core table for multi-tenancy. Each organization/customer is a tenant.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary Key |
| `name` | text | NO | - | Organization name |
| `slug` | citext | NO | - | URL-friendly identifier (unique) |
| `domain` | citext | YES | - | Custom domain (optional) |
| `status` | tenant_status | NO | 'trial' | trial, active, suspended, cancelled |
| `subscription_plan` | subscription_plan | NO | 'starter' | starter, professional, enterprise |
| `max_properties` | integer | NO | 10 | Property count limit |
| `settings` | jsonb | NO | '{}' | Custom configuration |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### 2. users

Platform users linked to tenants.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | auth.uid() | Matches auth.users.id |
| `email` | text | NO | - | User email (unique globally) |
| `full_name` | text | YES | - | Display name |
| `avatar_url` | text | YES | - | Profile picture URL |
| `phone` | text | YES | - | Phone number |
| `tenant_id` | uuid | NO | FK→tenants | Belongs to tenant |
| `role` | user_role | NO | 'staff' | owner, admin, manager, staff |
| `is_active` | boolean | NO | true | Account status |
| `last_sign_in_at` | timestamptz | YES | - | Last login |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Constraints:**
- UNIQUE(tenant_id, email) - Email unique per tenant

---

### 3. properties

Real estate properties managed by tenants.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary Key |
| `tenant_id` | uuid | NO | FK→tenants | Owner tenant |
| `name` | text | NO | - | Property name |
| `type` | property_type | NO | - | apartment, house, villa, etc |
| `description` | text | YES | - | Property description |
| `address` | jsonb | NO | - | Full address object |
| `amenities` | jsonb | NO | '[]' | Array of amenities |
| `base_price` | decimal(10,2) | NO | - | Price per night/base |
| `currency` | char(3) | NO | 'USD' | Currency code |
| `max_guests` | integer | NO | 2 | Maximum occupancy |
| `bedrooms` | integer | NO | 1 | Number of bedrooms |
| `bathrooms` | integer | NO | 1 | Number of bathrooms |
| `size_sqft` | integer | YES | - | Property size |
| `images` | jsonb | NO | '[]' | Array of image URLs |
| `is_active` | boolean | NO | true | Listed status |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### 4. customers

Guests/clients who make bookings.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary Key |
| `tenant_id` | uuid | NO | FK→tenants | Owner tenant |
| `email` | text | NO | - | Customer email |
| `full_name` | text | NO | - | Full name |
| `phone` | text | YES | - | Contact phone |
| `date_of_birth` | date | YES | - | Birth date |
| `nationality` | text | YES | - | Country code |
| `id_document` | jsonb | YES | - | ID document data |
| `preferences` | jsonb | NO | '{}' | Custom preferences |
| `is_active` | boolean | NO | true | Active status |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Constraints:**
- UNIQUE(tenant_id, email) - Email unique per tenant

---

### 5. bookings

Reservations for properties.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary Key |
| `tenant_id` | uuid | NO | FK→tenants | Owner tenant |
| `property_id` | uuid | NO | FK→properties | Booked property |
| `customer_id` | uuid | NO | FK→customers | Booking customer |
| `check_in_date` | date | NO | - | Check-in date |
| `check_out_date` | date | NO | - | Check-out date |
| `guests` | integer | NO | 1 | Number of guests |
| `total_amount` | decimal(10,2) | NO | - | Total price |
| `currency` | char(3) | NO | 'USD' | Currency code |
| `status` | booking_status | NO | 'pending' | pending, confirmed, etc |
| `special_requests` | text | YES | - | Customer requests |
| `notes` | jsonb | NO | '{}' | Additional notes |
| `created_by` | uuid | YES | FK→users | Creator user |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Constraints:**
- CHECK (check_out_date > check_in_date) - Valid date range

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────────┐
│     tenants     │
│  ─────────────  │
│  id: PK         │
│  name           │
│  slug (unique)  │
└────────┬────────┘
         │ 1
         │
         │ N
    ┌────┴─────┐
    │          │
    ▼          ▼
┌─────────┐ ┌──────────────┐
│ users   │ │ properties   │
│ ─────── │ │ ──────────── │
│ id: PK  │ │ id: PK       │
│ tenant  │ │ tenant FK ───┘
│ role    │ │ name
└─────────┘ │ type
           │ base_price
           └──────┬────────┘
                  │ 1
                  │
                  │ N
              ┌───┴────┐
              │        │
              ▼        ▼
        ┌─────────┐ ┌──────────┐
        │bookings │ │customers │
        │ ─────── │ │ ─────────│
        │ id: PK  │ │ id: PK   │
        │prop FK──┼─│tenant FK │
        │cust FK──┘ │email     │
        │dates     │ └──────────┘
        └─────────┘
```

### Foreign Keys

| Table | Column | References | On Delete |
|-------|--------|------------|-----------|
| users | tenant_id | tenants(id) | CASCADE |
| properties | tenant_id | tenants(id) | CASCADE |
| customers | tenant_id | tenants(id) | CASCADE |
| bookings | tenant_id | tenants(id) | CASCADE |
| bookings | property_id | properties(id) | CASCADE |
| bookings | customer_id | customers(id) | CASCADE |
| bookings | created_by | users(id) | NO ACTION |

---

## Enums & Types

### tenant_status
```sql
ENUM ('trial', 'active', 'suspended', 'cancelled')
```

### subscription_plan
```sql
ENUM ('starter', 'professional', 'enterprise')
```

### user_role
```sql
ENUM ('owner', 'admin', 'manager', 'staff')
```

### booking_status
```sql
ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')
```

### property_type
```sql
ENUM ('apartment', 'house', 'villa', 'condo', 'commercial')
```

---

## Indexes

### Performance Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| idx_users_tenant_id | users | tenant_id | Tenant queries |
| idx_users_email | users | email | Login lookup |
| idx_properties_tenant_id | properties | tenant_id | Tenant queries |
| idx_properties_is_active | properties | is_active | Filter active |
| idx_customers_tenant_id | customers | tenant_id | Tenant queries |
| idx_customers_email | customers | email | Customer lookup |
| idx_bookings_tenant_id | bookings | tenant_id | Tenant queries |
| idx_bookings_property_id | bookings | property_id | Property bookings |
| idx_bookings_customer_id | bookings | customer_id | Customer history |
| idx_bookings_status | bookings | status | Status filtering |
| idx_bookings_dates | bookings | check_in_date, check_out_date | Date range queries |

---

## Row Level Security (RLS)

All tables have RLS enabled with tenant isolation policies.

### tenants
```sql
-- Users can view their own tenant
CREATE POLICY "Users can view their own tenant"
ON tenants FOR SELECT USING (id = auth.uid());

-- Users can update their own tenant
CREATE POLICY "Users can update their own tenant"
ON tenants FOR UPDATE USING (id = auth.uid());
```

### users
```sql
-- View users in same tenant
CREATE POLICY "Users can view users in same tenant"
ON users FOR SELECT USING (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
));

-- Update own record
CREATE POLICY "Users can update users in same tenant"
ON users FOR UPDATE USING (
  tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  AND id = auth.uid()
);

-- Service role full access
CREATE POLICY "Service role can manage all users"
ON users FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
```

### properties
```sql
-- View properties in tenant
CREATE POLICY "Users can view properties in their tenant"
ON properties FOR SELECT USING (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
));

-- Create (owner/admin only)
CREATE POLICY "Admins can create properties"
ON properties FOR INSERT WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
  AND role IN ('owner', 'admin')
));

-- Update (owner/admin only)
CREATE POLICY "Admins can update properties"
ON properties FOR UPDATE USING (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
  AND role IN ('owner', 'admin')
));

-- Delete (owner only)
CREATE POLICY "Admins can delete properties"
ON properties FOR DELETE USING (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
  AND role = 'owner'
));
```

### customers
```sql
-- View customers in tenant
CREATE POLICY "Users can view customers in their tenant"
ON customers FOR SELECT USING (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
));

-- Create (any authenticated user)
CREATE POLICY "Staff can create customers"
ON customers FOR INSERT WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
));

-- Update (owner/admin only)
CREATE POLICY "Admins can update customers"
ON customers FOR UPDATE USING (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
  AND role IN ('owner', 'admin')
));

-- Delete (owner only)
CREATE POLICY "Admins can delete customers"
ON customers FOR DELETE USING (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
  AND role = 'owner'
));
```

### bookings
```sql
-- View bookings in tenant
CREATE POLICY "Users can view bookings in their tenant"
ON bookings FOR SELECT USING (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
));

-- Create (any authenticated user)
CREATE POLICY "Staff can create bookings"
ON bookings FOR INSERT WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
));

-- Update (owner/admin only)
CREATE POLICY "Admins can update bookings"
ON bookings FOR UPDATE USING (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
  AND role IN ('owner', 'admin')
));

-- Delete (owner only)
CREATE POLICY "Admins can delete bookings"
ON bookings FOR DELETE USING (tenant_id IN (
  SELECT tenant_id FROM users WHERE id = auth.uid()
  AND role = 'owner'
));
```

---

## Triggers & Functions

### Auto-update timestamp function

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';
```

Applied to: `tenants`, `users`, `properties`, `customers`, `bookings`

### New user signup handler

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        -- Assign to existing tenant or create new one
        NEW.tenant_id := (
            SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1
        );

        IF NEW.tenant_id IS NULL THEN
            INSERT INTO tenants (name, slug)
            VALUES (
                COALESCE(NEW.full_name, 'Default Organization'),
                lower(regexp_replace(
                    COALESCE(NEW.full_name, 'default-org'),
                    '[^a-zA-Z0-9]', '-', 'g'
                ))
            )
            RETURNING id INTO NEW.tenant_id;
        END IF;

        NEW.role := 'owner';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Trigger: `on_auth_user_created` on `auth.users` (AFTER INSERT)

---

## Migration History

| Version | Date | Description |
|---------|------|-------------|
| 20241219000000 | 2024-12-19 | Initial schema with multi-tenancy |
| 20250119020000 | 2025-01-19 | Optimization indexes (included in initial) |

---

## Connection Information

```
Project URL: https://pqnjvcbmnatrtvpqnrdx.supabase.co
Region: South Asia (Mumbai)
Database: PostgreSQL 17
Pooler Port: 6543
Direct: 5432
```

---

## Notes

### Scaling Considerations

1. **Partitioning**: Consider partitioning `bookings` by date when >10M records
2. **Archive**: Archive completed bookings >2 years old
3. **Monitoring**: Track query performance with `pg_stat_statements`

### Backup Strategy

- Continuous backups via Supabase
- Daily point-in-time recovery available
- Export schema before major changes

---

**Document maintained by**: Development Team
**For questions**: Contact the database administrator
