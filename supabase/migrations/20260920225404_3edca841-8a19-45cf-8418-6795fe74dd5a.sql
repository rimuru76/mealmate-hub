DROP POLICY IF EXISTS "restaurants read" ON public.restaurants;
CREATE POLICY "restaurants read" ON public.restaurants
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_member(id));

DELETE FROM public.restaurants WHERE name IN ('P1','P2','Probe Grill');
DELETE FROM public.support_tickets WHERE subject = 'probe';