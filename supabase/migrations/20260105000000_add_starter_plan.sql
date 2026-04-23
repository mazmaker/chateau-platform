-- Add 'free' and 'starter' to subscription_plan enum
-- This migration ensures all subscription plan options are available

-- The database might have either:
-- - ('free', 'professional', 'enterprise') - from auth_setup.sql
-- - ('starter', 'professional', 'enterprise') - from 20241219000000_initial_schema.sql
--
-- We need both 'free' and 'starter' available

-- Add 'free' value if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'free' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subscription_plan')) THEN
        ALTER TYPE subscription_plan ADD VALUE 'free';
    END IF;
END $$;

-- Add 'starter' value if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'starter' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subscription_plan')) THEN
        ALTER TYPE subscription_plan ADD VALUE 'starter';
    END IF;
END $$;

-- After this migration, the enum should have: ('free', 'starter', 'professional', 'enterprise')
-- Note: The actual order might vary based on when values were added
