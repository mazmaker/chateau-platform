import React from 'react'
import LoginForm from '@/components/auth/LoginForm'

export function Login() {
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
            {/* Login Form */}
            <LoginForm />
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