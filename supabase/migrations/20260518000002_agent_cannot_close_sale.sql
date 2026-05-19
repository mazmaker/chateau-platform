-- Agent role: can reserve assigned units but CANNOT mark them as sold.
--
-- Global broker pattern: closing a sale = SPA signature + ownership transfer registration,
-- which is the developer's in-house Sales/Admin domain - external agents have no legal
-- authority to do this.
--
-- This replaces the prior policy with a WITH CHECK clause that rejects any UPDATE which
-- would set units.status to 'sold'. Frontend already hides the "ปิดการขาย" button for
-- agents; this is the server-side guard so the rule holds even if a request bypasses UI.

DROP POLICY IF EXISTS "Agent can reserve assigned units" ON public.units;

CREATE POLICY "Agent can reserve assigned units" ON public.units FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.agent_unit_assignments aua
    JOIN public.users u ON u.id = auth.uid()
    WHERE aua.agent_user_id = auth.uid()
      AND aua.unit_id = units.id
      AND aua.revoked_at IS NULL
      AND u.role = 'agent'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agent_unit_assignments aua
    JOIN public.users u ON u.id = auth.uid()
    WHERE aua.agent_user_id = auth.uid()
      AND aua.unit_id = units.id
      AND aua.revoked_at IS NULL
      AND u.role = 'agent'
  )
  AND status <> 'sold'
);

COMMENT ON POLICY "Agent can reserve assigned units" ON public.units IS
  'Agent role can UPDATE only assigned units, AND cannot set status=sold. Closing a sale requires SPA + transfer authority, which is Sales/Admin/Owner only.';
