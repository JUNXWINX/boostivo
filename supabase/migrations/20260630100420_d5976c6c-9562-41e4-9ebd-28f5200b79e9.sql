
REVOKE EXECUTE ON FUNCTION public.credit_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_deposit_memo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;
ALTER FUNCTION public.generate_deposit_memo() SET search_path = public;
