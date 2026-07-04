
-- === orders: lock down public reads and inserts ===
DROP POLICY IF EXISTS "public read orders" ON public.orders;
DROP POLICY IF EXISTS "public create orders" ON public.orders;

-- Only "users read own orders" (already present) remains for SELECT.
-- Revoke direct client INSERT — order creation must go through the createOrder server function.
REVOKE INSERT ON public.orders FROM anon, authenticated;

-- === user_roles: prevent privilege escalation ===
-- Explicitly deny INSERT/UPDATE/DELETE from clients. Only service_role (admin server code) can mutate.
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

CREATE POLICY "no client insert user_roles"
  ON public.user_roles FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY "no client update user_roles"
  ON public.user_roles FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "no client delete user_roles"
  ON public.user_roles FOR DELETE TO anon, authenticated
  USING (false);

-- === profiles: prevent client-side creation with attacker-chosen deposit_memo ===
REVOKE INSERT, DELETE ON public.profiles FROM anon, authenticated;

CREATE POLICY "no client insert profiles"
  ON public.profiles FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY "no client delete profiles"
  ON public.profiles FOR DELETE TO anon, authenticated
  USING (false);

-- Also prevent users from mutating their own deposit_memo/balance_ton via UPDATE
-- (they can still update preferred_currency etc. — but only if balance/memo unchanged).
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND balance_ton = (SELECT p.balance_ton FROM public.profiles p WHERE p.user_id = auth.uid())
    AND deposit_memo = (SELECT p.deposit_memo FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- === SECURITY DEFINER functions: revoke EXECUTE from clients where not needed ===
REVOKE EXECUTE ON FUNCTION public.debit_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_deposit_memo() FROM PUBLIC, anon, authenticated;
-- Keep has_role callable by authenticated (used in RLS policies).
-- Keep is_username_available callable (anon signup username picker).
