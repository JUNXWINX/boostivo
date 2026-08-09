-- 1. Margins
CREATE TABLE public.margins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  kind text NOT NULL DEFAULT 'all',
  percent numeric NOT NULL DEFAULT 75,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, kind)
);
GRANT SELECT ON public.margins TO anon, authenticated;
GRANT ALL ON public.margins TO service_role;
ALTER TABLE public.margins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read margins" ON public.margins FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manage margins" ON public.margins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER margins_updated_at BEFORE UPDATE ON public.margins
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.margins (platform, kind, percent) VALUES
  ('YouTube','subscribers',30),('YouTube','other',50),
  ('Telegram','members',100),('Telegram','other',200),
  ('TikTok','subscribers',75),('TikTok','likes',75),('TikTok','other',150),
  ('Instagram','subscribers',75),('Instagram','likes',75),('Instagram','views',500),('Instagram','other',150),
  ('Facebook','all',100),
  ('WhatsApp','all',75),
  ('Autre','all',75);

-- 2. Mobile Money top-up requests
CREATE TABLE public.topup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country text NOT NULL,
  operator text NOT NULL,
  phone text NOT NULL,
  amount_xof numeric NOT NULL CHECK (amount_xof >= 100),
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.topup_requests TO authenticated;
GRANT ALL ON public.topup_requests TO service_role;
ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own topups" ON public.topup_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "users create own topups" ON public.topup_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "admin read topups" ON public.topup_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update topups" ON public.topup_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER topup_requests_updated_at BEFORE UPDATE ON public.topup_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_topup_requests_user ON public.topup_requests (user_id, created_at DESC);
CREATE INDEX idx_topup_requests_status ON public.topup_requests (status, created_at DESC);

-- 3. Memo format BOOST-XXXXXX
CREATE OR REPLACE FUNCTION public.generate_deposit_memo()
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE m text;
BEGIN
  LOOP
    m := 'BOOST-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE deposit_memo = m);
  END LOOP;
  RETURN m;
END $function$;

-- 4. Currencies limited to XOF / USD
UPDATE public.profiles SET preferred_currency = 'XOF' WHERE preferred_currency NOT IN ('XOF','USD');

-- 5. Manual provider mode
INSERT INTO public.settings (key, value) VALUES ('auto_send_orders','false')
ON CONFLICT (key) DO NOTHING;