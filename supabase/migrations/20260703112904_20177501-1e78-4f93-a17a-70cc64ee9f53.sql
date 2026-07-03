CREATE POLICY "public read rates" ON public.settings
FOR SELECT
TO anon, authenticated
USING (key IN ('xof_per_ton','usd_per_ton','usdt_per_ton','markup_percent'));

GRANT SELECT ON public.settings TO anon;