import React, { useState } from 'react'
import { Database } from '@/lib/supabase'

interface DashboardProps {
  user: Database['public']['Tables']['users']['Row']
  onSignOut: () => void
}

export function Dashboard({ user, onSignOut }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')

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

              {/* User Menu */}
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.full_name || user.email}</p>
                  <p className="text-xs text-gray-500">
                    {user.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <button
                  onClick={onSignOut}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="-mb-px flex space-x-8">
              {['overview', 'properties', 'customers', 'reports', 'settings'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } capitalize`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {activeTab === 'overview' && (
              <div className="px-4 py-6 sm:px-0">
                <div className="border-4 border-dashed border-gray-200 rounded-lg p-8 text-center">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    Dashboard Overview
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Welcome back, {user.full_name || user.email}!
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                    <div className="bg-white p-6 rounded-lg shadow">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 bg-blue-100 rounded-full">
                          <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002 2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v2zm9-4a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2v-6a2 2 0 012-2h2a2 2 0 012 2z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <h3 className="text-lg font-medium text-gray-900">Total Properties</h3>
                          <p className="text-2xl font-bold text-blue-600">0</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 bg-green-100 rounded-full">
                          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2a3 3 0 00-5.356-1.857" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <h3 className="text-lg font-medium text-gray-900">Total Customers</h3>
                          <p className="text-2xl font-bold text-green-600">0</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 bg-yellow-100 rounded-full">
                          <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 3s.343 3 3 3 .895 3 3-.895 3-3-3-3-3 .895-3-3zm8 0c-1.657 0-3 .895-3 3s.343 3 3 3 .895 3 3-.895 3-3-3-3-3 .895-3-3zM4.5 4.5c-1.657 0-3 .895-3 3s.343 3 3 3 .895 3 3-.895 3-3-3-3-3 .895-3-3z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <h3 className="text-lg font-medium text-gray-900">Active Bookings</h3>
                          <p className="text-2xl font-bold text-yellow-600">0</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 text-sm text-gray-600">
                    <p>Get started by adding properties, customers, and bookings!</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'properties' && (
              <div className="px-4 py-6 sm:px-0">
                <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    Properties
                  </h2>
                  <p className="text-gray-600">Properties management coming soon...</p>
                </div>
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="px-4 py-6 sm:px-0">
                <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    Customers
                  </h2>
                  <p className="text-gray-600">Customer management coming soon...</p>
                </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="px-4 py-6 sm:px-0">
                <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    Reports
                  </h2>
                  <p className="text-gray-600">Reports and analytics coming soon...</p>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="px-4 py-6 sm:px-0">
                <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    Settings
                  </h2>
                  <p className="text-gray-600">Settings and configuration coming soon...</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}