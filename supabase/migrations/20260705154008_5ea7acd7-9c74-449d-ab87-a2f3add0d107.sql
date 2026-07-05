
-- Revoke EXECUTE on privileged SECURITY DEFINER helpers from anon and authenticated.
-- These are called only by triggers or trusted server code (service_role).
REVOKE EXECUTE ON FUNCTION public.credit_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_sensitive_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_deposit_memo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.credit_balance(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_balance(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_sensitive_fields() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_deposit_memo() TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_set_updated_at() TO service_role;

-- is_username_available is intentionally callable by anon (signup form) — keep as-is,
-- but ensure it is not granted to PUBLIC beyond that.
REVOKE EXECUTE ON FUNCTION public.is_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated, service_role;

-- has_role must remain callable by authenticated (used inside RLS policies as invoker).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
