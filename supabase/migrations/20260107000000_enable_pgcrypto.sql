-- Enable pgcrypto extension for gen_salt() and crypt() functions
-- This is required for password hashing in create_user_with_password function

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- Add comment
COMMENT ON EXTENSION pgcrypto IS 'Cryptographic functions for password hashing';
