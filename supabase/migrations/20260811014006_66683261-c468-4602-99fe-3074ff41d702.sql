ALTER TABLE public.topup_requests
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS credited_ton numeric,
  ADD COLUMN IF NOT EXISTS credited_at timestamptz;

CREATE OR REPLACE FUNCTION public.tg_topup_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := 'RC-' || to_char(now(),'YYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 5));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS topup_reference_trg ON public.topup_requests;
CREATE TRIGGER topup_reference_trg
BEFORE INSERT ON public.topup_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_topup_reference();

UPDATE public.topup_requests
SET reference = 'RC-' || to_char(created_at,'YYMMDD') || '-' || upper(substring(replace(id::text,'-','') from 1 for 5))
WHERE reference IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS topup_requests_reference_key ON public.topup_requests(reference);