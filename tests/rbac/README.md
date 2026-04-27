# RBAC E2E Tests for CHATEAU Platform

This directory contains comprehensive End-to-End (E2E) tests for Role-Based Access Control (RBAC) in the CHATEAU Platform.

## Test Coverage

### Role-Based Access Control
Tests verify access control for **3 roles**:
- **Owner** (👑) - Platform owner with full system access
- **Admin** (🔧) - Company admin with tenant-level access
- **Sales** (💼) - Sales staff with limited access

### Test Suites

#### 1. **Owner Role Tests** (`RBAC - Owner Role`)
- ✅ Login as owner
- ✅ Access owner dashboard (`/owner`)
- ✅ Access tenant management (`/tenants`)
- ✅ Access billing management (`/billing`)
- ✅ Access property management (`/properties`)
- ✅ Access lead management (`/leads`)
- ✅ Verify role badge with crown icon

#### 2. **Admin Role Tests** (`RBAC - Admin Role`)
- ✅ Login as admin
- ❌ Access owner dashboard (should be denied)
- ❌ Access tenant management (should be denied)
- ❌ Access billing management (should be denied)
- ✅ Access property management
- ✅ Access lead management
- ✅ Access customization page
- ✅ Verify admin role badge

#### 3. **Sales Role Tests** (`RBAC - Sales Role`)
- ✅ Login as sales
- ❌ Access owner dashboard (should be denied)
- ❌ Access tenant management (should be denied)
- ❌ Access billing management (should be denied)
- ✅ Access property management
- ✅ Access lead management
- ✅ Access customization page
- ❌ Access user management (should be denied)
- ✅ Verify sales role badge

#### 4. **Cross-Role Isolation Tests**
- ✅ Owner sees all navigation items
- ✅ Admin does NOT see owner-only navigation
- ✅ Sales sees limited navigation

#### 5. **Access Denied Messages**
- ✅ Thai access denied message displays
- ✅ English access denied message displays
- ✅ Required role shown in error message

#### 6. **Session Management**
- ✅ Role maintained across navigation
- ✅ Redirect to login without authentication

#### 7. **Permission Guards**
- ✅ Owner has delete permissions
- ✅ Sales does NOT have delete permissions

#### 8. **UI Elements Visibility**
- ✅ Owner sees all dashboard stats
- ✅ Sales sees limited dashboard stats

#### 9. **Logout Tests**
- ✅ Logout prevents access to protected pages

## Page Access Matrix

| Page | Owner | Admin | Sales |
|------|-------|-------|-------|
| `/` (Dashboard) | ✅ | ✅ | ✅ |
| `/owner` | ✅ | ❌ | ❌ |
| `/tenants` | ✅ | ❌ | ❌ |
| `/billing` | ✅ | ❌ | ❌ |
| `/properties` | ✅ | ✅ | ✅ |
| `/leads` | ✅ | ✅ | ✅ |
| `/customization` | ✅ | ✅ | ✅ |
| `/users` | ✅ | ✅ | ❌ |
| `/projects` | ✅ | ✅ | ✅ |

## Test Credentials

Update the credentials in `spec.ts` before running:

```typescript
const CREDENTIALS = {
  owner: {
    email: 'mazmakerv2.sup@gmail.com',
    password: 'YOUR_OWNER_PASSWORD'
  },
  admin: {
    email: 'admin@chateau.com',
    password: 'Chateau@2024'
  },
  sales: {
    email: 'sales@chateau.com',
    password: 'Chateau@2024'
  }
};
```

## Running Tests

### Prerequisites
1. Install dependencies:
   ```bash
   npm install
   ```

2. Ensure the dev server is running:
   ```bash
   npm run dev
   ```
   Default: `http://localhost:5175`

3. Install Playwright browsers (first time only):
   ```bash
   npx playwright install
   ```

### Run All RBAC Tests
```bash
npx playwright test tests/rbac/spec.ts
```

### Run Specific Test Suite
```bash
# Owner role tests only
npx playwright test tests/rbac/spec.ts --grep "Owner Role"

# Admin role tests only
npx playwright test tests/rbac/spec.ts --grep "Admin Role"

# Sales role tests only
npx playwright test tests/rbac/spec.ts --grep "Sales Role"

# Access denied tests
npx playwright test tests/rbac/spec.ts --grep "Access Denied"
```

### Run in Headed Mode (see browser)
```bash
npx playwright test tests/rbac/spec.ts --headed
```

### Run with Debug Mode
```bash
npx playwright test tests/rbac/spec.ts --debug
```

### Run Specific Test
```bash
npx playwright test tests/rbac/spec.ts --grep "should login successfully as owner"
```

### Generate HTML Report
```bash
npx playwright test tests/rbac/spec.ts --reporter=html
npx playwright show-report
```

## Expected Results

When all tests pass, you should see:
- ✅ All 3 roles can login successfully
- ✅ Owner can access all pages
- ✅ Admin can access company-level pages but NOT platform-level pages
- ✅ Sales can access basic pages but NOT management pages
- ✅ Access denied messages show for unauthorized access
- ✅ Role badges display correctly
- ✅ Navigation shows/hides based on role

## Troubleshooting

### Tests Failing - "Login Failed"
1. Verify credentials are correct
2. Check that dev server is running
3. Ensure database users exist with correct roles
4. Check browser console for auth errors

### Tests Failing - "Page Not Found"
1. Verify BASE_URL is correct (default: `http://localhost:5175`)
2. Check all routes exist in `src/App.tsx`
3. Ensure ProtectedRouteSimple is working

### Tests Failing - "Access Denied Not Working"
1. Verify role-based guards are in place
2. Check `src/components/auth/PermissionGuard.tsx`
3. Check `src/components/auth/ProtectedRouteSimple.tsx`
4. Ensure user role is being fetched correctly

### Tests Failing - "Thai Text Not Found"
1. Check that Thai translations are present
2. Verify access denied messages support both languages
3. Update test selectors if UI text changes

## Test Architecture

### Helper Functions

- `login(page, email, password)` - Performs user login
- `checkAccessDenied(page)` - Detects access denied messages (TH/EN)
- `getCurrentUserRole(page)` - Gets current role from UI

### Selectors Used

- **Email**: `input[type="email"]`
- **Password**: `input[type="password"]`
- **Submit**: `button:has-text("Sign in")`
- **Access Denied**: Multiple Thai/English variants
- **Role Badge**: `[data-testid="user-role-badge"], .role-badge`

### UI Text Matching

Tests handle both **Thai** and **English** text:
- ไม่มีสิทธิ์เข้าถึง (Access denied)
- การเข้าถึงถูกจำกัด (Access restricted)
- Access Denied
- Access Restricted

## Customization

### Adding New Role Tests

1. Add credentials to `CREDENTIALS` object
2. Add role to `PAGE_ACCESS` matrix
3. Create new test suite:
   ```typescript
   test.describe('RBAC - NewRole', () => {
     test('should login successfully', async ({ page }) => {
       await login(page, CREDENTIALS.newRole.email, CREDENTIALS.newRole.password);
       // Add assertions
     });
   });
   ```

### Adding New Page Tests

1. Add page to `PAGE_ACCESS` matrix
2. Add tests in each role suite:
   ```typescript
   test('should access new-page', async ({ page }) => {
     await login(page, CREDENTIALS.role.email, CREDENTIALS.role.password);
     await page.goto(`${BASE_URL}/new-page`);
     expect(await checkAccessDenied(page)).toBeFalsy();
   });
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: RBAC Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx playwright install --with-deps
      - run: npm run dev &
      - run: npx playwright test tests/rbac/spec.ts
```

## Security Testing Notes

These tests verify:
- ✅ Authentication flow
- ✅ Authorization at route level
- ✅ Authorization at component level
- ✅ Access denied messages display correctly
- ✅ Role isolation (no privilege escalation)
- ✅ Session management
- ✅ Logout functionality

**NOT covered** (requires additional security testing):
- SQL injection
- XSS attacks
- CSRF protection
- Rate limiting
- Password strength
- Session hijacking

## Support

For issues or questions:
1. Check test logs in `playwright-report/`
2. Run with `--debug` flag for interactive debugging
3. Check dev server console for errors
4. Verify database state and user roles

## License

These tests are part of the CHATEAU Platform and follow the same license.
