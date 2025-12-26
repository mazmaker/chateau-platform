# RBAC Tests - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Update Owner Password
Open `tests/rbac/spec.ts` and update the owner password:

```typescript
const CREDENTIALS = {
  owner: {
    email: 'mazmakerv2.sup@gmail.com',
    password: 'YOUR_OWNER_PASSWORD_HERE' // ⚠️ UPDATE THIS
  },
  // ... other credentials
}
```

### 2. Ensure Dev Server is Running
```bash
npm run dev
```
Server should run on: `http://localhost:5175`

### 3. Run All RBAC Tests
```bash
npm run test:rbac
```

## 📊 Test Scripts

| Command | Description |
|---------|-------------|
| `npm run test:rbac` | Run all RBAC tests |
| `npm run test:rbac:owner` | Test Owner role only |
| `npm run test:rbac:admin` | Test Admin role only |
| `npm run test:rbac:sales` | Test Sales role only |
| `npm run test:rbac:headed` | Run with visible browser |
| `npm run test:rbac:debug` | Interactive debug mode |
| `npm run test:rbac:report` | Generate HTML report |

## 🎯 What Gets Tested

### Owner (👑) - Full Access
- ✅ Can access everything
- ✅ Owner Dashboard
- ✅ Tenant Management
- ✅ Billing Management
- ✅ Properties, Leads, Users, etc.

### Admin (🔧) - Company Level
- ✅ Properties, Leads, Customization
- ✅ Users, Projects
- ❌ Owner Dashboard (denied)
- ❌ Tenant Management (denied)
- ❌ Billing Management (denied)

### Sales (💼) - Limited Access
- ✅ Properties, Leads, Customization
- ✅ Projects
- ❌ Owner Dashboard (denied)
- ❌ Tenant Management (denied)
- ❌ Billing Management (denied)
- ❌ User Management (denied)

## 🔍 Expected Results

When tests pass, you'll see:
```
Running 45 tests using 3 workers

  ✓ [RBAC - Owner Role] should login successfully as owner
  ✓ [RBAC - Owner Role] should access owner dashboard
  ✓ [RBAC - Owner Role] should access tenant management
  ✓ [RBAC - Owner Role] should access billing management
  ... (more tests)

  45 passed (15s)
```

## 🐛 Troubleshooting

### "Login failed"
- Check credentials are correct
- Verify dev server is running
- Check database has test users

### "Page not found"
- Check BASE_URL in test file
- Verify routes in `src/App.tsx`

### "Access denied not working"
- Verify role guards in place
- Check `src/components/auth/PermissionGuard.tsx`
- Check `src/components/auth/ProtectedRouteSimple.tsx`

## 📱 Languages Supported

Tests handle both:
- 🇬🇧 English: "Access Denied", "Access Restricted"
- 🇹🇭 Thai: "ไม่มีสิทธิ์เข้าถึง", "การเข้าถึงถูกจำกัด"

## 🔐 Test Data

Ensure these users exist in your database:

| Role | Email | Password |
|------|-------|----------|
| Owner | mazmakerv2.sup@gmail.com | (set by you) |
| Admin | admin@chateau.com | Chateau@2024 |
| Sales | sales@chateau.com | Chateau@2024 |

## 📖 More Information

See `tests/rbac/README.md` for detailed documentation.

## 🎨 Features Tested

- ✅ Login/logout for all roles
- ✅ Page access control
- ✅ Navigation visibility
- ✅ Access denied messages
- ✅ Role badge display
- ✅ Permission guards
- ✅ Session management
- ✅ Cross-browser compatibility

Happy testing! 🎉
