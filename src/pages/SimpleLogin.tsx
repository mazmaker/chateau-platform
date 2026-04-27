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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">กำลังตรวจสอบสถานะ...</p>
        </div>
      </div>
    )
  }

  // Show login form if not logged in
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl mx-auto">
        <LoginFormSimple />
      </div>
    </div>
  )
}