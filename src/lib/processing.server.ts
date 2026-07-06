// Server-only processing: TON scanner + push to ExoBooster
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addOrder, fetchMultiOrderStatus, fetchOrderStatus, type ProviderStatus } from "./exobooster.server";
import { decodeMemo, fetchIncomingTxs, fetchIncomingUsdtJettons, nanoToTon } from "./ton.server";

// Map ExoBooster/SMM panel status strings to our order_status enum
export function mapProviderStatus(raw?: string): "sent" | "completed" | "failed" | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s === "completed") return "completed";
  if (s === "canceled" || s === "cancelled" || s === "refunded") return "failed";
  if (s === "partial") return "completed"; // partial delivery — treat as done
  // pending / in progress / processing / awaiting => still "sent"
  return "sent";
}

export async function syncOrderStatus(orderId: string): Promise<{ ok: boolean; status?: string; provider?: ProviderStatus; error?: string }> {
  const { data: order, error } = await supabaseAdmin
    .from("orders").select("id, provider_order_id, status")
    .eq("id", orderId).maybeSingle();
  if (error || !order) return { ok: false, error: error?.message || "not found" };
  if (!order.provider_order_id) return { ok: false, error: "no provider_order_id" };
  if (order.status === "completed" || order.status === "failed" || order.status === "cancelled") {
    return { ok: true, status: order.status };
  }
  try {
    const info = await fetchOrderStatus(order.provider_order_id);
    const mapped = mapProviderStatus(info.status);
    const patch: { provider_response: ProviderStatus; status?: "sent" | "completed" | "failed"; completed_at?: string } = { provider_response: info };
    if (mapped && mapped !== order.status) {
      patch.status = mapped;
      if (mapped === "completed") patch.completed_at = new Date().toISOString();
    }
    await supabaseAdmin.from("orders").update(patch as never).eq("id", orderId);
    return { ok: true, status: patch.status || order.status, provider: info };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function syncUserOpenOrders(userId: string): Promise<{ synced: number }> {
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, provider_order_id, status")
    .eq("user_id", userId)
    .in("status", ["sent", "paid"])
    .not("provider_order_id", "is", null)
    .limit(50);
  if (!orders?.length) return { synced: 0 };

  const ids = orders.map((o) => String(o.provider_order_id)).filter(Boolean);
  let batch: Record<string, ProviderStatus> = {};
  try {
    batch = await fetchMultiOrderStatus(ids);
  } catch {
    // fall back to per-order
    for (const o of orders) {
      await syncOrderStatus(o.id);
    }
    return { synced: orders.length };
  }
  let synced = 0;
  for (const o of orders) {
    const info = batch[String(o.provider_order_id)];
    if (!info) continue;
    const mapped = mapProviderStatus(info.status);
    const patch: Record<string, unknown> = { provider_response: info as never };
    if (mapped && mapped !== o.status) {
      patch.status = mapped;
      if (mapped === "completed") patch.completed_at = new Date().toISOString();
    }
    await supabaseAdmin.from("orders").update(patch).eq("id", o.id);
    synced++;
  }
  return { synced };
}


export async function pushToProvider(orderId: string): Promise<{ ok: boolean; status: string; error?: string }> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, quantity, link, service_id, service:services(provider_id)")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return { ok: false, status: "missing", error: error?.message };
  if (order.status !== "paid") return { ok: false, status: order.status, error: "Pas en statut payé" };

  const providerId = (order.service as { provider_id?: string } | null)?.provider_id;
  if (!providerId) return { ok: false, status: "failed", error: "Service sans provider_id" };

  try {
    const res = await addOrder({ service: providerId, link: order.link, quantity: order.quantity });
    if (res.error || !res.order) {
      await supabaseAdmin.from("orders").update({
        status: "failed", provider_response: res.raw as never,
      }).eq("id", orderId);
      return { ok: false, status: "failed", error: res.error || "Pas d'ID commande renvoyé" };
    }
    await supabaseAdmin.from("orders").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_order_id: String(res.order),
      provider_response: res.raw as never,
    }).eq("id", orderId);
    return { ok: true, status: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin.from("orders").update({
      status: "failed",
      provider_response: { error: msg } as never,
    }).eq("id", orderId);
    return { ok: false, status: "failed", error: msg };
  }
}

export async function runTonCheck(): Promise<{ scanned: number; orderMatches: number; depositCredits: number; pushed: number }> {
  const address = process.env.TON_RECEIVE_ADDRESS;
  if (!address) return { scanned: 0, orderMatches: 0, depositCredits: 0, pushed: 0 };

  const txs = await fetchIncomingTxs(address, 40);
  let orderMatches = 0;
  let depositCredits = 0;
  let pushed = 0;

  for (const tx of txs) {
    const hash = tx.transaction_id.hash;
    const memo = decodeMemo(tx);
    const amount = nanoToTon(tx.in_msg?.value ?? "0");
    if (!memo) continue;

    // dedup
    const { data: seen } = await supabaseAdmin
      .from("ton_txs").select("hash").eq("hash", hash).maybeSingle();
    if (seen) continue;

    let matchedOrderId: string | null = null;

    // 1) Try to match a pending order
    const { data: order } = await supabaseAdmin
      .from("orders").select("id, amount_ton, status, user_id")
      .eq("memo", memo).maybeSingle();

    if (order && order.status === "pending" && amount + 0.001 >= Number(order.amount_ton)) {
      const { error: upd } = await supabaseAdmin.from("orders").update({
        status: "paid",
        paid_at: new Date().toISOString(),
        tx_hash: hash,
        tx_amount_ton: amount,
      }).eq("id", order.id).eq("status", "pending");
      if (!upd) {
        matchedOrderId = order.id;
        orderMatches++;
        const res = await pushToProvider(order.id);
        if (res.ok) pushed++;
      }
    } else {
      // 2) Try to match a user deposit memo
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("user_id").eq("deposit_memo", memo).maybeSingle();
      if (profile) {
        // insert deposit (unique tx_hash protects against double credit)
        const { error: depErr } = await supabaseAdmin.from("deposits").insert({
          user_id: profile.user_id,
          amount_ton: amount,
          tx_hash: hash,
          memo,
          from_addr: tx.in_msg?.source ?? null,
          status: "confirmed",
        });
        if (!depErr) {
          await supabaseAdmin.rpc("credit_balance", { _user: profile.user_id, _amount: amount });
          depositCredits++;
        }
      }
    }

    await supabaseAdmin.from("ton_txs").insert({
      hash, memo, amount_ton: amount,
      from_addr: tx.in_msg?.source ?? null,
      lt: tx.transaction_id.lt,
      matched_order_id: matchedOrderId,
    });
  }

  // ============ USDT jetton scan ============
  try {
    const usdtEvents = await fetchIncomingUsdtJettons(address, 40);
    const { data: rateRow } = await supabaseAdmin
      .from("settings").select("value").eq("key", "usdt_per_ton").maybeSingle();
    const usdtPerTon = Number(rateRow?.value ?? "2.3") || 2.3;

    for (const ev of usdtEvents) {
      if (!ev.memo) continue;
      // dedup via tx_hash uniqueness on deposits
      const { data: seen } = await supabaseAdmin
        .from("deposits").select("id").eq("tx_hash", ev.hash).maybeSingle();
      if (seen) continue;

      const { data: profile } = await supabaseAdmin
        .from("profiles").select("user_id").eq("deposit_memo", ev.memo).maybeSingle();
      if (!profile) continue;

      const amountTonEquivalent = ev.amount / usdtPerTon;
      const { error: depErr } = await supabaseAdmin.from("deposits").insert({
        user_id: profile.user_id,
        amount_ton: amountTonEquivalent,
        tx_hash: ev.hash,
        memo: ev.memo,
        from_addr: ev.from,
        status: "confirmed",
        asset: "USDT",
      });
      if (!depErr) {
        await supabaseAdmin.rpc("credit_balance", { _user: profile.user_id, _amount: amountTonEquivalent });
        depositCredits++;
      }
    }
  } catch {
    // silent — USDT scan is best-effort
  }

  return { scanned: txs.length, orderMatches, depositCredits, pushed };
}
