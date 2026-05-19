-- Agent UPDATE policy on units — closes the Quick Reserve gap.
--
-- Before this migration:
--   * Agent could SELECT units in agent_unit_assignments but had NO UPDATE policy
--   * Quick Reserve "จองยูนิตนี้" from Lead Detail silently failed for Agent role
--
-- This grants UPDATE narrowly: only units the Agent is explicitly assigned to sell.
-- Matches global broker pattern (Sansiri/AP authorized agents — can reserve but cannot
-- sign SPA). SPA signing remains Admin/Sales-only via separate workflow.

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
);

COMMENT ON POLICY "Agent can reserve assigned units" ON public.units IS
  'Allow Agent role to UPDATE only units listed in agent_unit_assignments (unit-level, not project-level). Required for Quick Reserve flow from Lead Detail.';
