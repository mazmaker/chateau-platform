# Production Readiness Quickstart Guide

This guide helps you quickly set up the production-ready enhancements for the CHATEAU platform while preserving all existing functionality.

## Prerequisites

- Node.js 18+ installed
- Git repository with existing prototype
- Supabase account (free tier sufficient for development)
- Basic familiarity with React and TypeScript

## Step 1: Set Up Supabase Project

1. **Create Supabase Project**
   ```bash
   # Install Supabase CLI
   npm install -g @supabase/cli

   # Initialize in project root
   cd /path/to/chateau
   supabase init
   ```

2. **Configure Local Development**
   ```bash
   # Start local Supabase
   supabase start

   # This will output your local environment variables
   ```

3. **Apply Database Schema**
   ```bash
   # Apply the production schema
   supabase db push specs/001-production-readiness/contracts/schema.sql

   # Generate TypeScript types
   supabase gen types typescript --local > src/types/database.ts
   ```

4. **Set Environment Variables**
   ```env
   # .env.local
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_ANON_KEY=your_local_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key
   ```

## Step 2: Install Production Dependencies

```bash
# Core dependencies for production readiness
npm install @supabase/supabase-js @tanstack/react-query
npm install react-router-dom react-hook-form @hookform/resolvers zod
npm install clsx tailwind-merge lucide-react

# Development dependencies
npm install -D @tanstack/react-query-devtools
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D msw @mswjs/data playwright
```

## Step 3: Set Up Project Structure

```bash
# Create production-ready directory structure
mkdir -p src/{components/{ui,forms,layout},lib,services,hooks,stores,types}
mkdir -p tests/{unit,integration,e2e,__mocks__}
mkdir -p supabase/{migrations,functions,seed}
```

## Step 4: Configure Supabase Client

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})
```

## Step 5: Implement Authentication

Create `src/contexts/AuthContext.tsx`:

```typescript
import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

## Step 6: Set Up React Query

Create `src/lib/queryClient.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false
        }
        return failureCount < 3
      }
    },
    mutations: {
      retry: 1
    }
  }
})
```

Update `src/main.tsx`:

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import App from './App'
import { queryClient } from '@/lib/queryClient'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
)
```

## Step 7: Create Data Fetching Hooks

Create `src/hooks/useSupabaseQuery.ts`:

```typescript
import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'

type Table = keyof Database['public']['Tables']
type Row<T extends Table> = Database['public']['Tables'][T]['Row']

export function useSupabaseQuery<T extends Table>({
  table,
  select = '*',
  filter,
  orderBy,
  options = {}
}: {
  table: T
  select?: string
  filter?: Record<string, any>
  orderBy?: { column: string; ascending?: boolean }
  options?: Omit<UseQueryOptions<Row<T>[]>, 'queryKey' | 'queryFn'>
}) {
  let query = supabase.from(table).select(select)

  // Apply filters
  if (filter) {
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value)
      }
    })
  }

  // Apply ordering
  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
  }

  return useQuery({
    queryKey: [table, filter, orderBy],
    queryFn: async () => {
      const { data, error } = await query
      if (error) throw error
      return data as Row<T>[]
    },
    ...options
  })
}
```

## Step 8: Preserve Existing Components

Wrap your existing components with authentication and query providers:

```typescript
// Example: Update your main dashboard component
import { useAuth } from '@/contexts/AuthContext'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'

export function Dashboard() {
  const { user } = useAuth()

  // Fetch data using React Query instead of local state
  const { data: properties, isLoading } = useSupabaseQuery({
    table: 'properties',
    filter: { status: 'available' }
  })

  // Your existing dashboard logic preserved
  return (
    <div>
      {/* Your existing dashboard UI */}
      <h1>Welcome, {user?.email}</h1>
      {/* Render properties with enhanced loading states */}
    </div>
  )
}
```

## Step 9: Add Error Boundaries

Create `src/components/ErrorBoundary.tsx`:

```typescript
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

export class ErrorBoundary extends Component<Props, { hasError: boolean }> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-fallback">
          <h2>Something went wrong.</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

## Step 10: Implement Multi-Tenant Support

Create `src/hooks/useTenant.ts`:

```typescript
import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function useTenant() {
  const { user } = useAuth()

  const tenant = useMemo(() => {
    if (!user) return null

    // Get user's tenant from user metadata or fetch
    const tenantId = user.user_metadata?.tenant_id
    return tenantId || null
  }, [user])

  const setTenantContext = (tenantId: string) => {
    // Set tenant context for RLS policies
    supabase.rpc('set_tenant_context', { p_tenant_id: tenantId })
  }

  return { tenant, setTenantContext }
}
```

## Step 11: Add Real-time Updates

Create `src/hooks/useRealtimeSubscription.ts`:

```typescript
import { useEffect, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function useRealtimeSubscription({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete
}: {
  table: string
  filter?: string
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
}) {
  const [connected, setConnected] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel(`${table}-changes`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter
        },
        (payload) => {
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload)
              break
            case 'UPDATE':
              onUpdate?.(payload)
              break
            case 'DELETE':
              onDelete?.(payload)
              break
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [table, filter])

  return { connected }
}
```

## Step 12: Testing Setup

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

export const server = setupServer(...handlers)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## Step 13: Performance Optimization

1. **Code Splitting**
   ```typescript
   // Lazy load components
   const Dashboard = lazy(() => import('./pages/Dashboard'))
   const Reports = lazy(() => import('./pages/Reports'))

   // Use Suspense for loading states
   <Suspense fallback={<Loading />}>
     <Routes>
       <Route path="/dashboard" element={<Dashboard />} />
     </Routes>
   </Suspense>
   ```

2. **Bundle Analysis**
   ```bash
   npm run build
   npm run preview

   # Analyze bundle size
   npx vite-bundle-analyzer dist
   ```

## Step 14: Deployment Preparation

1. **Environment Variables for Production**
   ```env
   # Production
   VITE_SUPABASE_URL=your_production_supabase_url
   VITE_SUPABASE_ANON_KEY=your_production_anon_key
   ```

2. **Build Command**
   ```bash
   npm run build
   ```

3. **Deploy to Supabase**
   ```bash
   # Push database changes to production
   supabase db push --linked

   # Deploy edge functions if any
   supabase functions deploy
   ```

## Migration Checklist

- [ ] Backup existing prototype code
- [ ] Set up Supabase project
- [ ] Install all dependencies
- [ ] Configure authentication
- [ ] Implement data fetching with React Query
- [ ] Add error boundaries
- [ ] Set up testing infrastructure
- [ ] Implement multi-tenant support
- [ ] Add real-time subscriptions
- [ ] Optimize performance
- [ ] Test all existing functionality
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Production deployment

## Troubleshooting

### Common Issues

1. **RLS Policies Blocking Access**
   - Ensure user is properly authenticated
   - Check user has correct tenant association
   - Verify policies match your data structure

2. **Real-time Not Working**
   - Check Realtime is enabled in Supabase
   - Verify RLS policies allow subscriptions
   - Ensure proper cleanup in useEffect

3. **Performance Issues**
   - Check database indexes
   - Verify query efficiency
   - Consider implementing caching

### Getting Help

- Check the [Research Document](research.md) for detailed patterns
- Review the [Data Model](data-model.md) for schema understanding
- Consult the [API Contracts](contracts/api.yaml) for endpoint details
- Join the [Supabase Discord](https://discord.gg/supabase) for community support

## Next Steps

1. Run the complete test suite:
   ```bash
   npm run test:all
   ```

2. Generate tasks for implementation:
   ```bash
   /speckit.tasks 001-production-readiness
   ```

3. Begin implementation following the task order in the generated tasks.md

Your prototype is now ready for production enhancement! All existing functionality is preserved while adding enterprise-grade features.