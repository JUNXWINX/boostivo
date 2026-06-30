
-- ============== profiles ==============
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  balance_ton numeric NOT NULL DEFAULT 0 CHECK (balance_ton >= 0),
  deposit_memo text NOT NULL UNIQUE,
  preferred_currency text NOT NULL DEFAULT 'XOF',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Username uniqueness check is exposed via a SECURITY DEFINER function below (no broad SELECT for everyone).

-- ============== deposits ==============
CREATE TABLE public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_ton numeric NOT NULL,
  tx_hash text NOT NULL UNIQUE,
  memo text NOT NULL,
  from_addr text,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own deposits" ON public.deposits FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============== orders: add user_id (nullable for legacy anon flow) ==============
-- already exists per current schema; ensure RLS lets users see their own
DROP POLICY IF EXISTS "users read own orders" ON public.orders;
CREATE POLICY "users read own orders" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

-- ============== settings: add USD rate ==============
INSERT INTO public.settings(key, value) VALUES ('usd_per_ton', '5.5')
ON CONFLICT (key) DO NOTHING;

-- ============== helpers ==============
-- Generate a short unique deposit memo
CREATE OR REPLACE FUNCTION public.generate_deposit_memo()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE m text;
BEGIN
  LOOP
    m := 'BV' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE deposit_memo = m);
  END LOOP;
  RETURN m;
END $$;

-- Auto-create profile on signup (uses metadata.username when present)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uname text;
  base  text;
  attempt int := 0;
BEGIN
  base := coalesce(NULLIF(NEW.raw_user_meta_data->>'username',''), split_part(NEW.email,'@',1));
  base := regexp_replace(lower(base), '[^a-z0-9_]', '', 'g');
  IF length(base) < 3 THEN base := 'user' || substring(replace(NEW.id::text,'-','') from 1 for 6); END IF;
  uname := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) LOOP
    attempt := attempt + 1;
    uname := base || attempt::text;
  END LOOP;
  INSERT INTO public.profiles(user_id, username, deposit_memo)
  VALUES (NEW.id, uname, public.generate_deposit_memo());
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Username availability (public)
CREATE OR REPLACE FUNCTION public.is_username_available(_username text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(_username));
$$;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

-- Debit balance atomically; returns true on success
CREATE OR REPLACE FUNCTION public.debit_balance(_user uuid, _amount numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated int;
BEGIN
  UPDATE public.profiles
     SET balance_ton = balance_ton - _amount,
         updated_at  = now()
   WHERE user_id = _user AND balance_ton >= _amount;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END $$;

-- Credit balance (used by cron processor)
CREATE OR REPLACE FUNCTION public.credit_balance(_user uuid, _amount numeric)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles
     SET balance_ton = balance_ton + _amount,
         updated_at  = now()
   WHERE user_id = _user;
$$;

-- update trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
