import React, { useState } from 'react'
import { LoginForm } from '@/components/LoginForm'
import { RegisterForm } from '@/components/RegisterForm'
import { SupabaseTest } from '@/components/SupabaseTest'
import { ShadcnDemo } from '@/components/ShadcnDemo'
import { Button } from '@/components/ui/button'

export function Login() {
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [showDemo, setShowDemo] = useState(false)

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="absolute inset-0 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  CHATEAU
                </h1>
                <span className="text-sm text-gray-600 ml-2">Platform</span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">
                  Prop Tech Intelligence
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col justify-center px-4 py-12">
          <div className="w-full max-w-4xl mx-auto">
            {/* Demo Toggle */}
            <div className="mb-6 text-center">
              <Button
                variant={showDemo ? "default" : "outline"}
                onClick={() => setShowDemo(!showDemo)}
              >
                {showDemo ? "Hide shadcn/ui Demo" : "Show shadcn/ui Demo"}
              </Button>
            </div>

            {/* Supabase Test Section */}
            <div className="mb-12">
              <SupabaseTest />
            </div>

            {/* shadcn Demo Section */}
            {showDemo && (
              <div className="mb-12">
                <ShadcnDemo />
              </div>
            )}

            {/* Login/Register Forms */}
            {isLoginMode ? (
              <LoginForm onToggleMode={toggleMode} />
            ) : (
              <RegisterForm onToggleMode={toggleMode} />
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <div className="text-center text-sm text-gray-500">
              © 2025 CHATEAU Platform. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}