import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function SupabaseTest() {
  const { user, session, currentTenant } = useAuth()
  const [testResult, setTestResult] = useState<string>('')
  const [testing, setTesting] = useState(false)

  const testConnection = async () => {
    setTesting(true)
    setTestResult('Testing connection...')

    try {
      // Test basic connection
      const { data: tenantsData, error: tenantsError } = await supabase.from('tenants').select('count', { count: 'exact', head: true })

      if (tenantsError) {
        console.error('Tenants query error:', tenantsError)
        setTestResult(`❌ Connection error: ${tenantsError.message}`)
        return
      }

      // Test users table
      const { data: usersData, error: usersError } = await supabase.from('users').select('count', { count: 'exact', head: true })

      if (usersError) {
        console.error('Users query error:', usersError)
        setTestResult(`❌ Users table error: ${usersError.message}`)
        return
      }

      setTestResult(`✅ Connection successful! Found ${tenantsData?.[0]?.count || 0} tenants`)
    } catch (err: any) {
      console.error('Connection error:', err)
      setTestResult(`❌ Connection failed: ${err.message || 'Unknown error'}`)
    } finally {
      setTesting(false)
    }
  }

  // Check if environment variables are set
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const isConfigured = supabaseUrl && !supabaseUrl.includes('your-project') &&
                      supabaseKey && !supabaseKey.includes('your-anon-key')

  return (
    <div className="p-4 bg-gray-100 rounded-lg mb-4">
      <h3 className="text-lg font-semibold mb-2">Supabase Connection Status</h3>

      <div className="space-y-1 text-sm mb-3">
        <div className="flex items-center space-x-2">
          <span className={isConfigured ? 'text-green-600' : 'text-red-600'}>
            {isConfigured ? '✅' : '❌'}
          </span>
          <span>Environment variables</span>
        </div>

        <div className="flex items-center space-x-2">
          <span className={user ? 'text-green-600' : 'text-red-600'}>
            {user ? '✅' : '❌'}
          </span>
          <span>User authentication</span>
        </div>

        <div className="flex items-center space-x-2">
          <span className={currentTenant ? 'text-green-600' : 'text-red-600'}>
            {currentTenant ? '✅' : '❌'}
          </span>
          <span>Tenant context: {currentTenant ? currentTenant.name : 'Not set'}</span>
        </div>
      </div>

      {!isConfigured && (
        <div className="p-3 bg-yellow-100 border border-yellow-300 rounded text-sm mb-3">
          <p className="font-semibold text-yellow-800">⚠️ Setup Required</p>
          <p className="text-yellow-700">Please update your Supabase credentials in .env.local</p>
          <p className="text-xs text-yellow-600 mt-1">See SETUP_GUIDE.md for instructions</p>
        </div>
      )}

      <button
        onClick={testConnection}
        disabled={testing || !isConfigured}
        className={`mt-2 px-4 py-2 rounded text-white ${
          testing || !isConfigured
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {testing ? 'Testing...' : 'Test Database Connection'}
      </button>

      {testResult && (
        <div className={`mt-2 p-2 rounded text-sm ${
          testResult.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {testResult}
        </div>
      )}
    </div>
  )
}