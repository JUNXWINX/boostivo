
-- Convert has_role to SECURITY INVOKER — callers always pass auth.uid(),
-- and the user_roles SELECT policy already allows a user to read their own rows.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Revoke EXECUTE on is_username_available — the availability check now runs
-- server-side via the admin client in the checkUsername server function.
REVOKE EXECUTE ON FUNCTION public.is_username_available(text) FROM PUBLIC, anon, authenticated;
