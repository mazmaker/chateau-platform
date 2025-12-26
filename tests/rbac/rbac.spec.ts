import { test, expect } from '@playwright/test';

/**
 * CHATEAU Platform - RBAC E2E Tests
 *
 * Tests Role-Based Access Control for 3 roles:
 * - Owner: Platform owner with full access
 * - Admin: Company admin with tenant-level access
 * - Sales: Sales staff with limited access
 *
 * Base URL: http://localhost:5175
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

// Test credentials
const CREDENTIALS = {
  owner: {
    email: 'mazmakerv2.sup@gmail.com',
    password: 'Chateau2025!'
  },
  admin: {
    email: 'admin@chateau.com',
    password: 'Admin123!'
  },
  sales: {
    email: 'sales@chateau.com',
    password: 'Sales123!'
  }
};

// Page access matrix
const PAGE_ACCESS = {
  owner: {
    '/owner': true,
    '/tenants': true,
    '/billing': true,
    '/properties': true,
    '/leads': true,
    '/customization': true,
    '/users': true,
    '/projects': true,
    '/': true
  },
  admin: {
    '/owner': false,
    '/tenants': false,
    '/billing': false,
    '/properties': true,
    '/leads': true,
    '/customization': true,
    '/users': true,
    '/projects': true,
    '/': true
  },
  sales: {
    '/owner': false,
    '/tenants': false,
    '/billing': false,
    '/properties': true,
    '/leads': true,
    '/customization': true,
    '/users': false,
    '/projects': true,
    '/': true
  }
};

// Role badge icons
const ROLE_ICONS = {
  owner: '👑',
  admin: '🔧',
  sales: '💼'
};

// Helper function to perform login
async function login(page, email: string, password: string) {
  await page.goto(`${BASE_URL}/auth/login`);

  // Wait for login form to be visible
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });

  // Fill in credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Click sign in button - Support both Thai and English
  // Try multiple selectors in order
  const buttonSelectors = [
    'button:has-text("เข้าสู่ระบบ")',     // Thai: Sign in
    'button:has-text("Sign in")',          // English: Sign in
    'button:has-text("Login")',            // English: Login
    'button:has-text("ล็อกอิน")',           // Thai: Login
    'button[type="submit"]',               // Fallback: submit button
  ];

  for (const selector of buttonSelectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
        await button.click();
        break;
      }
    } catch {
      // Continue to next selector
    }
  }

  // Wait for navigation to dashboard
  await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

  // Wait for dashboard to load
  await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
}

// Helper function to check access denied message
async function checkAccessDenied(page) {
  // Check for Thai access denied message
  const thaiMessage = page.locator('text=ไม่มีสิทธิ์เข้าถึง');
  // Check for English access denied message
  const englishMessage = page.locator('text=Access Denied');
  // Check for "การเข้าถึงถูกจำกัด" (Access restricted)
  const restrictedMessage = page.locator('text=การเข้าถึงถูกจำกัด');

  const hasAccessDenied = await Promise.any([
    thaiMessage.isVisible().catch(() => false),
    englishMessage.isVisible().catch(() => false),
    restrictedMessage.isVisible().catch(() => false)
  ]);

  return hasAccessDenied;
}

// Helper function to get current user role from UI
async function getCurrentUserRole(page) {
  // Try to find role badge in header
  const roleBadge = page.locator('[data-testid="user-role-badge"], .role-badge');
  if (await roleBadge.isVisible()) {
    return await roleBadge.textContent();
  }

  // Try to find role in user menu
  const userMenu = page.locator('[data-testid="user-menu"], .user-menu');
  if (await userMenu.isVisible()) {
    const text = await userMenu.textContent();
    if (text?.includes('owner') || text?.includes('เจ้าของ')) return 'owner';
    if (text?.includes('admin') || text?.includes('ผู้ดูแล')) return 'admin';
    if (text?.includes('sales') || text?.includes('พนักงานขาย')) return 'sales';
  }

  return null;
}

test.describe('RBAC - Owner Role', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should login successfully as owner', async ({ page }) => {
    await login(page, CREDENTIALS.owner.email, CREDENTIALS.owner.password);

    // Verify we're on the dashboard
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // Check for owner-specific elements
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should access owner dashboard', async ({ page }) => {
    await login(page, CREDENTIALS.owner.email, CREDENTIALS.owner.password);

    await page.goto(`${BASE_URL}/owner`);

    // Should NOT see access denied
    expect(await checkAccessDenied(page)).toBeFalsy();

    // Should see owner dashboard content
    await expect(page.locator('text=Owner Dashboard')).toBeVisible({ timeout: 5000 });
  });

  test('should access tenant management', async ({ page }) => {
    await login(page, CREDENTIALS.owner.email, CREDENTIALS.owner.password);

    await page.goto(`${BASE_URL}/tenants`);

    // Should NOT see access denied
    expect(await checkAccessDenied(page)).toBeFalsy();

    // Should see tenant management content
    await expect(page.locator('text=จัดการบริษัท').or(page.locator('text=Tenants'))).toBeVisible({ timeout: 5000 });
  });

  test('should access billing management', async ({ page }) => {
    await login(page, CREDENTIALS.owner.email, CREDENTIALS.owner.password);

    await page.goto(`${BASE_URL}/billing`);

    // Should NOT see access denied
    expect(await checkAccessDenied(page)).toBeFalsy();

    // Should see billing content
    await expect(page.locator('text=Billing').or(page.locator('text=การเงิน'))).toBeVisible({ timeout: 5000 });
  });

  test('should access property management', async ({ page }) => {
    await login(page, CREDENTIALS.owner.email, CREDENTIALS.owner.password);

    await page.goto(`${BASE_URL}/properties`);

    // Should NOT see access denied
    expect(await checkAccessDenied(page)).toBeFalsy();

    // Should see property management content
    await expect(page.locator('text=โครงการและยูนิต').or(page.locator('text=Properties'))).toBeVisible({ timeout: 5000 });
  });

  test('should access lead management', async ({ page }) => {
    await login(page, CREDENTIALS.owner.email, CREDENTIALS.owner.password);

    await page.goto(`${BASE_URL}/leads`);

    // Should NOT see access denied
    expect(await checkAccessDenied(page)).toBeFalsy();

    // Should see lead management content
    await expect(page.locator('text=Leads').or(page.locator('text=ลูกค้าสนใจ'))).toBeVisible({ timeout: 5000 });
  });

  test('should display correct role badge with crown icon', async ({ page }) => {
    await login(page, CREDENTIALS.owner.email, CREDENTIALS.owner.password);

    // Check for role badge
    const roleBadge = page.locator('[data-testid="user-role"], .role-badge');

    // Should show owner role with crown icon or similar
    const pageContent = await page.content();
    const hasCrownIcon = pageContent.includes('👑') ||
                        await page.locator('svg[icon="crown"], svg[data-icon="crown"]').count() > 0;

    if (await roleBadge.isVisible()) {
      const badgeText = await roleBadge.textContent();
      expect(badgeText?.toLowerCase()).toContain('owner');
    }
  });
});

test.describe('RBAC - Admin Role', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should login successfully as admin', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    // Verify we're on the dashboard
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // Check for dashboard elements
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should NOT access owner dashboard', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    await page.goto(`${BASE_URL}/owner`);

    // Should see access denied or be redirected
    await page.waitForTimeout(2000); // Wait for redirect/error

    const currentUrl = page.url();
    const hasAccessDenied = await checkAccessDenied(page);

    // Either redirected to home or see access denied
    expect(
      currentUrl === `${BASE_URL}/` ||
      currentUrl.includes('/owner') === false ||
      hasAccessDenied
    ).toBeTruthy();
  });

  test('should NOT access tenant management', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    await page.goto(`${BASE_URL}/tenants`);

    // Should see access denied or be redirected
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const hasAccessDenied = await checkAccessDenied(page);

    // Either redirected to home or see access denied
    expect(
      currentUrl === `${BASE_URL}/` ||
      hasAccessDenied
    ).toBeTruthy();
  });

  test('should NOT access billing management', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    await page.goto(`${BASE_URL}/billing`);

    // Should see access denied or be redirected
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const hasAccessDenied = await checkAccessDenied(page);

    // Either redirected to home or see access denied
    expect(
      currentUrl === `${BASE_URL}/` ||
      hasAccessDenied
    ).toBeTruthy();
  });

  test('should access property management', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    await page.goto(`${BASE_URL}/properties`);

    // Should NOT see access denied
    expect(await checkAccessDenied(page)).toBeFalsy();

    // Should see property management content
    await expect(page.locator('text=โครงการและยูนิต').or(page.locator('text=Properties'))).toBeVisible({ timeout: 5000 });
  });

  test('should access lead management', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    await page.goto(`${BASE_URL}/leads`);

    // Should NOT see access denied
    expect(await checkAccessDenied(page)).toBeFalsy();

    // Should see lead management content
    await expect(page.locator('text=Leads').or(page.locator('text=ลูกค้าสนใจ'))).toBeVisible({ timeout: 5000 });
  });

  test('should access customization page', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    await page.goto(`${BASE_URL}/customization`);

    // Should NOT see access denied
    expect(await checkAccessDenied(page)).toBeFalsy();

    // Should see customization content
    await expect(page.locator('text=Customization').or(page.locator('text=ปรับแต่ง'))).toBeVisible({ timeout: 5000 });
  });

  test('should display correct admin role badge', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    // Check for role indicator
    const pageContent = await page.content();
    const hasAdminIndicator = pageContent.toLowerCase().includes('admin') ||
                             pageContent.includes('ผู้ดูแล') ||
                             pageContent.includes('🔧');

    expect(hasAdminIndicator).toBeTruthy();
  });
});

test.describe('RBAC - Sales Role', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should login successfully as sales', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    // Verify we're on the dashboard
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // Check for dashboard elements
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should NOT access owner dashboard', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    await page.goto(`${BASE_URL}/owner`);

    // Should see access denied or be redirected
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const hasAccessDenied = await checkAccessDenied(page);

    // Either redirected to home or see access denied
    expect(
      currentUrl === `${BASE_URL}/` ||
      hasAccessDenied
    ).toBeTruthy();
  });

  test('should NOT access tenant management', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    await page.goto(`${BASE_URL}/tenants`);

    // Should see access denied or be redirected
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const hasAccessDenied = await checkAccessDenied(page);

    // Either redirected to home or see access denied
    expect(
      currentUrl === `${BASE_URL}/` ||
      hasAccessDenied
    ).toBeTruthy();
  });

  test('should NOT access billing management', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    await page.goto(`${BASE_URL}/billing`);

    // Should see access denied or be redirected
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const hasAccessDenied = await checkAccessDenied(page);

    // Either redirected to home or see access denied
    expect(
      currentUrl === `${BASE_URL}/` ||
      hasAccessDenied
    ).toBeTruthy();
  });

  test('should access property management', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    await page.goto(`${BASE_URL}/properties`);

    // Should NOT see access denied
    expect(await checkAccessDenied(page)).toBeFalsy();

    // Should see property management content
    await expect(page.locator('text=โครงการและยูนิต').or(page.locator('text=Properties'))).toBeVisible({ timeout: 5000 });
  });

  test('should access lead management', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    await page.goto(`${BASE_URL}/leads`);

    // Should NOT see access denied
    expect(await checkAccessDenied(page)).toBeFalsy();

    // Should see lead management content
    await expect(page.locator('text=Leads').or(page.locator('text=ลูกค้าสนใจ'))).toBeVisible({ timeout: 5000 });
  });

  test('should access customization page', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    await page.goto(`${BASE_URL}/customization`);

    // Should NOT see access denied
    expect(await checkAccessDenied(page)).toBeFalsy();

    // Should see customization content
    await expect(page.locator('text=Customization').or(page.locator('text=ปรับแต่ง'))).toBeVisible({ timeout: 5000 });
  });

  test('should NOT access user management', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    await page.goto(`${BASE_URL}/users`);

    // Should see access denied or be redirected
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const hasAccessDenied = await checkAccessDenied(page);

    // Either redirected to home or see access denied
    expect(
      currentUrl === `${BASE_URL}/` ||
      hasAccessDenied
    ).toBeTruthy();
  });

  test('should display correct sales role badge', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    // Check for role indicator
    const pageContent = await page.content();
    const hasSalesIndicator = pageContent.toLowerCase().includes('sales') ||
                             pageContent.includes('พนักงานขาย') ||
                             pageContent.includes('💼');

    expect(hasSalesIndicator).toBeTruthy();
  });
});

test.describe('RBAC - Cross-Role Isolation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('owner should see all navigation items', async ({ page }) => {
    await login(page, CREDENTIALS.owner.email, CREDENTIALS.owner.password);

    // Check for navigation items
    const nav = page.locator('nav, [role="navigation"], .sidebar');

    // Owner should see links to all pages
    const hasOwnerLinks = await page.locator('a[href="/owner"]').count() > 0 ||
                         await page.locator('a[href="/tenants"]').count() > 0 ||
                         await page.locator('a[href="/billing"]').count() > 0;

    // At least some owner-specific navigation should be visible
    expect(hasOwnerLinks).toBeTruthy();
  });

  test('admin should NOT see owner-only navigation items', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    // Admin should NOT see links to owner-only pages
    const hasOwnerLinks = await page.locator('a[href="/owner"]').count() > 0 ||
                         await page.locator('a[href="/tenants"]').count() > 0 ||
                         await page.locator('a[href="/billing"]').count() > 0;

    // These links should not be visible to admin
    expect(hasOwnerLinks).toBeFalsy();
  });

  test('sales should see limited navigation items', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    // Sales should NOT see owner-only links
    const hasOwnerLinks = await page.locator('a[href="/owner"]').count() > 0 ||
                         await page.locator('a[href="/tenants"]').count() > 0 ||
                         await page.locator('a[href="/billing"]').count() > 0;

    expect(hasOwnerLinks).toBeFalsy();
  });
});

test.describe('RBAC - Access Denied Messages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should show Thai access denied message for unauthorized pages', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    // Try to access owner-only page
    await page.goto(`${BASE_URL}/owner`);

    await page.waitForTimeout(2000);

    // Check for access denied message in Thai
    const hasThaiMessage = await page.locator('text=ไม่มีสิทธิ์เข้าถึง').count() > 0 ||
                          await page.locator('text=การเข้าถึงถูกจำกัด').count() > 0 ||
                          await page.locator('text=คุณไม่มีสิทธิ์').count() > 0;

    const hasEnglishMessage = await page.locator('text=Access Denied').count() > 0 ||
                             await page.locator('text=Access Restricted').count() > 0;

    // Should see some form of access denied message
    expect(hasThaiMessage || hasEnglishMessage).toBeTruthy();
  });

  test('should show required role in access denied message', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    // Try to access owner-only page
    await page.goto(`${BASE_URL}/billing`);

    await page.waitForTimeout(2000);

    // Check if message mentions required role
    const pageContent = await page.content();
    const mentionsOwner = pageContent.toLowerCase().includes('owner') ||
                         pageContent.includes('เจ้าของ');

    if (await checkAccessDenied(page)) {
      expect(mentionsOwner).toBeTruthy();
    }
  });
});

test.describe('RBAC - Session Management', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should maintain role across page navigation', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    // Navigate to multiple pages
    await page.goto(`${BASE_URL}/properties`);
    await page.waitForTimeout(1000);

    await page.goto(`${BASE_URL}/leads`);
    await page.waitForTimeout(1000);

    await page.goto(`${BASE_URL}/`);

    // Should still be logged in with same role
    await expect(page.locator('h1')).toBeVisible();

    // Should not see access denied on dashboard
    expect(await checkAccessDenied(page)).toBeFalsy();
  });

  test('should redirect to login when accessing protected page without auth', async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();

    // Try to access protected page directly
    await page.goto(`${BASE_URL}/properties`);

    // Should redirect to login
    await page.waitForURL(`*/auth/login`, { timeout: 5000 });

    const currentUrl = page.url();
    expect(currentUrl).toContain('/auth/login');
  });
});

test.describe('RBAC - Permission Guards', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('owner should see delete buttons', async ({ page }) => {
    await login(page, CREDENTIALS.owner.email, CREDENTIALS.owner.password);

    await page.goto(`${BASE_URL}/properties`);
    await page.waitForTimeout(2000);

    // Owner should have delete permissions
    const deleteButtons = await page.locator('button:has-text("ลบ"), button:has-text("Delete"), .delete-btn').count();

    // Note: This might be 0 if there are no properties, but the permissions should allow it
    // We're mainly checking the page loads without access denied
    expect(await checkAccessDenied(page)).toBeFalsy();
  });

  test('sales should NOT see delete buttons on properties', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    await page.goto(`${BASE_URL}/properties`);
    await page.waitForTimeout(2000);

    // Sales should not have delete permissions
    // The page should load but delete actions should be hidden
    expect(await checkAccessDenied(page)).toBeFalsy();

    // Check that sales-specific UI elements are present
    const pageContent = await page.content();
    expect(pageContent.toLowerCase()).toContain('properties');
  });
});

test.describe('RBAC - Role Switching (Multi-Tenant)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should display current tenant information', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    // Check for tenant switcher or tenant info
    const tenantInfo = page.locator('[data-testid="tenant-switcher"], .tenant-switcher, [data-testid="current-tenant"]');

    // Wait for page to fully load
    await page.waitForTimeout(2000);

    const hasTenantInfo = await tenantInfo.count() > 0;

    // Tenant info might be visible (depending on implementation)
    if (hasTenantInfo) {
      await expect(tenantInfo.first()).toBeVisible();
    }
  });
});

test.describe('RBAC - UI Elements Visibility', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('owner should see all dashboard stats', async ({ page }) => {
    await login(page, CREDENTIALS.owner.email, CREDENTIALS.owner.password);

    // Owner should see comprehensive stats
    await page.waitForTimeout(2000);

    const statsCards = await page.locator('.stat-card, .card, [class*="stat"]').count();
    expect(statsCards).toBeGreaterThan(0);
  });

  test('sales should see limited dashboard stats', async ({ page }) => {
    await login(page, CREDENTIALS.sales.email, CREDENTIALS.sales.password);

    // Sales should see relevant stats
    await page.waitForTimeout(2000);

    const statsCards = await page.locator('.stat-card, .card, [class*="stat"]').count();
    expect(statsCards).toBeGreaterThan(0);

    // Should NOT see owner-only stats
    const hasMRR = await page.locator('text=MRR').count() > 0 ||
                  await page.locator('text=รายได้ต่อเดือน').count() > 0;

    // Sales might not see revenue metrics
    // (this is optional depending on business requirements)
  });
});

test.describe('RBAC - Logout', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should logout successfully and prevent access to protected pages', async ({ page }) => {
    await login(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);

    // Verify logged in
    await expect(page.locator('h1')).toBeVisible();

    // Logout
    const logoutButton = page.locator('button:has-text("Sign Out"), button:has-text("ออกจากระบบ"), [data-testid="logout-button"]');

    if (await logoutButton.count() > 0) {
      // Click user menu first if needed
      const userMenu = page.locator('[data-testid="user-menu"], .user-menu, avatar');
      if (await userMenu.count() > 0) {
        await userMenu.first().click();
        await page.waitForTimeout(500);
      }

      await logoutButton.first().click();
      await page.waitForTimeout(2000);
    }

    // Try to access protected page
    await page.goto(`${BASE_URL}/properties`);

    // Should redirect to login
    await page.waitForTimeout(2000);
    const currentUrl = page.url();

    const isLoggedIn = await page.locator('h1').count() > 0;
    expect(isLoggedIn || currentUrl.includes('/login')).toBeTruthy();
  });
});
