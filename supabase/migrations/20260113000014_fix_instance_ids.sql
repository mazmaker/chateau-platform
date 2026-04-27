-- Fix instance_id for auth users that have null
UPDATE auth.users
SET instance_id = '00000000-0000-0000-0000-000000000000'
WHERE instance_id IS NULL;

SELECT json_build_object('success', true, 'message', 'Fixed instance_ids');
