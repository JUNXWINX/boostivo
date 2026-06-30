
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Settings (admin only)
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read settings" ON public.settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin write settings" ON public.settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.settings (key, value) VALUES
  ('markup_percent', '30'),
  ('ton_price_usd', '5.5')
ON CONFLICT (key) DO NOTHING;

-- Services
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  platform TEXT,
  type TEXT,
  rate_per_1k NUMERIC NOT NULL DEFAULT 0,    -- provider USD per 1000
  rate_per_1k_ton NUMERIC NOT NULL DEFAULT 0,-- with markup, in TON
  min_qty INTEGER NOT NULL DEFAULT 1,
  max_qty INTEGER NOT NULL DEFAULT 1000000,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active services" ON public.services FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "admin manage services" ON public.services FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX services_platform_idx ON public.services(platform) WHERE active;

-- Orders
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'sent', 'completed', 'failed', 'cancelled');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code TEXT NOT NULL UNIQUE,
  memo TEXT NOT NULL UNIQUE,
  service_id UUID NOT NULL REFERENCES public.services(id),
  link TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  amount_ton NUMERIC NOT NULL CHECK (amount_ton > 0),
  status public.order_status NOT NULL DEFAULT 'pending',
  provider_order_id TEXT,
  provider_response JSONB,
  tx_hash TEXT,
  tx_amount_ton NUMERIC,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.orders TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- public can lookup by public_code (we filter in code)
CREATE POLICY "public read orders" ON public.orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public create orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending' AND provider_order_id IS NULL AND tx_hash IS NULL);
CREATE POLICY "admin update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_memo_idx ON public.orders(memo);
CREATE INDEX orders_created_idx ON public.orders(created_at DESC);

-- TON transactions (dedup)
CREATE TABLE public.ton_txs (
  hash TEXT PRIMARY KEY,
  memo TEXT,
  amount_ton NUMERIC NOT NULL,
  from_addr TEXT,
  lt TEXT,
  matched_order_id UUID REFERENCES public.orders(id),
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ton_txs TO authenticated;
GRANT ALL ON public.ton_txs TO service_role;
ALTER TABLE public.ton_txs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read ton_txs" ON public.ton_txs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
