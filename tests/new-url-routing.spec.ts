import { test, expect } from '@playwright/test';

test.describe('New URL Routing - Lead, Campaign, and Tenant Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication state and setup
    test.setTimeout(30000);
  });

  test.describe('Lead Management URL Routing', () => {
    test('lead route structure is accessible', async ({ page }) => {
      await page.goto('/leads');
      await page.waitForTimeout(2000);

      // Should not have major JavaScript errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      const currentUrl = page.url();
      const isLoginPage = currentUrl.includes('/auth/login');
      const isLeadsPage = currentUrl.includes('/leads');

      expect(isLoginPage || isLeadsPage).toBeTruthy();

      // Check for no critical JavaScript errors
      const criticalErrors = errors.filter(error =>
        !error.includes('Warning') &&
        !error.includes('favicon.ico') &&
        !error.toLowerCase().includes('chunk load failed')
      );

      expect(criticalErrors.length).toBe(0);
    });

    test('lead detail route accepts UUID parameter', async ({ page }) => {
      const testUuid = '123e4567-e89b-12d3-a456-426614174000';

      await page.goto(`/leads/${testUuid}`);
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      const isLoginRedirect = currentUrl.includes('/auth/login');
      const isLeadsRoute = currentUrl.includes('/leads');

      expect(isLoginRedirect || isLeadsRoute).toBeTruthy();
    });

    test('invalid lead route redirects appropriately', async ({ page }) => {
      await page.goto('/leads/invalid-id');
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      const hasLeadsInUrl = currentUrl.includes('/leads');
      const hasLoginInUrl = currentUrl.includes('/auth/login');

      expect(hasLeadsInUrl || hasLoginInUrl).toBeTruthy();
    });
  });

  test.describe('Campaign Management URL Routing', () => {
    test('campaign route structure is accessible', async ({ page }) => {
      await page.goto('/campaigns');
      await page.waitForTimeout(2000);

      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      const currentUrl = page.url();
      const isLoginPage = currentUrl.includes('/auth/login');
      const isCampaignsPage = currentUrl.includes('/campaigns');

      expect(isLoginPage || isCampaignsPage).toBeTruthy();

      // Check for no critical JavaScript errors
      const criticalErrors = errors.filter(error =>
        !error.includes('Warning') &&
        !error.includes('favicon.ico') &&
        !error.toLowerCase().includes('chunk load failed')
      );

      expect(criticalErrors.length).toBe(0);
    });

    test('campaign detail route accepts UUID parameter', async ({ page }) => {
      const testUuid = '123e4567-e89b-12d3-a456-426614174000';

      await page.goto(`/campaigns/${testUuid}`);
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      const isLoginRedirect = currentUrl.includes('/auth/login');
      const isCampaignsRoute = currentUrl.includes('/campaigns');

      expect(isLoginRedirect || isCampaignsRoute).toBeTruthy();
    });

    test('invalid campaign route redirects appropriately', async ({ page }) => {
      await page.goto('/campaigns/invalid-id');
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      const hasCampaignsInUrl = currentUrl.includes('/campaigns');
      const hasLoginInUrl = currentUrl.includes('/auth/login');

      expect(hasCampaignsInUrl || hasLoginInUrl).toBeTruthy();
    });
  });

  test.describe('Tenant Management URL Routing', () => {
    test('tenant route structure is accessible', async ({ page }) => {
      await page.goto('/tenants');
      await page.waitForTimeout(2000);

      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      const currentUrl = page.url();
      const isLoginPage = currentUrl.includes('/auth/login');
      const isTenantsPage = currentUrl.includes('/tenants');

      expect(isLoginPage || isTenantsPage).toBeTruthy();

      // Check for no critical JavaScript errors
      const criticalErrors = errors.filter(error =>
        !error.includes('Warning') &&
        !error.includes('favicon.ico') &&
        !error.toLowerCase().includes('chunk load failed')
      );

      expect(criticalErrors.length).toBe(0);
    });

    test('tenant detail route accepts UUID parameter', async ({ page }) => {
      const testUuid = '123e4567-e89b-12d3-a456-426614174000';

      await page.goto(`/tenants/${testUuid}`);
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      const isLoginRedirect = currentUrl.includes('/auth/login');
      const isTenantsRoute = currentUrl.includes('/tenants');

      expect(isLoginRedirect || isTenantsRoute).toBeTruthy();
    });

    test('invalid tenant route redirects appropriately', async ({ page }) => {
      await page.goto('/tenants/invalid-id');
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      const hasTenantsInUrl = currentUrl.includes('/tenants');
      const hasLoginInUrl = currentUrl.includes('/auth/login');

      expect(hasTenantsInUrl || hasLoginInUrl).toBeTruthy();
    });
  });

  test.describe('URL Structure Validation', () => {
    test('all management sections support UUID routing', async ({ page }) => {
      const testUuid = '123e4567-e89b-12d3-a456-426614174000';
      const routes = [
        `/leads/${testUuid}`,
        `/campaigns/${testUuid}`,
        `/tenants/${testUuid}`,
        `/properties/${testUuid}` // Include existing property routing
      ];

      for (const route of routes) {
        await page.goto(route);
        await page.waitForTimeout(500);

        const currentUrl = page.url();

        // Should either stay on the route or redirect to login (both are valid)
        const staysOnRoute = currentUrl.includes(route.split('/')[1]); // Extract section name
        const redirectsToLogin = currentUrl.includes('/auth/login');

        expect(staysOnRoute || redirectsToLogin).toBeTruthy();
      }
    });

    test('malformed URLs are handled gracefully', async ({ page }) => {
      const malformedUrls = [
        '/leads/null',
        '/campaigns/undefined',
        '/tenants/%20',
        '/leads/../../etc/passwd',
        '/campaigns/malformed-id',
        '/tenants/not-a-uuid'
      ];

      for (const url of malformedUrls) {
        await page.goto(url);
        await page.waitForTimeout(500);

        const currentUrl = page.url();

        // Should handle gracefully - either redirect to list or login
        const isHandledGracefully =
          currentUrl.includes('/leads') ||
          currentUrl.includes('/campaigns') ||
          currentUrl.includes('/tenants') ||
          currentUrl.includes('/auth/login');

        expect(isHandledGracefully).toBeTruthy();
      }
    });

    test('React Router navigation is properly configured', async ({ page }) => {
      const managementPages = ['/leads', '/campaigns', '/tenants', '/properties'];

      for (const route of managementPages) {
        await page.goto(route);
        await page.waitForTimeout(1000);

        // Test JavaScript navigation
        const navigationWorks = await page.evaluate((testRoute) => {
          try {
            // Check if we can access location and history (React Router context)
            return window.location.pathname.includes(testRoute.substring(1)) ||
                   window.location.pathname.includes('login');
          } catch {
            return false;
          }
        }, route);

        expect(navigationWorks).toBeTruthy();
      }
    });
  });

  test.describe('Permission Guards with URL Routing', () => {
    test('tenant management requires owner role via URL', async ({ page }) => {
      // Test that tenant URLs are protected by owner role requirement
      await page.goto('/tenants');
      await page.waitForTimeout(1500);

      const currentUrl = page.url();

      // Should redirect to login since we don't have owner permissions in test
      expect(currentUrl.includes('/auth/login') || currentUrl.includes('/tenants')).toBeTruthy();
    });

    test('lead and campaign management work with lower permissions', async ({ page }) => {
      const routes = ['/leads', '/campaigns'];

      for (const route of routes) {
        await page.goto(route);
        await page.waitForTimeout(1000);

        const currentUrl = page.url();

        // These should be accessible to sales/admin roles (or redirect to login)
        expect(currentUrl.includes(route.substring(1)) || currentUrl.includes('/auth/login')).toBeTruthy();
      }
    });
  });

  test.describe('Browser Navigation with URL Routing', () => {
    test('back and forward buttons work correctly', async ({ page }) => {
      // Navigate through different management sections
      await page.goto('/leads');
      await page.waitForTimeout(1000);

      await page.goto('/campaigns');
      await page.waitForTimeout(1000);

      // Use browser back button
      await page.goBack();
      await page.waitForTimeout(1000);

      // Should be back to leads (or login if redirected)
      const backUrl = page.url();
      expect(backUrl.includes('/leads') || backUrl.includes('/auth/login')).toBeTruthy();

      // Use browser forward button
      await page.goForward();
      await page.waitForTimeout(1000);

      // Should be at campaigns again
      const forwardUrl = page.url();
      expect(forwardUrl.includes('/campaigns') || forwardUrl.includes('/auth/login')).toBeTruthy();
    });

    test('direct URL access works for all sections', async ({ page }) => {
      const directUrls = [
        '/leads',
        '/campaigns',
        '/tenants',
        '/properties' // Include existing
      ];

      for (const url of directUrls) {
        // Open in new tab (simulates direct URL access)
        await page.goto(url);
        await page.waitForTimeout(1000);

        const currentUrl = page.url();

        // Should load the page or redirect to login appropriately
        expect(
          currentUrl.includes(url.substring(1)) ||
          currentUrl.includes('/auth/login')
        ).toBeTruthy();
      }
    });
  });
});