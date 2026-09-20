
CREATE POLICY "assets read members" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('restaurant-assets','menu-images')
  AND public.is_member(((storage.foldername(name))[1])::uuid));

CREATE POLICY "assets insert managers" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('restaurant-assets','menu-images')
  AND public.is_manager(((storage.foldername(name))[1])::uuid));

CREATE POLICY "assets update managers" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('restaurant-assets','menu-images')
  AND public.is_manager(((storage.foldername(name))[1])::uuid))
WITH CHECK (bucket_id IN ('restaurant-assets','menu-images')
  AND public.is_manager(((storage.foldername(name))[1])::uuid));

CREATE POLICY "assets delete managers" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('restaurant-assets','menu-images')
  AND public.is_manager(((storage.foldername(name))[1])::uuid));
