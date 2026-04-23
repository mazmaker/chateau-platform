-- Add 'free' value to subscription_plan enum
-- This allows creating tenants with free trial plan

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'subscription_plan'::regtype
        AND enumlabel = 'free'
    ) THEN
        ALTER TYPE subscription_plan ADD VALUE 'free';
    END IF;
END $$;
