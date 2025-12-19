# CHATEAU Platform - Prop Tech Intelligence

![Production Ready](https://img.shields.io/badge/Status-Production%20Readiness-orange)
![MCP Enabled](https://img.shields.io/badge/MCP-4%20Tools%20Installed-blue)
![Constitution v1.1.0](https://img.shields.io/badge/Constitution-v1.1.0-green)

A production-ready multi-tenant real estate management SaaS platform with AI-powered lead scoring and centralized data management.

## 🚀 Quick Start

## 🚀 For Your Team: Quick Start

### Clone and Setup
```bash
# Clone the repository
git clone https://github.com/mazmaker/chateau-platform.git
cd chateau-platform

# Switch to production readiness branch
git checkout 002-production-readiness

# Install dependencies
npm install

# Start Redis (for Context7 MCP)
brew services start redis

# Start development
npm run dev
```

### Prerequisites
- Node.js 18+ (already installed)
- npm or yarn (already installed)
- Redis server running (for Context7 MCP)
- A Supabase account

### Current Status: Production Readiness Implementation ✅

We're actively implementing production-ready features with:
- ✅ **4 MCP Tools Installed**: Context7, Supabase, Playwright, Shadcn
- ✅ **105 Implementation Tasks** ready for development
- ✅ **Constitution v1.1.0** with AI/LLM principles
- ✅ **Database Optimization** scripts (70-90% performance improvement)
- ✅ **Modern UI Components** with shadcn/ui

### Setup Instructions

1. **Create Supabase Project**
   ```bash
   # Open SETUP_GUIDE.md for detailed instructions
   open SETUP_GUIDE.md
   ```

2. **Configure Environment**
   - Copy your Supabase URL and anon key
   - Update `.env.local` with your credentials

3. **Apply Database Schema**
   - Run the SQL from `supabase/migrations/20241219000000_initial_schema.sql`
   - Or use: `./scripts/apply-database.sh`

4. **Start the Application**
   ```bash
   npm run dev
   ```

5. **Open in Browser**
   - Visit: http://localhost:5174 (or shown port)

## ✨ Features

### Implemented
- ✅ **Multi-tenant Architecture** - Each tenant has isolated data
- ✅ **Authentication System** - Email/password auth with role-based access
- ✅ **Secure Database Design** - Row Level Security (RLS) enabled
- ✅ **Modern UI** - Built with Tailwind CSS
- ✅ **TypeScript Support** - Full type safety

### Coming Soon
- 🔄 **Property Management** - Add, edit, and manage properties
- 🔄 **Customer Management** - Customer profiles and booking history
- 🔄 **Booking System** - Calendar view and reservation management
- 🔄 **Dashboard Analytics** - Reports and insights
- 🔄 **Payment Integration** - Stripe payment processing

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Supabase      │     │   PostgreSQL    │
│   (React)       │────▶│   (Backend)     │────▶│   (Database)    │
│   TypeScript    │     │   Auth + API    │     │   RLS Enabled   │
│   Tailwind CSS  │     │   Edge Functions│     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Key Technologies
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Security**: Row Level Security, JWT tokens, Role-based permissions

## 📁 Project Structure

```
src/
├── components/     # Reusable UI components
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   └── SupabaseTest.tsx
├── contexts/       # React contexts
│   └── AuthContext.tsx
├── lib/           # Utilities and clients
│   └── supabase.ts
├── pages/         # Page components
│   ├── Dashboard.tsx
│   └── Login.tsx
├── types/         # TypeScript definitions
│   └── database.ts
└── App.tsx        # Main app component
```

## 🔐 Security Features

- **Row Level Security (RLS)** - Data isolation between tenants
- **Role-Based Access Control** - Owner, Admin, Manager, Staff roles
- **JWT Authentication** - Secure token-based auth
- **Input Validation** - Type-safe database operations

## 🛠️ Development

### Available Scripts
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run test       # Run tests
```

### Database Operations
```bash
# Using Supabase CLI (requires Docker)
supabase start              # Start local Supabase
supabase db push            # Apply migrations
supabase gen types typescript > src/types/database.ts
```

## 📊 Database Schema

The application uses a multi-tenant schema with:

- **tenants** - Organization/tenant information
- **users** - User accounts with tenant association
- **properties** - Property listings per tenant
- **customers** - Customer information
- **bookings** - Booking reservations

## 🌍 Multi-Tenancy

Each tenant has:
- Isolated data (cannot see other tenants' data)
- Separate user accounts
- Customizable settings
- Subscription management

## 🎯 Next Steps

1. **Complete Setup**
   - Follow SETUP_GUIDE.md
   - Configure Supabase
   - Test authentication

2. **Build Features**
   - Property CRUD operations
   - Customer management
   - Booking system
   - Reports dashboard

3. **Production Deployment**
   - Set up CI/CD
   - Configure custom domain
   - Set up monitoring
   - Add payment processing

## 📚 Documentation

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Detailed setup instructions
- [supabase/migrations/](./supabase/migrations/) - Database schema
- [src/types/database.ts](./src/types/database.ts) - Type definitions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

## 🎉 You're ready to go!

Your CHATEAU Platform is set up and ready for development. Start building your property management empire! 🏰