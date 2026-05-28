-- Customer accounts are created at phone-login time, BEFORE they engage with any
-- company's units. tenant_id is assigned the moment they first express interest
-- (the unit they pick determines the tenant). Until then the customer is tenant-less,
-- so tenant_id must be nullable. Existing RLS already scopes customer self-access by
-- auth_user_id (not tenant_id), and Owner sees all, so this is safe.
ALTER TABLE public.customers ALTER COLUMN tenant_id DROP NOT NULL;
