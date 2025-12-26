-- Create test user for mazmakerv2.sup@gmail.com
-- Email: mazmakerv2.sup@gmail.com
-- Password: aa112233

-- 1. First, create a tenant for the user
INSERT INTO tenants (name, slug, created_at)
VALUES ('MAZ Maker V2', 'maz-maker-v2', NOW())
ON CONFLICT (slug) DO NOTHING;

-- 2. Get the tenant ID (this will be used later)
DO $$
DECLARE
    tenant_id_val UUID;
    auth_user_id_val UUID;
BEGIN
    SELECT id INTO tenant_id_val FROM tenants WHERE slug = 'maz-maker-v2';

    -- 3. Create user record
    INSERT INTO users (email, full_name, created_at)
    VALUES ('mazmakerv2.sup@gmail.com', 'MAZ Maker V2', NOW())
    ON CONFLICT (email) DO NOTHING;

    -- 4. Get user ID from users table
    SELECT id INTO auth_user_id_val FROM users WHERE email = 'mazmakerv2.sup@gmail.com';

    -- 5. Create user-tenant relationship with OWNER role
    INSERT INTO user_tenants (user_id, tenant_id, role, is_active, created_at)
    VALUES (auth_user_id_val, tenant_id_val, 'owner', true, NOW())
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    RAISE NOTICE 'Created user for mazmakerv2.sup@gmail.com successfully';
END $$;