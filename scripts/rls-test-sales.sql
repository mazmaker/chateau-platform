-- Real RLS test: switch to authenticated role inside transaction so RLS applies
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '000bdcf2-bf20-4a15-aa8d-a53ba87313b0', 'role', 'authenticated')::text, true);

-- Test 1: try update designated unit (12/143) → expect 1 row
WITH t AS (
  UPDATE units SET notes = COALESCE(notes,'')
  WHERE id = 'bf91533d-c286-4101-a8e6-0de3b92821e9'
  RETURNING id
)
SELECT 'designated' AS test, COUNT(*) AS updated FROM t;

-- Test 2: try update non-designated unit (34/171) → expect 0 rows (RLS blocked)
WITH t AS (
  UPDATE units SET notes = COALESCE(notes,'')
  WHERE id = 'af336d9c-3493-4086-9756-9ce2166a626c'
  RETURNING id
)
SELECT 'not_designated' AS test, COUNT(*) AS updated FROM t;

ROLLBACK;
