
-- 1) services: add avg_time + remarks
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS avg_time text,
  ADD COLUMN IF NOT EXISTS remarks text;

-- 2) deposits: asset column (TON | USDT)
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS asset text NOT NULL DEFAULT 'TON';

-- 3) settings: usdt_per_ton
INSERT INTO public.settings (key, value) VALUES ('usdt_per_ton', '5.5')
  ON CONFLICT (key) DO NOTHING;

-- 4) markup 110% (×2.1)
UPDATE public.settings SET value = '110', updated_at = now() WHERE key = 'markup_percent';

-- 5) memo prefix BO
CREATE OR REPLACE FUNCTION public.generate_deposit_memo()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE m text;
BEGIN
  LOOP
    m := 'BO' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE deposit_memo = m);
  END LOOP;
  RETURN m;
END $function$;
