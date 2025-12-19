#!/bin/bash

# Supabase Setup Script for CHATEAU Platform
# This script guides you through setting up Supabase connection

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}  CHATEAU Platform - Supabase Setup${NC}"
    echo -e "${GREEN}========================================${NC}\n"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        echo ""
        echo "Please install Docker Desktop first:"
        echo "  1. Download from: https://www.docker.com/products/docker-desktop/"
        echo "  2. Install and start Docker Desktop"
        echo "  3. Run this script again"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker is not running"
        echo ""
        echo "Please start Docker Desktop and run this script again"
        exit 1
    fi

    print_status "Docker is installed and running ✓"
}

# Option 1: Local Development Setup
setup_local() {
    print_status "Setting up local Supabase instance..."

    cd "$(dirname "$0")/.."

    # Start Supabase
    print_status "Starting Supabase local services..."
    supabase start

    # Get the connection details
    print_status "Getting connection details..."

    # Generate .env.local file with actual values
    cat > .env.local << EOF
# Supabase Configuration - Local Development
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}')
VITE_SUPABASE_SERVICE_ROLE_KEY=$(supabase status | grep "service_role key" | awk '{print $3}')

# Application Configuration
VITE_APP_NAME=CHATEAU Platform
VITE_APP_VERSION=1.0.0
VITE_APP_URL=http://localhost:5173
EOF

    print_status "Environment variables configured ✓"

    # Generate TypeScript types
    print_status "Generating TypeScript types..."
    supabase gen types typescript --local > src/types/database.ts

    print_status "Applying database schema..."
    supabase db push

    print_status "Local Supabase setup complete! ✓"
    echo ""
    echo "Local services running at:"
    echo "  • API URL: http://127.0.0.1:54321"
    echo "  • DB URL: postgresql://postgres:postgres@localhost:54322/postgres"
    echo "  • Studio: http://127.0.0.1:54323"
    echo ""
}

# Option 2: Cloud Project Setup
setup_cloud() {
    print_status "Setting up connection to Supabase Cloud project..."

    echo ""
    echo "Please follow these steps:"
    echo ""
    echo "1. Go to https://supabase.com/dashboard"
    echo "2. Create a new project or select existing one"
    echo "3. Go to Project Settings > API"
    echo "4. Copy the Project URL and anon key"
    echo ""

    read -p "Enter your Project URL: " project_url
    read -p "Enter your Anon Key: " anon_key

    if [ -z "$project_url" ] || [ -z "$anon_key" ]; then
        print_error "Both Project URL and Anon Key are required"
        exit 1
    fi

    # Update .env.local with cloud values
    cd "$(dirname "$0")/.."

    cat > .env.local << EOF
# Supabase Configuration - Cloud Project
VITE_SUPABASE_URL=$project_url
VITE_SUPABASE_ANON_KEY=$anon_key

# Application Configuration
VITE_APP_NAME=CHATEAU Platform
VITE_APP_VERSION=1.0.0
VITE_APP_URL=http://localhost:5173
EOF

    print_status "Environment variables configured ✓"

    # Link to remote project
    print_status "Linking to remote Supabase project..."
    supabase link --project-ref $(echo $project_url | sed 's|https://||g' | sed 's|\.supabase\.co||')

    # Generate TypeScript types from remote
    print_status "Generating TypeScript types from remote schema..."
    supabase gen types typescript > src/types/database.ts

    print_status "Cloud project setup complete! ✓"
    echo ""
    echo "Connected to Supabase Cloud:"
    echo "  • Project: $project_url"
    echo ""
}

# Main menu
main() {
    print_header

    check_docker

    echo "Choose your Supabase setup option:"
    echo ""
    echo "1) Local Development (Recommended for development)"
    echo "2) Connect to Cloud Project"
    echo "3) Exit"
    echo ""

    read -p "Enter your choice (1-3): " choice

    case $choice in
        1)
            setup_local
            ;;
        2)
            setup_cloud
            ;;
        3)
            print_status "Exiting setup..."
            exit 0
            ;;
        *)
            print_error "Invalid choice. Please enter 1, 2, or 3"
            exit 1
            ;;
    esac

    echo ""
    print_status "Next steps:"
    echo "1. Run: npm run dev"
    echo "2. Open: http://localhost:5173"
    echo "3. Your app will connect to Supabase automatically!"
}

# Run main function
main "$@"