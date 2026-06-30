import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateMemo, generatePublicCode } from "./format";

// Public: list active services
export const listServices = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await sb
    .from("services")
    .select("id, provider_id, name, category, platform, type, rate_per_1k_ton, min_qty, max_qty")
    .eq("active", true)
    .order("platform", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

// Public: get a single service
export const getService = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: row, error } = await sb
      .from("services")
      .select("id, provider_id, name, category, platform, type, rate_per_1k_ton, min_qty, max_qty, active")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.active) throw new Error("Service introuvable");
    return row;
  });

// Public: get TON receive address (display only)
export const getTonAddress = createServerFn({ method: "GET" }).handler(async () => {
  return { address: process.env.TON_RECEIVE_ADDRESS || "" };
});

// Public: create a pending order
const createOrderSchema = z.object({
  service_id: z.string().uuid(),
  link: z.string().url().max(500),
  quantity: z.number().int().min(1).max(10_000_000),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createOrderSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: svc, error: svcErr } = await supabaseAdmin
      .from("services")
      .select("id, rate_per_1k_ton, min_qty, max_qty, active")
      .eq("id", data.service_id)
      .maybeSingle();
    if (svcErr) throw new Error(svcErr.message);
    if (!svc || !svc.active) throw new Error("Service indisponible");
    if (data.quantity < svc.min_qty || data.quantity > svc.max_qty) {
      throw new Error(`Quantité doit être entre ${svc.min_qty} et ${svc.max_qty}`);
    }

    const amount = Math.max(
      0.01,
      Math.round((Number(svc.rate_per_1k_ton) * data.quantity) / 1000 * 10000) / 10000,
    );

    // Generate unique memo + code with collision retry
    let memo = generateMemo();
    let code = generatePublicCode();
    for (let i = 0; i < 5; i++) {
      const { data: ex } = await supabaseAdmin
        .from("orders")
        .select("id")
        .or(`memo.eq.${memo},public_code.eq.${code}`)
        .maybeSingle();
      if (!ex) break;
      memo = generateMemo();
      code = generatePublicCode();
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("orders")
      .insert({
        service_id: data.service_id,
        link: data.link,
        quantity: data.quantity,
        amount_ton: amount,
        memo,
        public_code: code,
        status: "pending",
      })
      .select("id, public_code, memo, amount_ton")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: inserted.id,
      public_code: inserted.public_code,
      memo: inserted.memo,
      amount_ton: Number(inserted.amount_ton),
      ton_address: process.env.TON_RECEIVE_ADDRESS || "",
    };
  });

// Public: track an order by public_code
export const getOrderByCode = createServerFn({ method: "GET" })
  .inputValidator((d: { code: string }) => z.object({ code: z.string().min(4).max(32) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: row, error } = await sb
      .from("orders")
      .select("id, public_code, memo, amount_ton, link, quantity, status, provider_order_id, created_at, paid_at, sent_at, service:services(name, platform)")
      .eq("public_code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Commande introuvable");
    return {
      ...row,
      amount_ton: Number(row.amount_ton),
      ton_address: process.env.TON_RECEIVE_ADDRESS || "",
    };
  });

// Public: trigger TON check on-demand (idempotent; also runs via cron)
export const triggerTonCheck = createServerFn({ method: "POST" }).handler(async () => {
  const { runTonCheck } = await import("./processing.server");
  return runTonCheck();
});

// --- Admin functions ---

async function assertAdmin(ctx: { supabase: { rpc: (n: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }; userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès refusé");
}

export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, service:services(name, platform, provider_id)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("orders")
      .select("status, amount_ton, created_at");
    const rows = data ?? [];
    const total = rows.length;
    const paidPlus = rows.filter((r) => ["paid", "sent", "completed"].includes(r.status as string));
    const revenue = paidPlus.reduce((s, r) => s + Number(r.amount_ton), 0);
    const pending = rows.filter((r) => r.status === "pending").length;
    const sent = rows.filter((r) => r.status === "sent" || r.status === "completed").length;
    return { total, revenue, pending, sent, paid: paidPlus.length };
  });

export const adminSyncServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { fetchServices } = await import("./exobooster.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin.from("settings").select("key, value");
    const settingsMap = new Map((settings ?? []).map((s) => [s.key, s.value]));
    const markup = Number(settingsMap.get("markup_percent") ?? "30") / 100;
    const tonUsd = Number(settingsMap.get("ton_price_usd") ?? "5.5");

    const services = await fetchServices();
    let upserted = 0;
    for (const s of services) {
      const name = s.name || "Service";
      const platform = guessPlatform(name + " " + (s.category ?? ""));
      const rateUsd = Number(s.rate);
      if (!isFinite(rateUsd) || rateUsd <= 0) continue;
      const ratePerKTon = (rateUsd / tonUsd) * (1 + markup);
      const { error } = await supabaseAdmin.from("services").upsert(
        {
          provider_id: String(s.service),
          name,
          category: s.category ?? null,
          type: s.type ?? null,
          platform,
          rate_per_1k: rateUsd,
          rate_per_1k_ton: Number(ratePerKTon.toFixed(6)),
          min_qty: Number(s.min) || 1,
          max_qty: Number(s.max) || 1_000_000,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider_id" },
      );
      if (!error) upserted++;
    }
    return { upserted, total: services.length };
  });

export const adminRetryOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { pushToProvider } = await import("./processing.server");
    return pushToProvider(data.id);
  });

export const adminMarkPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    const { pushToProvider } = await import("./processing.server");
    return pushToProvider(data.id);
  });

function guessPlatform(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("instagram") || t.includes("insta")) return "Instagram";
  if (t.includes("tiktok")) return "TikTok";
  if (t.includes("youtube")) return "YouTube";
  if (t.includes("twitter") || t.includes(" x ") || t.includes("x.com")) return "Twitter";
  if (t.includes("facebook")) return "Facebook";
  if (t.includes("telegram")) return "Telegram";
  if (t.includes("spotify")) return "Spotify";
  if (t.includes("twitch")) return "Twitch";
  if (t.includes("snapchat")) return "Snapchat";
  if (t.includes("linkedin")) return "LinkedIn";
  return "Autre";
}
