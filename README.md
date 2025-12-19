# CHATEAU Platform 🏰

A modern, multi-tenant property management SaaS application built with React, TypeScript, and Supabase.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (already installed)
- npm or yarn (already installed)
- A Supabase account

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