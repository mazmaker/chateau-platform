import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/avatar'

// Mock user data for preview
const mockUser = {
  id: '1',
  email: 'demo@chateau.com',
  full_name: 'Demo User',
  is_active: true,
  avatar_url: null,
  created_at: '2025-01-19T00:00:00Z'
}

export function DashboardPreview() {
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'properties', label: 'Properties', icon: '🏢' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'bookings', label: 'Bookings', icon: '📅' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ]

  const handleSignOut = () => {
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />

      <div className="relative z-10 min-h-screen flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-background/80 backdrop-blur-sm">
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="p-6 border-b">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">C</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    CHATEAU
                  </h1>
                  <p className="text-xs text-muted-foreground">Platform</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t">
              <Card className="bg-card/50 border-0">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white">
                        D
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {mockUser.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {mockUser.email}
                      </p>
                      <Badge variant="default" className="mt-1">
                        Active
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="w-full mt-2"
                  >
                    Sign out
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-background/80 backdrop-blur-sm">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold capitalize">{activeTab}</h2>
                  <p className="text-sm text-muted-foreground">
                    Welcome back, {mockUser.full_name}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <Button variant="outline" size="sm">
                    Export
                  </Button>
                  <Button size="sm">
                    Add New
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
                      <div className="h-4 w-4 text-muted-foreground">🏢</div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">124</div>
                      <p className="text-xs text-muted-foreground">
                        +12% from last month
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
                      <div className="h-4 w-4 text-muted-foreground">👥</div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">1,284</div>
                      <p className="text-xs text-muted-foreground">
                        +8% from last month
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                      <div className="h-4 w-4 text-muted-foreground">📅</div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">57</div>
                      <p className="text-xs text-muted-foreground">
                        +15% from last month
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                      <div className="h-4 w-4 text-muted-foreground">💰</div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">₱2.4M</div>
                      <p className="text-xs text-muted-foreground">
                        +23% from last month
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>
                      Latest updates from your platform
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[1, 2, 3, 4, 5].map((item) => (
                        <div key={item} className="flex items-center space-x-4">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>U{item}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium">
                              New booking request for Property #A{100 + item}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item} hour{item === 1 ? '' : 's'} ago
                            </p>
                          </div>
                          <Badge variant="outline">New</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>
                      Common tasks you might want to perform
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Button variant="outline" className="h-20 flex flex-col">
                        <span className="text-2xl mb-2">➕</span>
                        <span className="text-sm">Add Property</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col">
                        <span className="text-2xl mb-2">👤</span>
                        <span className="text-sm">Add Customer</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col">
                        <span className="text-2xl mb-2">📊</span>
                        <span className="text-sm">View Reports</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col">
                        <span className="text-2xl mb-2">⚙️</span>
                        <span className="text-sm">Settings</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Other Tabs */}
            {activeTab !== 'overview' && (
              <Card>
                <CardHeader>
                  <CardTitle className="capitalize">{activeTab}</CardTitle>
                  <CardDescription>
                    Manage your {activeTab.toLowerCase()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">
                      {tabs.find(t => t.id === activeTab)?.icon}
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {activeTab} Features
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      This section is under development
                    </p>
                    <Button>Coming Soon</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}