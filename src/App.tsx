import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'

function App() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!user) {
    return <Login />
  }

  // Show dashboard if authenticated
  return <Dashboard user={user} onSignOut={signOut} />
}

export default App