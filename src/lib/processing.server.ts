// Server-only processing: TON scanner + push to ExoBooster
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addOrder } from "./exobooster.server";
import { decodeMemo, fetchIncomingTxs, nanoToTon } from "./ton.server";

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
        status: "failed",
        provider_response: res.raw as never,
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

export async function runTonCheck(): Promise<{ scanned: number; matched: number; pushed: number }> {
  const address = process.env.TON_RECEIVE_ADDRESS;
  if (!address) return { scanned: 0, matched: 0, pushed: 0 };

  const txs = await fetchIncomingTxs(address, 40);
  let matched = 0;
  let pushed = 0;

  for (const tx of txs) {
    const hash = tx.transaction_id.hash;
    const memo = decodeMemo(tx);
    const amount = nanoToTon(tx.in_msg?.value ?? "0");
    if (!memo) continue;

    // Dedup
    const { data: seen } = await supabaseAdmin
      .from("ton_txs")
      .select("hash")
      .eq("hash", hash)
      .maybeSingle();
    if (seen) continue;

    // Find matching pending order by memo
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, amount_ton, status")
      .eq("memo", memo)
      .maybeSingle();

    let matchedOrderId: string | null = null;
    if (order && order.status === "pending" && amount + 0.001 >= Number(order.amount_ton)) {
      const { error: upd } = await supabaseAdmin.from("orders").update({
        status: "paid",
        paid_at: new Date().toISOString(),
        tx_hash: hash,
        tx_amount_ton: amount,
      }).eq("id", order.id).eq("status", "pending");
      if (!upd) {
        matchedOrderId = order.id;
        matched++;
        const res = await pushToProvider(order.id);
        if (res.ok) pushed++;
      }
    }

    await supabaseAdmin.from("ton_txs").insert({
      hash,
      memo,
      amount_ton: amount,
      from_addr: tx.in_msg?.source ?? null,
      lt: tx.transaction_id.lt,
      matched_order_id: matchedOrderId,
    });
  }

  return { scanned: txs.length, matched, pushed };
}
