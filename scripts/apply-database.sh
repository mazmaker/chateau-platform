#!/bin/bash

# Database Schema Application Script
echo "Applying database schema to Supabase..."

cd "$(dirname "$0")/.."

# Check if supabase is linked
if ! supabase status --output=json 2>/dev/null | jq -r '.ProjectConfig | .projectRef' | grep -v "null"; then
  echo "Not linked to any Supabase project. Please run:"
  echo "  1. Create a project at https://supabase.com/dashboard"
  echo "  2. Run: supabase link --project-ref YOUR-PROJECT-ID"
  exit 1
fi

# Apply schema
echo "Applying database schema..."
supabase db push

# Generate TypeScript types
echo "Generating TypeScript types..."
supabase gen types typescript > src/types/database.ts

echo "✅ Database schema applied successfully!"