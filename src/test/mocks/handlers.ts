// @ts-nocheck — legacy msw v1 mocks; rewrite for msw v2 (http handlers) when these tests are revisited
import { rest } from 'msw'

// Mock API handlers for testing
export const handlers = [
  // Mock Supabase auth endpoint
  rest.post('*/auth/v1/token', (req, res, ctx) => {
    return res(
      ctx.json({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        user: {
          id: 'mock-user-id',
          email: 'test@example.com',
          user_metadata: {
            tenant_id: 'mock-tenant-id'
          }
        }
      })
    )
  }),

  // Mock Supabase user endpoint
  rest.get('*/auth/v1/user', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'mock-user-id',
        email: 'test@example.com',
        user_metadata: {
          tenant_id: 'mock-tenant-id'
        }
      })
    )
  }),

  // Mock tenants endpoint
  rest.get('*/rest/v1/tenants', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 'mock-tenant-id',
          name: 'Mock Company',
          slug: 'mock-company',
          is_active: true,
          created_at: new Date().toISOString()
        }
      ])
    )
  }),

  // Mock users endpoint
  rest.get('*/rest/v1/users', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 'mock-user-id',
          email: 'test@example.com',
          full_name: 'Test User',
          is_active: true,
          created_at: new Date().toISOString()
        }
      ])
    )
  })
]