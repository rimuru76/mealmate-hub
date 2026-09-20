
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_restaurant() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.member_role_for(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_manager(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_role_for(UUID, UUID) TO service_role;
