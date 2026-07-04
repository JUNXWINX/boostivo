
-- 1) Fix orders SELECT policy: remove OR user_id IS NULL to stop guest-order leakage / realtime broadcast
DROP POLICY IF EXISTS "users read own orders" ON public.orders;
CREATE POLICY "users read own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2) Restrict has_role RPC exposure: remove anon execute, keep authenticated + service_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 3) Defense-in-depth trigger: prevent any UPDATE (from any non-service_role path) from changing
--    balance_ton or deposit_memo on profiles. The credit/debit SECURITY DEFINER functions and
--    service_role writes remain unaffected.
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.balance_ton IS DISTINCT FROM OLD.balance_ton THEN
    RAISE EXCEPTION 'balance_ton cannot be modified directly';
  END IF;
  IF NEW.deposit_memo IS DISTINCT FROM OLD.deposit_memo THEN
    RAISE EXCEPTION 'deposit_memo cannot be modified directly';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_profile_sensitive_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_fields_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();
