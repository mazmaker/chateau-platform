# CHATEAU Platform RBAC Structure

## Role Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    PLATFORM OWNER (👑)                      │
│                   mazmakerv2.sup@gmail.com                  │
│                                                              │
│  • Full system access                                       │
│  • Manage all tenants                                      │
│  • Billing & subscriptions                                 │
│  • Platform-wide settings                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─────────────────────────────────┐
                            │                                 │
         ┌──────────────────▼──────────────────┐   ┌────────▼─────────┐
         │       COMPANY ADMIN (🔧)            │   │   SALES STAFF    │
         │       admin@chateau.com             │   │ sales@chateau.com│
         │                                    │   │                   │
         │  • Company-level access            │   │  • Limited access │
         │  • Manage properties & leads       │   │  • View leads     │
         │  • Manage users in company         │   │  • View customers │
         │  • Customize company theme         │   │  • Basic features │
         └────────────────────────────────────┘   └───────────────────┘
```

## Page Access Matrix

| Page | Route | Owner | Admin | Sales | Description |
|------|-------|:-----:|:-----:|:-----:|-------------|
| Dashboard | `/` | ✅ | ✅ | ✅ | Main dashboard |
| Owner Dashboard | `/owner` | ✅ | ❌ | ❌ | Platform metrics |
| Tenant Management | `/tenants` | ✅ | ❌ | ❌ | Manage companies |
| Billing Management | `/billing` | ✅ | ❌ | ❌ | Subscriptions & payments |
| Property Management | `/properties` | ✅ | ✅ | ✅ | Real estate properties |
| Lead Management | `/leads` | ✅ | ✅ | ✅ | Customer leads |
| Customization | `/customization` | ✅ | ✅ | ✅ | Theme & branding |
| User Management | `/users` | ✅ | ✅ | ❌ | Company users |
| Projects | `/projects` | ✅ | ✅ | ✅ | Project tracking |

## Permission Breakdown

### Owner Permissions
```
✅ read              - View all data
✅ write             - Create and edit
✅ delete            - Delete records
✅ manage_users      - Manage all users
✅ manage_settings   - Platform settings
✅ manage_billing    - Billing & subscriptions
✅ manage_properties - Property management
✅ manage_leads      - Lead management
✅ view_all_tenants  - See all companies
```

### Admin Permissions
```
✅ read              - View company data
✅ write             - Create and edit
✅ delete            - Delete records
✅ manage_users      - Manage company users
✅ manage_settings   - Company settings
✅ manage_properties - Property management
✅ manage_leads      - Lead management
✅ manage_customers  - Customer management

❌ manage_billing     - NO billing access
❌ view_all_tenants   - NO other companies
```

### Sales Permissions
```
✅ read               - View assigned data
✅ write              - Create and edit
✅ manage_customers   - Customer management
✅ manage_leads       - Lead management

❌ delete              - NO delete access
❌ manage_users       - NO user management
❌ manage_settings    - NO settings access
❌ manage_properties  - Limited property access
❌ manage_billing     - NO billing access
❌ view_all_tenants   - NO other companies
```

## Navigation Visibility

### Owner Navigation
```
🏠 Dashboard
👑 Owner Dashboard
🏢 Tenants
💳 Billing
🏘️ Properties
👥 Leads
🎨 Customization
👤 Users
📊 Projects
⚙️ Settings
```

### Admin Navigation
```
🏠 Dashboard
🏘️ Properties
👥 Leads
🎨 Customization
👤 Users
📊 Projects
⚙️ Settings
```

### Sales Navigation
```
🏠 Dashboard
🏘️ Properties
👥 Leads
🎨 Customization
📊 Projects
```

## Access Denied Flow

```
┌──────────────┐
│ User Request │
│  /billing    │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Check Auth State │
│ Is logged in?    │
└──────┬───────────┘
       │
       ├─ NO ──► Redirect to /auth/login
       │
       ├─ YES ─▼
       │
┌────────────────────┐
│ Check User Role    │
│ role === 'owner'?  │
└──────┬─────────────┘
       │
       ├─ NO ──► Show Access Denied
       │          "ไม่มีสิทธิ์เข้าถึง"
       │          "You need owner role"
       │
       ├─ YES ─▼
       │
┌──────────────┐
│ Grant Access │
│ Show Page    │
└──────────────┘
```

## Role Badge UI

### Owner Badge
```
┌──────────────────────┐
│ 👑 Platform Owner    │
│ เจ้าของแพลตฟอร์ม    │
└──────────────────────┘
```

### Admin Badge
```
┌──────────────────────┐
│ 🔧 Company Admin     │
│ ผู้ดูแลบริษัท        │
└──────────────────────┘
```

### Sales Badge
```
┌──────────────────────┐
│ 💼 Sales Staff       │
│ พนักงานขาย           │
└──────────────────────┘
```

## Test Scenarios

### ✅ Positive Tests (Should Succeed)
- Owner can access `/owner`
- Admin can access `/properties`
- Sales can access `/leads`
- All roles can access dashboard

### ❌ Negative Tests (Should Fail)
- Admin cannot access `/billing`
- Sales cannot access `/tenants`
- Unauthenticated cannot access protected pages
- Role downgrade prevents previous access

### 🔄 Cross-Role Tests
- Admin doesn't see owner navigation
- Sales doesn't see admin navigation
- Role isolation between tenants
- Session persistence across navigation

## Security Layers

```
┌─────────────────────────────────────────┐
│         1. Route Level Security         │
│   (ProtectedRouteSimple component)      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         2. Component Level Guards       │
│   (OwnerGuard, AdminGuard, etc.)        │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         3. Permission Checks            │
│   (usePermissions hook)                 │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         4. Database RLS Policies        │
│   (Row Level Security)                  │
└─────────────────────────────────────────┘
```

## Database Schema (Users Table)

```sql
users
├── id (UUID, PK)
├── email (text, unique)
├── full_name (text)
├── tenant_id (UUID, FK → tenants.id)
├── role (enum: owner | admin | sales)
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

## API Response Examples

### Successful Access
```json
{
  "status": "success",
  "data": { ... },
  "user": {
    "email": "admin@chateau.com",
    "role": "admin",
    "tenant": "Company ABC"
  }
}
```

### Access Denied
```json
{
  "status": "error",
  "error": "ACCESS_DENIED",
  "message": "ไม่มีสิทธิ์เข้าถึง",
  "required_role": "owner",
  "current_role": "admin"
}
```

## Testing Commands Summary

| Command | Tests Run |
|---------|-----------|
| `npm run test:rbac` | All 45 tests |
| `npm run test:rbac:owner` | Owner tests (7 tests) |
| `npm run test:rbac:admin` | Admin tests (9 tests) |
| `npm run test:rbac:sales` | Sales tests (10 tests) |
| `npm run test:rbac:headed` | Visual browser mode |
| `npm run test:rbac:debug` | Interactive debugging |

## Color Coding

- 🟢 **Green** = Full Access
- 🟡 **Yellow** = Limited Access
- 🔴 **Red** = No Access
- 🔵 **Blue** = Shared Access

## Icons Used

| Icon | Role | Description |
|------|------|-------------|
| 👑 | Owner | Crown - Royal, highest authority |
| 🔧 | Admin | Wrench - Tools, management |
| 💼 | Sales | Briefcase - Business, sales |
| 🏢 | Tenant | Building - Company |
| 💳 | Billing | Credit Card - Payments |
| 🏘️ | Properties | House - Real Estate |
| 👥 | Leads | Users - Customer leads |
| 🎨 | Customization | Palette - Theming |
| 👤 | Users | Person - User management |
| 📊 | Projects | Chart - Analytics |

## Language Support

All UI elements support:
- 🇬🇧 **English**
- 🇹🇭 **Thai**

Access denied messages detect and display both:
- "ไม่มีสิทธิ์เข้าถึง" (Thai)
- "Access Denied" (English)
