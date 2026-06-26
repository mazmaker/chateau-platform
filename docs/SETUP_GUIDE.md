# CHATEAU Platform - Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (already installed)
- npm or yarn (already installed)
- Git (already installed)

### Step 1: Create Supabase Project

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Sign up/login with your GitHub account

2. **Create New Project**
   - Click "New Project"
   - Select your organization
   - Project name: `chateau-platform`
   - Database password: Create a strong password
   - Region: Choose closest to your users
   - Click "Create new project"

3. **Get Project Credentials**
   - Wait for project to be ready (2-3 minutes)
   - Go to Settings → API
   - Copy the **Project URL** (looks like: https://xxxxxxxx.supabase.co)
   - Copy the **anon/public** key

4. **Update Environment Variables**
   - Open `.env.local` in your project root
   - Replace:
     ```env
     VITE_SUPABASE_URL=https://your-project-ref.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key-here
     ```
   - With your actual credentials

### Step 2: Apply Database Schema

Option 1: Using Supabase Dashboard (Recommended)
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the content from `supabase/migrations/20241219000000_initial_schema.sql`
3. Click "Run" to execute the schema

Option 2: Using Supabase CLI (requires Docker)
```bash
# Install Docker Desktop first, then:
./scripts/setup-supabase.sh
```

> ⚠️ **Schema vs data:** the migrations in `supabase/migrations/` recreate the database
> **structure only** — they do NOT include the demo/seed rows. That data lives in the
> live Supabase project, not in git. So a brand-new Supabase project will have **empty
> tables**, and data-driven pages (e.g. Insights, อันดับยอดขาย, dashboards) will render
> empty until you seed it.
> - To work with the existing data, point `.env` at the **same Supabase project** the
>   team already uses (ask a teammate for the URL + anon key — never share via git).
> - To start fresh, run the migrations above, then seed your own sample rows.

### Step 3: Start the Application

```bash
# Install dependencies (if not done)
npm install

# Start development server
npm run dev
```

The app will be available at: http://localhost:5173

### Step 4: Test Authentication

1. Open http://localhost:5173
2. Click "Create account"
3. Enter your email and password
4. Verify your email if prompted
5. You should see the dashboard after successful signup/login

### Step 5: AI-Assisted Development (Claude Code / MCP) — optional

Only needed if you want the same AI tooling the team uses (Supabase / Playwright /
Context7 / shadcn via Claude Code). The app runs fine without this.

```bash
# Copy the template, then fill in your own keys
cp .mcp.json.example .mcp.json
```

Edit `.mcp.json` and replace the placeholders:
- `CONTEXT7_API_KEY` → your Context7 key (https://context7.com)
- supabase `--access-token` → your Supabase **Personal Access Token** (Account → Access Tokens)
- supabase `--project-ref` → your project ref (the `xxxx` in `https://xxxx.supabase.co`)

> `.mcp.json` is gitignored (it holds live secrets) — never commit it. The Windows
> config uses `npx.cmd` for the supabase server; on macOS/Linux change it to `npx`.

## 📋 Next Steps

### Phase 1: Authentication ✅
- [x] Supabase project setup
- [x] Database schema
- [x] Authentication UI
- [x] Multi-tenant support

### Phase 2: Core Features (To Do)
1. **Property Management**
   - Property listing page
   - Add/Edit/Delete properties
   - Property details view
   - Image upload

2. **Customer Management**
   - Customer listing
   - Add/Edit/Delete customers
   - Customer profile view
   - Booking history

3. **Booking System**
   - Calendar view
   - Create new bookings
   - Booking status management
   - Check-in/Check-out

4. **Dashboard & Reports**
   - Occupancy rates
   - Revenue reports
   - Property performance
   - Customer analytics

### Phase 3: Advanced Features
- Payment integration (Stripe)
- Automated emails
- Mobile app
- API for integrations
- Advanced reporting

## 🛠️ Development Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Testing
npm run test         # Run tests
npm run test:ui      # Run tests with UI

# Database (with Supabase CLI)
supabase start       # Start local Supabase
supabase db push     # Push migrations
supabase gen types   # Generate TypeScript types
```

## 📁 Project Structure

```
chateau-platform/
├── src/
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React contexts (auth, etc.)
│   ├── lib/           # Supabase client and utilities
│   ├── pages/         # Page components
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Helper functions
├── supabase/
│   ├── migrations/    # Database migrations
│   └── functions/     # Supabase Edge Functions
├── scripts/           # Setup and utility scripts
└── public/           # Static assets
```

## 🔧 Configuration

### Environment Variables
All configuration is in `.env.local`:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
- `VITE_APP_NAME`: Application name
- `VITE_APP_URL`: Application URL

### Multi-Tenancy
The application supports multi-tenancy out of the box:
- Each tenant has isolated data
- Row Level Security (RLS) ensures data privacy
- Tenant switching support
- Role-based permissions

## 🐛 Troubleshooting

### Common Issues

1. **"Cannot connect to Supabase"**
   - Check your `.env.local` file
   - Ensure Supabase project is active
   - Verify network connection

2. **"Email verification required"**
   - Check your spam folder
   - Use the test user credentials
   - Disable auth verification in Supabase settings for development

3. **"Permission denied" errors**
   - Check RLS policies in Supabase
   - Ensure user is assigned to correct tenant
   - Verify user role

4. **Docker not running** (if using local Supabase)
   - Install and start Docker Desktop
   - Run: `docker info` to verify

### Getting Help

1. Check the console logs in browser
2. Review Supabase dashboard logs
3. Visit: https://github.com/supabase/supabase/issues
4. Check the documentation: https://supabase.com/docs

## 📚 Learn More

- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide)

## 🎉 You're Ready!

Your CHATEAU Platform is now set up with:
- ✅ Multi-tenant authentication
- ✅ Property management database
- ✅ Secure role-based access
- ✅ Beautiful UI components
- ✅ Production-ready architecture

Start building your property management empire! 🏰