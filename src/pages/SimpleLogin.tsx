import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSimpleAuth } from '@/contexts/AuthContextSimple'
import LoginFormSimple from '@/components/auth/LoginFormSimple'

export function SimpleLogin() {
  const { user, loading } = useSimpleAuth()
  const navigate = useNavigate()

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      navigate('/')
    }
  }, [user, loading, navigate])

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">กำลังตรวจสอบสถานะ...</p>
        </div>
      </div>
    )
  }

  // Show login form if not logged in
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl mx-auto">
        <LoginFormSimple />
      </div>
    </div>
  )
}