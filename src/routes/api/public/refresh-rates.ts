import { createFileRoute } from "@tanstack/react-router";

function checkAuth(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Server misconfigured", { status: 500 });
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (provided.length !== secret.length) return new Response("Unauthorized", { status: 401 });
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ provided.charCodeAt(i);
  if (diff !== 0) return new Response("Unauthorized", { status: 401 });
  return null;
}

/**
 * Refreshes TON price rates every 30 seconds via pg_cron.
 * Fetches from CoinGecko (public, no API key required).
 * Updates settings.usd_per_ton, usdt_per_ton. Requires CRON_SECRET bearer.
 */
async function refresh(request: Request): Promise<Response> {
  const unauth = checkAuth(request);
  if (unauth) return unauth;
  try {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd,xof";
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return Response.json({ ok: false, error: `coingecko ${res.status}` }, { status: 502 });
    const data = (await res.json()) as { "the-open-network"?: { usd?: number; xof?: number } };
    const price = data["the-open-network"];
    if (!price || !price.usd) return Response.json({ ok: false, error: "no price" }, { status: 502 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      GET: async ({ request }) => refresh(request),
      POST: async ({ request }) => refresh(request),
    },
  },
});
