#!/bin/bash

# Context7 Helper Script for CHATEAU Project
# This script helps manage project context for Claude Code

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTEXT_FILE="$PROJECT_ROOT/.claude/context.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create context file
create_context() {
    print_status "Creating context file..."

    cat > "$CONTEXT_FILE" << 'EOF'
# CHATEAU Project Context

## Project Overview
CHATEAU is a Prop Tech Intelligence platform - a multi-tenant SaaS solution for real estate management.

## Architecture
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **State Management**: TanStack Query
- **Testing**: Vitest + React Testing Library + Playwright
- **Multi-tenancy**: Row Level Security (RLS)

## Key Features
1. Dashboard with real-time statistics
2. Property management (units, projects, pricing)
3. Customer relationship management with AI scoring
4. Sales team management and performance tracking
5. Marketing campaign automation
6. Comprehensive audit logging

## Development Commands
```bash
# Development
npm run dev

# Testing
npm run test
npm run test:ui
npm run test:e2e

# Build
npm run build
npm run preview

# Supabase
supabase start
supabase db push
supabase gen types typescript --local > src/types/database.ts
```

## Important Files
- `specs/001-production-readiness/` - Implementation plan for production readiness
- `src/lib/supabase.ts` - Supabase client configuration
- `src/types/database.ts` - Generated TypeScript types
- `.specify/memory/constitution.md` - Project constitution and principles

## Current Status
- ✅ Prototype phase complete
- 🔄 Production readiness enhancement in progress
- 📋 Working on incremental deployment strategy
EOF

    print_status "Context file created at $CONTEXT_FILE"
}

# Update context with current git status
update_context() {
    print_status "Updating context with current git status..."

    if [ -d ".git" ]; then
        GIT_STATUS=$(git status --porcelain)
        GIT_BRANCH=$(git branch --show-current)
        GIT_COMMIT=$(git rev-parse --short HEAD)

        cat >> "$CONTEXT_FILE" << EOF

## Current Git Status
- **Branch**: $GIT_BRANCH
- **Commit**: $GIT_COMMIT
- **Status**:
\`\`\`
$GIT_STATUS
\`\`\`
EOF
        print_status "Context updated with git status"
    else
        print_warning "Not a git repository"
    fi
}

# Show context
show_context() {
    if [ -f "$CONTEXT_FILE" ]; then
        cat "$CONTEXT_FILE"
    else
        print_warning "Context file not found. Run 'create' first."
    fi
}

# Main script logic
case "${1:-}" in
    create)
        create_context
        ;;
    update)
        update_context
        ;;
    show)
        show_context
        ;;
    *)
        echo "Usage: $0 {create|update|show}"
        echo ""
        echo "Commands:"
        echo "  create  - Create initial context file"
        echo "  update  - Update context with current status"
        echo "  show    - Display current context"
        exit 1
        ;;
esac