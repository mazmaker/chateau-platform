import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback
} from 'react'
import { User as SupabaseUser, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'

// Import company settings function
import { getCompanySettings } from '@/lib/api/companySettings'

// Types
export interface Tenant {
  id: string
  name: string
  slug: string
  status: 'trial' | 'active' | 'suspended' | 'cancelled'
  logo_url: string | null
  primary_color: string
  secondary_color: string
  logo_url_cached?: string  // Cached from company_settings
  company_name_cached?: string  // Cached from company_settings
}

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  role: 'owner' | 'admin' | 'sales' | 'agent' | 'customer' | null
  is_active: boolean
  created_at: string | null
  tenant_id?: string | null
  password_reset_required?: boolean
  password_set_at?: string | null
  first_login_at?: string | null
}

interface UserTenant {
  id: string
  user_id: string
  tenant_id: string
  role: 'owner' | 'admin' | 'sales' | 'agent' | 'customer'
  is_active: boolean
  tenants: Tenant
}

interface AuthContextType {
  user: SupabaseUser | null
  userProfile: UserProfile | null
  session: Session | null
  loading: boolean
  authChecked: boolean
  currentTenant: Tenant | null
  userRole: 'owner' | 'admin' | 'sales' | 'agent' | 'customer' | null
  tenantSuspended: boolean  // true when tenant status is 'suspended'
  passwordResetRequired: boolean  // true when user must change password on next login
  userTenants: UserTenant[]
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; data?: any; passwordResetRequired?: boolean }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null; data?: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  switchTenant: (tenantId: string) => Promise<void>
  switchTenantAsOwner: (tenant: Tenant) => void
  refreshUser: () => Promise<void>
}

const AuthContextSimple = createContext<AuthContextType | undefined>(undefined)

export const useSimpleAuth = () => {
  const context = useContext(AuthContextSimple)
  if (context === undefined) {
    throw new Error('useSimpleAuth must be used within a SimpleAuthProvider')
  }
  return context
}

interface SimpleAuthProviderProps {
  children: ReactNode
}

export const SimpleAuthProvider = ({ children }: SimpleAuthProviderProps) => {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(false) // Start with false for faster initial load
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null)
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'sales' | 'agent' | 'customer' | null>(null)
  const [tenantSuspended, setTenantSuspended] = useState(false) // Track if tenant is suspended
  const [passwordResetRequired, setPasswordResetRequired] = useState(false) // Track if user must change password
  const [userTenants, setUserTenants] = useState<UserTenant[]>([])
  const [authChecked, setAuthChecked] = useState(false) // Track if we've checked auth at least once
  const navigate = useNavigate()

  // Customer Portal sessions are tracked in the `customers` table — they have no row in `users`.
  // Detect by synthetic email + user_metadata.role to skip the users-table lookup entirely.
  const isCustomerAuthUser = (u: SupabaseUser | null): boolean => {
    if (!u) return false
    if (u.user_metadata?.role === 'customer') return true
    if (typeof u.email === 'string' && /^customer\+/.test(u.email)) return true
    return false
  }

  // Fetch user profile from database (includes role and tenant_id)
  const fetchUserProfile = async (userId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('users') as any)
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  // Fetch user's tenants and roles (now from users table with tenant join)
  const fetchUserTenants = async (userId: string) => {
    try {
      console.log('[Auth] Fetching tenants for userId:', userId)

      // First get user data with role and tenant_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userData, error: userError } = await (supabase.from('users') as any)
        .select(`id, tenant_id, role, is_active`)
        .eq('id', userId)
        .eq('is_active', true)
        .single()

      console.log('[Auth] User data:', userData)
      console.log('[Auth] User error:', userError)

      if (userError || !userData) {
        console.error('Error fetching user:', userError)
        return []
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = userData as any

      // Then fetch tenant separately using RPC to bypass RLS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tenantData, error: tenantError } = await (supabase.from('tenants') as any)
        .select('*')
        .eq('id', u.tenant_id)
        .single()

      console.log('[Auth] Tenant data:', tenantData)
      console.log('[Auth] Tenant error:', tenantError)

      // Fetch company settings in parallel and cache the logo
      let logoUrlCached: string | null = null;
      let companyNameCached: string | null = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const td = tenantData as any
      if (td) {
        try {
          // Try to get from localStorage cache first (5 min cache)
          const cacheKey = `company_logo_${td.id}`;
          const cacheTimestamp = `company_logo_ts_${td.id}`;
          const cachedLogo = localStorage.getItem(cacheKey);
          const cachedTime = localStorage.getItem(cacheTimestamp);

          if (cachedLogo && cachedTime) {
            const age = Date.now() - parseInt(cachedTime);
            if (age < 5 * 60 * 1000) { // 5 minutes cache
              logoUrlCached = cachedLogo;
              const cachedName = localStorage.getItem(`company_name_${td.id}`);
              if (cachedName) companyNameCached = cachedName;
              console.log('[Auth] Using cached logo');
            }
          }

          // If no cached logo or expired, fetch from API
          if (!logoUrlCached) {
            const companySettings = await getCompanySettings(td.id);
            if (companySettings?.logo_url) {
              logoUrlCached = companySettings.logo_url;
              localStorage.setItem(cacheKey, companySettings.logo_url);
              localStorage.setItem(cacheTimestamp, Date.now().toString());
            }
            if (companySettings?.company_name) {
              companyNameCached = companySettings.company_name;
              localStorage.setItem(`company_name_${td.id}`, companySettings.company_name);
            }
          }
        } catch (err) {
          console.error('[Auth] Error fetching company settings:', err);
        }
      }

      // Transform to match expected format
      const transformed = [{
        id: u.id,
        user_id: u.id,
        tenant_id: u.tenant_id,
        role: u.role,
        is_active: u.is_active,
        tenants: td ? {
          ...td,
          logo_url_cached: logoUrlCached || undefined,
          company_name_cached: companyNameCached || undefined,
        } : null
      }]

      console.log('[Auth] Transformed tenants:', transformed)
      return transformed
    } catch (error) {
      console.error('Error fetching user tenants:', error)
      return []
    }
  }

  // Save role to cache for faster UI rendering
  const saveRoleToCache = (tenantId: string, role: string) => {
    try {
      localStorage.setItem('cached_tenant_id', tenantId)
      localStorage.setItem('cached_role', role)
      localStorage.setItem('cached_role_timestamp', Date.now().toString())
    } catch (error) {
      console.error('Error saving role to cache:', error)
    }
  }

  // Get role from cache (if recent - less than 1 hour old)
  const getRoleFromCache = (): { tenantId: string | null; role: string | null } | null => {
    try {
      const cachedTenantId = localStorage.getItem('cached_tenant_id')
      const cachedRole = localStorage.getItem('cached_role')
      const cachedTimestamp = localStorage.getItem('cached_role_timestamp')

      if (!cachedTenantId || !cachedRole || !cachedTimestamp) {
        return null
      }

      // Check if cache is recent (less than 1 hour)
      const age = Date.now() - parseInt(cachedTimestamp)
      if (age > 60 * 60 * 1000) { // 1 hour
        return null
      }

      return { tenantId: cachedTenantId, role: cachedRole }
    } catch (error) {
      console.error('Error getting role from cache:', error)
      return null
    }
  }

  // Initialize auth state
  const initializeAuth = async () => {
    console.log('[Auth] Starting initializeAuth...')

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[Auth] Session:', session?.user?.email || 'No session')

      setSession(session)

      if (session?.user) {
        setUser(session.user)

        // Try to use cached role first for faster UI rendering
        const cachedRole = getRoleFromCache()
        if (cachedRole) {
          console.log('[Auth] Using cached role:', cachedRole.role, 'for tenant:', cachedRole.tenantId)
          setUserRole(cachedRole.role as any)
          // Note: We can't set currentTenant without the full tenant object
          // but having the role immediately helps prevent UI flicker
        }

        // Customer Portal users don't have a row in `users` — skip those fetches.
        const skipStaffLookup = isCustomerAuthUser(session.user)

        // Fetch data in parallel for speed
        const [profile, tenants] = skipStaffLookup
          ? [null as any, [] as UserTenant[]]
          : await Promise.all([
              fetchUserProfile(session.user.id),
              fetchUserTenants(session.user.id)
            ])

        if (skipStaffLookup) {
          console.log('[Auth] Customer auth detected — skipping users-table lookup')
          setUserRole('customer')
        }
        console.log('[Auth] Profile:', profile?.email, 'Role:', profile?.role)
        console.log('[Auth] Tenants:', tenants.map(t => ({ email: profile?.email, tenant: t.tenants?.name, role: t.role })))

        if (profile) {
          setUserProfile(profile)
          // Check if password reset is required (password_set_at is null)
          setPasswordResetRequired(profile.password_set_at === null)
        }

        setUserTenants(tenants)

        // Set current tenant from localStorage or first one
        const savedTenantId = localStorage.getItem('current_tenant_id')
        const tenantToUse = savedTenantId
          ? tenants.find(t => t.tenant_id === savedTenantId)
          : tenants[0]

        if (tenantToUse) {
          console.log('[Auth] Current tenant:', tenantToUse.tenants?.name, 'Role:', tenantToUse.role)
          setCurrentTenant(tenantToUse.tenants)
          setUserRole(tenantToUse.role)

          // Check if tenant is suspended
          const isSuspended = tenantToUse.tenants?.status === 'suspended'
          setTenantSuspended(isSuspended)
          if (isSuspended) {
            console.log('[Auth] Tenant is suspended:', tenantToUse.tenants?.name)
          }

          localStorage.setItem('current_tenant_id', tenantToUse.tenant_id)
          // Save to cache for next time
          saveRoleToCache(tenantToUse.tenant_id, tenantToUse.role)
        } else if (savedTenantId && profile?.role === 'owner') {
          // Owner switched to a tenant outside their own membership — restore via RPC
          const { data: allTenants } = await supabase.rpc('get_all_tenants_for_owner')
          const found = ((allTenants as any[]) || []).find((t: any) => t.id === savedTenantId)
          if (found) {
            setCurrentTenant(found)
            setUserRole('owner')
            setTenantSuspended(found.status === 'suspended')
            saveRoleToCache(found.id, 'owner')
          }
        }
      }
    } catch (error) {
      console.error('[Auth] Error initializing auth:', error)
    } finally {
      console.log('[Auth] Setting loading to false, authChecked to true')
      setLoading(false)
      setAuthChecked(true)
    }
  }

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (user?.id) {
      const profile = await fetchUserProfile(user.id)
      if (profile) {
        setUserProfile(profile)
        // Update password reset required state
        setPasswordResetRequired(profile.password_set_at === null)
      }

      const tenants = await fetchUserTenants(user.id)
      setUserTenants(tenants)

      if (tenants.length > 0) {
        const savedTenantId = localStorage.getItem('current_tenant_id')
        const tenantToUse = savedTenantId
          ? tenants.find(t => t.tenant_id === savedTenantId)
          : tenants[0]

        if (tenantToUse) {
          setCurrentTenant(tenantToUse.tenants)
          setUserRole(tenantToUse.role)

          // Check if tenant is suspended
          const isSuspended = tenantToUse.tenants?.status === 'suspended'
          setTenantSuspended(isSuspended)
        }
      }
    }
  }, [user?.id])

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (!error && data.user) {
        // Check if user needs to reset password
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: userProfile } = await (supabase.from('users') as any)
          .select('password_set_at')
          .eq('id', data.user.id)
          .single()

        // Check if user has temporary password (password_set_at is null)
        const passwordResetRequired = (userProfile as any)?.password_set_at === null

        // User is signed in, auth state change will handle the rest
        return { error: null, data, passwordResetRequired }
      }

      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  // Sign up function
  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      })

      if (!error && data.user) {
        // Create tenant for new user
        const { data: tenantData, error: tenantError } = await supabase.rpc(
          'create_tenant_with_owner',
          {
            tenant_name: `${fullName}'s Company`,
            owner_email: email,
            owner_full_name: fullName
          }
        )

        if (tenantError) {
          console.error('Error creating tenant:', tenantError)
        } else {
          console.log('Tenant created successfully:', tenantData)
        }

        return { error: null, data }
      }

      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  // Sign out function
  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserProfile(null)
    setSession(null)
    setCurrentTenant(null)
    setUserRole(null)
    setTenantSuspended(false)
    setUserTenants([])
    localStorage.removeItem('current_tenant_id')
    // Clear cached role on sign out
    localStorage.removeItem('cached_tenant_id')
    localStorage.removeItem('cached_role')
    localStorage.removeItem('cached_role_timestamp')
    navigate('/auth/login')
  }

  // Reset password function
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })

      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  // Switch tenant function
  const switchTenant = async (tenantId: string) => {
    const tenant = userTenants.find(ut => ut.tenant_id === tenantId)
    if (!tenant) {
      console.error('Tenant not found')
      return
    }

    setCurrentTenant(tenant.tenants)
    setUserRole(tenant.role)

    // Check if tenant is suspended
    const isSuspended = tenant.tenants?.status === 'suspended'
    setTenantSuspended(isSuspended)

    localStorage.setItem('current_tenant_id', tenantId)
    // Save to cache for next time
    saveRoleToCache(tenantId, tenant.role)

    // Reload to apply new tenant context
    window.location.reload()
  }

  // Switch to any tenant as owner (bypasses userTenants membership check)
  const switchTenantAsOwner = (tenant: Tenant) => {
    setCurrentTenant(tenant)
    setUserRole('owner')
    setTenantSuspended(tenant.status === 'suspended')
    localStorage.setItem('current_tenant_id', tenant.id)
    saveRoleToCache(tenant.id, 'owner')
    window.location.reload()
  }

  // Listen for auth changes
  useEffect(() => {
    initializeAuth()

    // Safety timeout: force loading to false after 5 seconds
    const safetyTimeout = setTimeout(() => {
      console.log('[Auth] Safety timeout triggered, forcing loading to false')
      setLoading(false)
    }, 5000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] State changed:', event, session?.user?.email)

        setSession(session)

        if (session?.user) {
          // Set user IMMEDIATELY so dashboard can render
          setUser(session.user)

          // Try to use cached role first for faster UI rendering
          const cachedRole = getRoleFromCache()
          if (cachedRole) {
            console.log('[Auth] Using cached role:', cachedRole.role, 'for tenant:', cachedRole.tenantId)
            setUserRole(cachedRole.role as any)
          }

          // Customer Portal users don't exist in `users` — skip those fetches.
          if (isCustomerAuthUser(session.user)) {
            console.log('[Auth] Customer auth detected (background) — skipping users-table lookup')
            setUserRole('customer')
            return
          }

          // Fetch profile and tenants in background (non-blocking)
          Promise.all([
            fetchUserProfile(session.user.id),
            fetchUserTenants(session.user.id)
          ]).then(([profile, tenants]) => {
            if (profile) {
              setUserProfile(profile)
            }

            setUserTenants(tenants)

            // Set current tenant
            if (tenants.length > 0) {
              const savedTenantId = localStorage.getItem('current_tenant_id')
              const tenantToUse = savedTenantId
                ? tenants.find(t => t.tenant_id === savedTenantId)
                : tenants[0]

              if (tenantToUse) {
                setCurrentTenant(tenantToUse.tenants)
                setUserRole(tenantToUse.role)

                // Check if tenant is suspended
                const isSuspended = tenantToUse.tenants?.status === 'suspended'
                setTenantSuspended(isSuspended)

                localStorage.setItem('current_tenant_id', tenantToUse.tenant_id)
                // Save to cache for next time
                saveRoleToCache(tenantToUse.tenant_id, tenantToUse.role)
              } else if (savedTenantId && profile?.role === 'owner') {
                // Owner switched to a tenant outside their own membership — restore via RPC
                supabase.rpc('get_all_tenants_for_owner').then(({ data: allTenants }) => {
                  const found = ((allTenants as any[]) || []).find((t: any) => t.id === savedTenantId)
                  if (found) {
                    setCurrentTenant(found)
                    setUserRole('owner')
                    setTenantSuspended(found.status === 'suspended')
                    saveRoleToCache(found.id, 'owner')
                  }
                })
              }
            }
          }).catch(err => {
            console.error('[Auth] Error fetching user data:', err)
          })
        } else {
          // User signed out
          setUser(null)
          setUserProfile(null)
          setCurrentTenant(null)
          setUserRole(null)
          setTenantSuspended(false)
          setUserTenants([])
          localStorage.removeItem('current_tenant_id')
          // Clear cached role on sign out
          localStorage.removeItem('cached_tenant_id')
          localStorage.removeItem('cached_role')
          localStorage.removeItem('cached_role_timestamp')
        }

        setLoading(false)
        setAuthChecked(true)
      }
    )

    return () => {
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextType = {
    user,
    userProfile,
    session,
    loading,
    authChecked,
    currentTenant,
    userRole,
    tenantSuspended,
    passwordResetRequired,
    userTenants,
    signIn,
    signUp,
    signOut,
    resetPassword,
    switchTenant,
    switchTenantAsOwner,
    refreshUser
  }

  return (
    <AuthContextSimple.Provider value={value}>
      {children}
    </AuthContextSimple.Provider>
  )
}