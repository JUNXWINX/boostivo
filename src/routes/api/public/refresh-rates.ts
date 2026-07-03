import { createFileRoute } from "@tanstack/react-router";

/**
 * Refreshes TON price rates every 30 seconds via pg_cron.
 * Fetches from CoinGecko (public, no API key required).
 * Updates settings.xof_per_ton, usd_per_ton, usdt_per_ton.
 */
async function refresh(): Promise<Response> {
  try {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd,xof";
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return Response.json({ ok: false, error: `coingecko ${res.status}` }, { status: 502 });
    const data = (await res.json()) as { "the-open-network"?: { usd?: number; xof?: number } };
    const price = data["the-open-network"];
    if (!price || !price.usd) return Response.json({ ok: false, error: "no price" }, { status: 502 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // NB: xof_per_ton is an internal pricing rate (fixed at 3300 XOF/TON) — do NOT overwrite from market feed,
    // otherwise service XOF prices fluctuate with TON's market price.
    const updates: Array<{ key: string; value: string }> = [
      { key: "usd_per_ton", value: String(price.usd) },
      { key: "usdt_per_ton", value: String(price.usd) },
    ];

    for (const u of updates) {
      await supabaseAdmin.from("settings").upsert(
        { key: u.key, value: u.value, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    }
    return Response.json({ ok: true, rates: { usd: price.usd, xof: price.xof } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/refresh-rates")({
  server: {
    handlers: {
      GET: refresh,
      POST: refresh,
    },
  },
});
