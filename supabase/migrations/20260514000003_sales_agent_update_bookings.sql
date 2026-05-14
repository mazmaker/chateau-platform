-- Sales / Agent need UPDATE on bookings so the "Cancel Reservation" flow in UnitDetail
-- can mark booking.status='cancelled' when Sales releases a unit hold.
--
-- Previous state: only Admin/Owner had UPDATE → Sales clicks cancel → RLS silently blocks
-- the bookings.update → customer keeps seeing "รอชำระมัดจำ" in their portal.
--
-- Scope: same-tenant staff only. RLS on units (we just tightened earlier) already prevents
-- a Sales from reaching a unit they aren't assigned to, so an UPDATE on bookings is only
-- reachable for units they legitimately work with.

DROP POLICY IF EXISTS "Sales can update bookings in tenant" ON public.bookings;
CREATE POLICY "Sales can update bookings in tenant" ON public.bookings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('sales', 'agent')
      AND tenant_id = public.bookings.tenant_id
  )
);
