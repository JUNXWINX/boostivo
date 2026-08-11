import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateMemo, generatePublicCode } from "./format";

function publicClient() {
  // dynamic import keeps the supabase-js dep out of the SSR client bundle's top scope
  return import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  );
}

// Public: list active services
export const listServices = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await publicClient();
  const { data, error } = await sb
    .from("services")
    .select("id, provider_id, name, category, platform, type, rate_per_1k_ton, min_qty, max_qty, avg_time, remarks")
    .eq("active", true)
    .order("platform", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

// Public: rates (XOF/USD/USDT per TON)
export const getRates = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await publicClient();
  const { data } = await sb.from("settings").select("key, value").in("key", ["xof_per_ton", "usd_per_ton", "usdt_per_ton"]);
  const map = new Map((data ?? []).map((r) => [r.key, Number(r.value)]));
  const usd = map.get("usd_per_ton") || 2.3;
  return {
    xof_per_ton: map.get("xof_per_ton") || 1400,
    usd_per_ton: usd,
    usdt_per_ton: map.get("usdt_per_ton") || usd,
  };
});

// Public: username availability check
export const checkUsername = createServerFn({ method: "GET" })
  .inputValidator((d: { username: string }) =>
    z.object({ username: z.string().min(3).max(24).regex(/^[a-z0-9_]+$/i) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .ilike("username", data.username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { available: !row };
  });

// Authenticated: my profile
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("user_id, username, balance_ton, deposit_memo, preferred_currency, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Profil introuvable");
    return {
      ...data,
      balance_ton: Number(data.balance_ton),
      ton_address: process.env.TON_RECEIVE_ADDRESS || "",
    };
  });

export const updateMyCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { currency: string }) =>
    z.object({ currency: z.enum(["XOF", "USD"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ preferred_currency: data.currency })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Authenticated: my deposits history
export const getMyDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("deposits")
      .select("id, amount_ton, tx_hash, memo, from_addr, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((d) => ({ ...d, amount_ton: Number(d.amount_ton) }));
  });

// Authenticated: my orders history (auto-syncs open orders with provider)
export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { syncUserOpenOrders, dispatchPendingOrders } = await import("./processing.server");
      await dispatchPendingOrders(5, context.userId);
      await syncUserOpenOrders(context.userId);
    } catch (e) {
      console.error("[getMyOrders] sync failed", e);
    }
    const { data, error } = await context.supabase
      .from("orders")
      .select("id, public_code, link, quantity, amount_ton, status, created_at, sent_at, completed_at, provider_order_id, provider_response, service:services(name, platform)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((o) => ({ ...o, amount_ton: Number(o.amount_ton) }));
  });

export const syncMyOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncUserOpenOrders, dispatchPendingOrders } = await import("./processing.server");
    await dispatchPendingOrders(10, context.userId);
    return syncUserOpenOrders(context.userId);
  });

// Public: TON receive address
export const getTonAddress = createServerFn({ method: "GET" }).handler(async () => {
  return { address: process.env.TON_RECEIVE_ADDRESS || "" };
});

// ---- Order placement: balance-first when signed-in ----
const createOrderSchema = z.object({
  service_id: z.string().uuid(),
  link: z.string().url().max(500),
  quantity: z.number().int().min(1).max(10_000_000),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createOrderSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Try to extract auth user from request header
    let userId: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const auth = getRequestHeader("authorization");
      if (auth?.startsWith("Bearer ")) {
        const token = auth.slice(7);
        const { data: u } = await supabaseAdmin.auth.getUser(token);
        userId = u?.user?.id ?? null;
      }
    } catch { /* anon flow */ }

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
      0.0001,
      Math.round((Number(svc.rate_per_1k_ton) * data.quantity) / 1000 * 10000) / 10000,
    );

    // generate unique memo/code
    let memo = generateMemo();
    let code = generatePublicCode();
    for (let i = 0; i < 5; i++) {
      const { data: ex } = await supabaseAdmin
        .from("orders").select("id")
        .or(`memo.eq.${memo},public_code.eq.${code}`).maybeSingle();
      if (!ex) break;
      memo = generateMemo();
      code = generatePublicCode();
    }

    // If user signed-in and has enough balance, debit & mark paid immediately
    let usedBalance = false;
    if (userId) {
      const { data: ok } = await supabaseAdmin.rpc("debit_balance", { _user: userId, _amount: amount });
      usedBalance = !!ok;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        service_id: data.service_id,
        link: data.link,
        quantity: data.quantity,
        amount_ton: amount,
        memo,
        public_code: code,
        status: usedBalance ? "paid" : "pending",
        paid_at: usedBalance ? new Date().toISOString() : null,
      })
      .select("id, public_code, memo, amount_ton, status")
      .single();
    if (error) {
      // refund if we debited but insert failed
      if (usedBalance && userId) {
        await supabaseAdmin.rpc("credit_balance", { _user: userId, _amount: amount });
      }
      throw new Error(error.message);
    }

    // Provider dispatch: automatic by default; failures stay queued and are retried
    let dispatch: { ok: boolean; status: string; error?: string; retryable?: boolean } | null = null;
    if (usedBalance) {
      try {
        const { pushToProvider, autoSendEnabled } = await import("./processing.server");
        if (await autoSendEnabled()) {
          dispatch = await pushToProvider(inserted.id);
        }
      } catch (e) {
        console.error("[order] push failed", e);
      }
    }



    return {
      id: inserted.id,
      public_code: inserted.public_code,
      memo: inserted.memo,
      amount_ton: Number(inserted.amount_ton),
      status: dispatch?.ok ? "sent" : inserted.status,
      paid_with_balance: usedBalance,
      dispatched: dispatch?.ok ?? false,
      queued: dispatch ? !dispatch.ok && dispatch.retryable !== false : false,
      ton_address: process.env.TON_RECEIVE_ADDRESS || "",
    };
  });

// Public: track an order by public_code (auto-syncs provider status)
export const getOrderByCode = createServerFn({ method: "GET" })
  .inputValidator((d: { code: string }) => z.object({ code: z.string().min(4).max(32) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .select("id, public_code, memo, amount_ton, link, quantity, status, provider_order_id, provider_response, created_at, paid_at, sent_at, completed_at, service:services(name, platform)")
      .eq("public_code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Commande introuvable");
    // best-effort sync if we have a provider id and order is still open
    if (row.provider_order_id && (row.status === "sent" || row.status === "paid")) {
      try {
        const { syncOrderStatus } = await import("./processing.server");
        const res = await syncOrderStatus(row.id);
        if (res.ok && res.provider) {
          row.provider_response = res.provider as never;
          if (res.status) row.status = res.status as typeof row.status;
        }
      } catch (e) {
        console.error("[getOrderByCode] sync failed", e);
      }
    }
    return {
      ...row,
      amount_ton: Number(row.amount_ton),
      ton_address: process.env.TON_RECEIVE_ADDRESS || "",
    };
  });

export const triggerTonCheck = createServerFn({ method: "POST" }).handler(async () => {
  const { runTonCheck } = await import("./processing.server");
  return runTonCheck();
});

// ---- Admin ----
async function assertAdmin(ctx: { userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", ctx.userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès refusé");
}

export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("orders").select("*, service:services(name, platform, provider_id)")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: orderRows }, { data: depRows }, { data: topRows }, { data: profRows }] = await Promise.all([
      supabaseAdmin.from("orders").select("status, amount_ton, created_at, quantity, service:services(platform, rate_per_1k)"),
      supabaseAdmin.from("deposits").select("amount_ton, created_at"),
      supabaseAdmin.from("topup_requests").select("amount_xof, status, created_at"),
      supabaseAdmin.from("profiles").select("user_id, balance_ton, created_at"),
    ]);

    const rows = orderRows ?? [];
    const paidPlus = rows.filter((r) => ["paid", "sent", "completed"].includes(String(r.status)));
    const revenue = paidPlus.reduce((s, r) => s + Number(r.amount_ton), 0);
    const cost = paidPlus.reduce((s, r) => {
      const svc = r.service as { rate_per_1k?: number } | null;
      return s + ((Number(svc?.rate_per_1k ?? 0) * Number(r.quantity)) / 1000);
    }, 0); // in USD

    const byStatus = ["pending", "paid", "sent", "completed", "failed", "cancelled"].map((s) => ({
      status: s,
      count: rows.filter((r) => r.status === s).length,
    }));

    const platformMap = new Map<string, { platform: string; orders: number; revenue: number }>();
    for (const r of paidPlus) {
      const p = (r.service as { platform?: string } | null)?.platform ?? "Autre";
      const cur = platformMap.get(p) ?? { platform: p, orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += Number(r.amount_ton);
      platformMap.set(p, cur);
    }
    const byPlatform = [...platformMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    // 30-day daily series
    const days: { day: string; orders: number; revenue: number; deposits: number }[] = [];
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const idx = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      idx.set(dayKey(d), days.length);
      days.push({ day: dayKey(d).slice(5), orders: 0, revenue: 0, deposits: 0 });
    }
    for (const r of rows) {
      const k = idx.get(String(r.created_at).slice(0, 10));
      if (k == null) continue;
      days[k].orders += 1;
      if (["paid", "sent", "completed"].includes(String(r.status))) days[k].revenue += Number(r.amount_ton);
    }
    for (const d of depRows ?? []) {
      const k = idx.get(String(d.created_at).slice(0, 10));
      if (k != null) days[k].deposits += Number(d.amount_ton);
    }

    // provider balance (best effort)
    let providerBalance: { balance?: string; currency?: string; error?: string } = {};
    try {
      const { fetchBalance } = await import("./exobooster.server");
      providerBalance = await fetchBalance();
    } catch (e) {
      providerBalance = { error: e instanceof Error ? e.message : "indisponible" };
    }

    const topups = topRows ?? [];
    return {
      total: rows.length,
      revenue,
      costUsd: cost,
      pending: rows.filter((r) => r.status === "pending").length,
      paid: paidPlus.length,
      queued: rows.filter((r) => r.status === "paid").length,
      sent: rows.filter((r) => r.status === "sent").length,
      completed: rows.filter((r) => r.status === "completed").length,
      failed: rows.filter((r) => r.status === "failed").length,
      users: (profRows ?? []).length,
      userBalance: (profRows ?? []).reduce((s, p) => s + Number(p.balance_ton), 0),
      depositsTon: (depRows ?? []).reduce((s, d) => s + Number(d.amount_ton), 0),
      topupsPending: topups.filter((t) => t.status === "pending").length,
      topupsApprovedXof: topups.filter((t) => t.status === "approved").reduce((s, t) => s + Number(t.amount_xof), 0),
      byStatus,
      byPlatform,
      days,
      providerBalance,
    };
  });

/** Force a dispatch pass over every queued (paid) order. */
export const adminDispatchPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { dispatchPendingOrders } = await import("./processing.server");
    return dispatchPendingOrders(50);
  });


export const adminSyncServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { fetchServices } = await import("./exobooster.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin.from("settings").select("key, value");
    const settingsMap = new Map((settings ?? []).map((s) => [s.key, s.value]));
    const tonUsd = Number(settingsMap.get("usd_per_ton") ?? settingsMap.get("ton_price_usd") ?? "2.3");

    const { loadMargins, resolveMargin, guessKind, roundTon } = await import("./margins.server");
    const margins = await loadMargins();

    const services = await fetchServices();
    let upserted = 0;
    for (const s of services) {
      const name = s.name || "Service";
      const label = name + " " + (s.category ?? "");
      const platform = guessPlatform(label);
      const kind = guessKind(label);
      const rateUsd = Number(s.rate);
      if (!isFinite(rateUsd) || rateUsd <= 0) continue;
      const ratePerKTon = roundTon((rateUsd / tonUsd) * resolveMargin(margins, platform, kind));
      const remarksParts: string[] = [];
      if (s.description) remarksParts.push(String(s.description));
      const flags: string[] = [];
      if (s.refill) flags.push("Refill");
      if (s.cancel) flags.push("Annulation possible");
      if (s.dripfeed) flags.push("Dripfeed");
      if (flags.length) remarksParts.push(flags.join(" · "));
      const remarks = remarksParts.join(" — ") || null;
      const avgTime = s.average_time ?? s.avg_time ?? null;

      const { error } = await supabaseAdmin.from("services").upsert(
        {
          provider_id: String(s.service),
          name, category: s.category ?? null, type: s.type ?? null, platform,
          rate_per_1k: rateUsd,
          rate_per_1k_ton: ratePerKTon,
          min_qty: Number(s.min) || 1, max_qty: Number(s.max) || 1_000_000,
          avg_time: avgTime,
          remarks,
          active: true, updated_at: new Date().toISOString(),
        }, { onConflict: "provider_id" },
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
      .from("orders").update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.id).eq("status", "pending");
    if (error) throw new Error(error.message);
    const { pushToProvider } = await import("./processing.server");
    return pushToProvider(data.id);
  });

function guessPlatform(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("whatsapp")) return "WhatsApp";
  if (t.includes("instagram") || t.includes("insta")) return "Instagram";
  if (t.includes("tiktok") || t.includes("douyin")) return "TikTok";
  if (t.includes("youtube") || t.includes("yt ")) return "YouTube";
  if (t.includes("twitter") || t.includes(" x ") || t.includes("x.com") || t.includes("/x ") || t.match(/\bx-/) || t.includes("threads")) return "Twitter";
  if (t.includes("facebook") || t.includes("fb ")) return "Facebook";
  if (t.includes("telegram") || t.includes("tg ")) return "Telegram";
  if (t.includes("spotify")) return "Spotify";
  if (t.includes("twitch")) return "Twitch";
  if (t.includes("snapchat") || t.includes("snap ")) return "Snapchat";
  if (t.includes("linkedin")) return "LinkedIn";
  if (t.includes("discord")) return "Discord";
  if (t.includes("potato")) return "Potato";
  if (t.includes("kick.com") || t.match(/\bkick\b/)) return "Kick";
  if (t.includes("reddit")) return "Reddit";
  if (t.includes("pinterest")) return "Pinterest";
  if (t.includes("soundcloud")) return "SoundCloud";
  return "Autre";
}

// ============ Marges (admin) ============
export const adminListMargins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("margins").select("id, platform, kind, percent")
      .order("platform").order("kind");
    if (error) throw new Error(error.message);
    return (data ?? []).map((m) => ({ ...m, percent: Number(m.percent) }));
  });

export const adminSaveMargin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      platform: z.string().min(1).max(40),
      kind: z.enum(["subscribers", "members", "likes", "views", "other", "all"]),
      percent: z.number().min(0).max(10000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("margins")
      .upsert({ platform: data.platform, kind: data.kind, percent: data.percent }, { onConflict: "platform,kind" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Recompute every service price from its provider cost + current margins. */
export const adminRecalcPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadMargins, resolveMargin, guessKind, roundTon } = await import("./margins.server");
    const { data: setting } = await supabaseAdmin
      .from("settings").select("value").eq("key", "usd_per_ton").maybeSingle();
    const tonUsd = Number(setting?.value ?? "2.3") || 2.3;
    const margins = await loadMargins();
    const { data: services } = await supabaseAdmin
      .from("services").select("id, name, category, platform, rate_per_1k");
    let updated = 0;
    for (const s of services ?? []) {
      const cost = Number(s.rate_per_1k);
      if (!isFinite(cost) || cost <= 0) continue;
      const kind = guessKind(`${s.name} ${s.category ?? ""}`);
      const ton = roundTon((cost / tonUsd) * resolveMargin(margins, s.platform ?? "Autre", kind));
      const { error } = await supabaseAdmin
        .from("services").update({ rate_per_1k_ton: ton, updated_at: new Date().toISOString() }).eq("id", s.id);
      if (!error) updated++;
    }
    return { updated, total: services?.length ?? 0 };
  });

// ============ Mobile Money ============
export type MomoAccount = { country: string; operator: string; number: string; name: string };

const DEFAULT_MOMO: MomoAccount[] = [
  { country: "Bénin", operator: "MTN MoMo", number: "+229 00 00 00 00", name: "Boostivo" },
  { country: "Bénin", operator: "Moov Money", number: "+229 00 00 00 00", name: "Boostivo" },
  { country: "Côte d'Ivoire", operator: "Orange Money", number: "+225 00 00 00 00", name: "Boostivo" },
  { country: "Côte d'Ivoire", operator: "Wave", number: "+225 00 00 00 00", name: "Boostivo" },
  { country: "Togo", operator: "T-Money", number: "+228 00 00 00 00", name: "Boostivo" },
  { country: "Sénégal", operator: "Wave", number: "+221 00 00 00 00", name: "Boostivo" },
  { country: "Burkina Faso", operator: "Orange Money", number: "+226 00 00 00 00", name: "Boostivo" },
  { country: "Mali", operator: "Orange Money", number: "+223 00 00 00 00", name: "Boostivo" },
];

async function readMomoAccounts(): Promise<MomoAccount[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", "momo_accounts").maybeSingle();
  if (!data?.value) return DEFAULT_MOMO;
  try {
    const parsed = JSON.parse(data.value);
    return Array.isArray(parsed) && parsed.length ? (parsed as MomoAccount[]) : DEFAULT_MOMO;
  } catch {
    return DEFAULT_MOMO;
  }
}

export const getMomoAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => readMomoAccounts());

export const adminSaveMomoAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      accounts: z.array(z.object({
        country: z.string().min(1).max(60),
        operator: z.string().min(1).max(60),
        number: z.string().min(4).max(40),
        name: z.string().min(1).max(60),
      })).max(50),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("settings").upsert({ key: "momo_accounts", value: JSON.stringify(data.accounts) }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createTopupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      country: z.string().min(1).max(60),
      operator: z.string().min(1).max(60),
      phone: z.string().trim().min(6).max(25),
      amount_xof: z.number().int().min(100).max(5_000_000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("topup_requests").insert({
      user_id: context.userId,
      country: data.country,
      operator: data.operator,
      phone: data.phone,
      amount_xof: data.amount_xof,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("topup_requests")
      .select("id, reference, country, operator, phone, amount_xof, status, admin_note, created_at, processed_at, credited_ton, credited_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((t) => ({
      ...t,
      amount_xof: Number(t.amount_xof),
      credited_ton: t.credited_ton == null ? null : Number(t.credited_ton),
    }));
  });

export const adminListTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("topup_requests")
      .select("id, reference, user_id, country, operator, phone, amount_xof, status, admin_note, created_at, processed_at, credited_ton, credited_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const ids = [...new Set((data ?? []).map((t) => t.user_id))];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("user_id, username").in("user_id", ids)
      : { data: [] as { user_id: string; username: string }[] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.username]));
    return (data ?? []).map((t) => ({
      ...t,
      amount_xof: Number(t.amount_xof),
      credited_ton: t.credited_ton == null ? null : Number(t.credited_ton),
      username: nameMap.get(t.user_id) ?? "—",
    }));
  });

export const adminReviewTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      approve: z.boolean(),
      note: z.string().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("topup_requests").select("id, user_id, amount_xof, status").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Demande introuvable");
    if (row.status !== "pending") throw new Error("Demande déjà traitée");

    const now = new Date().toISOString();
    let amountTon: number | null = null;

    if (data.approve) {
      const { data: setting } = await supabaseAdmin
        .from("settings").select("value").eq("key", "xof_per_ton").maybeSingle();
      const xofPerTon = Number(setting?.value ?? "3300") || 3300;
      amountTon = Math.round((Number(row.amount_xof) / xofPerTon) * 1e6) / 1e6;
    }

    // Marque d'abord la demande comme traitée (garde anti-double crédit)
    const { data: updated, error: updErr } = await supabaseAdmin.from("topup_requests").update({
      status: data.approve ? "approved" : "rejected",
      admin_note: data.note?.trim() ? data.note.trim() : null,
      processed_at: now,
      ...(data.approve ? { credited_ton: amountTon, credited_at: now } : {}),
    }).eq("id", data.id).eq("status", "pending").select("id").maybeSingle();
    if (updErr) throw new Error(updErr.message);
    if (!updated) throw new Error("Demande déjà traitée");

    if (data.approve && amountTon != null) {
      const { error: credErr } = await supabaseAdmin.rpc("credit_balance", { _user: row.user_id, _amount: amountTon });
      if (credErr) {
        // rollback pour permettre une nouvelle tentative
        await supabaseAdmin.from("topup_requests").update({
          status: "pending", processed_at: null, credited_ton: null, credited_at: null,
        }).eq("id", data.id);
        throw new Error(credErr.message);
      }
    }
    return { ok: true, credited_ton: amountTon };
  });


// ============ Mode d'envoi fournisseur ============
export const adminGetAutoSend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("settings").select("value").eq("key", "auto_send_orders").maybeSingle();
    return { auto: data?.value == null ? true : String(data.value) !== "false" };
  });

export const adminSetAutoSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ auto: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("settings").upsert({ key: "auto_send_orders", value: data.auto ? "true" : "false" }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
