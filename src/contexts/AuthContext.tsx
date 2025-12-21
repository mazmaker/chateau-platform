import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode
} from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'

type UserWithTenants = Database['public']['Tables']['users']['Row'] & {
  user_tenants?: (Database['public']['Tables']['user_tenants']['Row'] & {
    tenants: Database['public']['Tables']['tenants']['Row']
  })[]
}

interface AuthContextType {
  user: UserWithTenants | null
  session: Session | null
  loading: boolean
  currentTenant: Database['public']['Tables']['tenants']['Row'] | null
  userRole: string | null
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, metadata?: object) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  switchTenant: (tenantId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithTenants | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTenant, setCurrentTenant] = useState<Database['public']['Tables']['tenants']['Row'] | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userTenants, setUserTenants] = useState<any[]>([])

  // Fetch user's tenants and roles
  const fetchUserTenants = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_tenants')
        .select(`
          *,
          tenants (*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) throw error

      setUserTenants(data || [])

      // Set first tenant as current if none selected
      if (data && data.length > 0 && !currentTenant) {
        const firstTenant = data[0].tenants
        setCurrentTenant(firstTenant)
        setUserRole(data[0].role)

        // Store in localStorage for persistence
        localStorage.setItem('current_tenant_id', firstTenant.id)
      }
    } catch (error) {
      console.error('Error fetching user tenants:', error)
      // Continue without tenants - for demo mode
    }
  }

  useEffect(() => {
    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.log('Auth loading timeout - setting loading to false')
        setLoading(false)
      }
    }, 5000) // 5 second timeout

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        setSession(session)

        if (session?.user) {
          // Fetch user profile with tenants
          try {
            const { data: profile } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single()

            if (profile) {
              setUser(profile)
              await fetchUserTenants(session.user.id)

              // Check for saved tenant preference
              const savedTenantId = localStorage.getItem('current_tenant_id')
              if (savedTenantId) {
                const savedTenant = userTenants.find(ut => ut.tenant_id === savedTenantId)
                if (savedTenant) {
                  setCurrentTenant(savedTenant.tenants)
                  setUserRole(savedTenant.role)
                }
              }
            }
          } catch (profileError) {
            console.error('Error fetching user profile:', profileError)
            // Continue without user profile
          }
        }
      } catch (error) {
        console.error('Error getting initial session:', error)
        // Continue without session - for demo mode
      } finally {
        setLoading(false)
        clearTimeout(loadingTimeout)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session)

        setSession(session)

        if (session?.user) {
          // Fetch user profile
          try {
            const { data: profile } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single()

            if (profile) {
              setUser(profile)
              await fetchUserTenants(session.user.id)
            }
          } catch (profileError) {
            console.error('Error fetching user profile on auth change:', profileError)
            // Continue without user profile
          }
        } else {
          // User signed out
          setUser(null)
          setCurrentTenant(null)
          setUserRole(null)
          setUserTenants([])
          localStorage.removeItem('current_tenant_id')
        }

        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
      clearTimeout(loadingTimeout)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  const signUp = async (email: string, password: string, metadata: object = {}) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })

      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

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

  const switchTenant = async (tenantId: string) => {
    const tenant = userTenants.find(ut => ut.tenant_id === tenantId)
    if (!tenant) {
      console.error('Tenant not found')
      return
    }

    setCurrentTenant(tenant.tenants)
    setUserRole(tenant.role)
    localStorage.setItem('current_tenant_id', tenantId)

    // You might want to reload the page or update the UI
    window.location.reload()
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    currentTenant,
    userRole,
    userTenants,
    signIn,
    signUp,
    signOut,
    resetPassword,
    switchTenant
  }

  return (
    <AuthContext.Provider value={value}>
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

// Helper hook to check if user has specific role
export const useRole = (requiredRole: string) => {
  const { userRole } = useAuth()
  return userRole === requiredRole
}

// Helper hook to check permissions
export const usePermission = (permission: string) => {
  const { currentTenant, userRole } = useAuth()

  // Define permissions based on roles
  const permissions: Record<string, string[]> = {
    owner: ['read', 'write', 'delete', 'manage_users', 'manage_settings'],
    admin: ['read', 'write', 'delete', 'manage_users'],
    sales: ['read', 'write', 'manage_customers', 'manage_bookings'],
    viewer: ['read']
  }

  return permissions[userRole || '']?.includes(permission) || false
}