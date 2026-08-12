-- 1. Profils : code de parrainage, parrain, gains
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_earnings_ton numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE c text;
BEGIN
  LOOP
    c := upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 7));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = c);
  END LOOP;
  RETURN c;
END $$;

UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE referral_code IS NULL;

ALTER TABLE public.profiles ALTER COLUMN referral_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles (referred_by);

-- 2. Création de compte : code + parrain depuis les métadonnées
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  base  text;
  attempt int := 0;
  ref_code text;
  ref_user uuid;
BEGIN
  base := coalesce(NULLIF(NEW.raw_user_meta_data->>'username',''), split_part(NEW.email,'@',1));
  base := regexp_replace(lower(base), '[^a-z0-9_]', '', 'g');
  IF length(base) < 3 THEN base := 'user' || substring(replace(NEW.id::text,'-','') from 1 for 6); END IF;
  uname := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) LOOP
    attempt := attempt + 1;
    uname := base || attempt::text;
  END LOOP;

  ref_code := upper(NULLIF(NEW.raw_user_meta_data->>'ref',''));
  IF ref_code IS NOT NULL THEN
    SELECT user_id INTO ref_user FROM public.profiles WHERE referral_code = ref_code;
  END IF;

  INSERT INTO public.profiles(user_id, username, deposit_memo, referral_code, referred_by)
  VALUES (NEW.id, uname, public.generate_deposit_memo(), public.generate_referral_code(), ref_user);
  RETURN NEW;
END $$;

-- 3. Protection des champs sensibles (ajout referral_earnings_ton / referred_by / referral_code)
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  IF NEW.referral_earnings_ton IS DISTINCT FROM OLD.referral_earnings_ton THEN
    RAISE EXCEPTION 'referral_earnings_ton cannot be modified directly';
  END IF;
  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'referral_code cannot be modified directly';
  END IF;
  IF NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    RAISE EXCEPTION 'referred_by cannot be modified directly';
  END IF;
  RETURN NEW;
END $$;

-- 4. Commissions de parrainage
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_amount_ton numeric NOT NULL,
  amount_ton numeric NOT NULL,
  percent numeric NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS referral_commissions_order_key ON public.referral_commissions (order_id);
CREATE INDEX IF NOT EXISTS referral_commissions_referrer_idx ON public.referral_commissions (referrer_id);

GRANT SELECT ON public.referral_commissions TO authenticated;
GRANT ALL ON public.referral_commissions TO service_role;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own commissions" ON public.referral_commissions
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);
CREATE POLICY "admin read commissions" ON public.referral_commissions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. Retraits
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference text,
  method text NOT NULL CHECK (method IN ('mobile_money','crypto')),
  amount_ton numeric NOT NULL CHECK (amount_ton > 0),
  amount_xof numeric,
  country text,
  operator text,
  phone text,
  holder_name text,
  crypto_asset text,
  crypto_address text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  admin_note text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS withdrawals_user_idx ON public.withdrawals (user_id);

GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own withdrawals" ON public.withdrawals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin read withdrawals" ON public.withdrawals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update withdrawals" ON public.withdrawals
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_withdrawal_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := 'WD-' || to_char(now(),'YYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 5));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS withdrawal_reference_trg ON public.withdrawals;
CREATE TRIGGER withdrawal_reference_trg BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.tg_withdrawal_reference();

DROP TRIGGER IF EXISTS withdrawals_updated_at ON public.withdrawals;
CREATE TRIGGER withdrawals_updated_at BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6. Fonctions de gestion des gains
CREATE OR REPLACE FUNCTION public.credit_referral(_user uuid, _amount numeric)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
     SET referral_earnings_ton = referral_earnings_ton + _amount,
         updated_at = now()
   WHERE user_id = _user;
$$;

CREATE OR REPLACE FUNCTION public.debit_referral(_user uuid, _amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated int;
BEGIN
  UPDATE public.profiles
     SET referral_earnings_ton = referral_earnings_ton - _amount,
         updated_at = now()
   WHERE user_id = _user AND referral_earnings_ton >= _amount;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END $$;

CREATE OR REPLACE FUNCTION public.transfer_referral_to_balance(_user uuid, _amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated int;
BEGIN
  UPDATE public.profiles
     SET referral_earnings_ton = referral_earnings_ton - _amount,
         balance_ton = balance_ton + _amount,
         updated_at = now()
   WHERE user_id = _user AND referral_earnings_ton >= _amount;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END $$;

REVOKE ALL ON FUNCTION public.credit_referral(uuid, numeric) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.debit_referral(uuid, numeric) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.transfer_referral_to_balance(uuid, numeric) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_referral_code() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_referral(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_referral(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_referral_to_balance(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO service_role;