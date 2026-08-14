// Server-only: gestion des commissions de parrainage (pourcentage configurable en admin)
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Valeur de repli si le réglage n'est pas défini en base. */
export const DEFAULT_REFERRAL_PERCENT = 10;

/** Pourcentage de parrainage courant (settings.referral_percent). */
export async function getReferralPercent(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("settings").select("value").eq("key", "referral_percent").maybeSingle();
  const n = Number(data?.value);
  return isFinite(n) && n > 0 && n <= 90 ? n : DEFAULT_REFERRAL_PERCENT;
}

/** Minimums de retrait */
export const MIN_WITHDRAW_XOF = 1000;
export const MIN_WITHDRAW_USD = 2;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;


/**
 * Crédite la commission de parrainage pour une commande payée.
 * Protégé contre le double crédit par un index unique sur order_id.
 */
export async function creditReferralForOrder(orderId: string): Promise<{ referrer: string; amount: number } | null> {
  try {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, amount_ton")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.user_id) return null;

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .eq("user_id", order.user_id)
      .maybeSingle();
    const referrer = prof?.referred_by as string | null | undefined;
    if (!referrer || referrer === order.user_id) return null;

    const amount = round6((Number(order.amount_ton) * REFERRAL_PERCENT) / 100);
    if (!isFinite(amount) || amount <= 0) return null;

    const { error } = await supabaseAdmin.from("referral_commissions").insert({
      referrer_id: referrer,
      referee_id: order.user_id,
      order_id: order.id,
      order_amount_ton: Number(order.amount_ton),
      amount_ton: amount,
      percent: REFERRAL_PERCENT,
    });
    if (error) return null; // déjà créditée (unique order_id) ou erreur

    const { error: credErr } = await supabaseAdmin.rpc("credit_referral", {
      _user: referrer,
      _amount: amount,
    });
    if (credErr) {
      await supabaseAdmin.from("referral_commissions").delete().eq("order_id", order.id);
      return null;
    }
    return { referrer, amount };
  } catch (e) {
    console.error("[referral] credit failed", e);
    return null;
  }
}

/** Taux courants (XOF / USD par TON) depuis settings. */
export async function loadRates(): Promise<{ xof: number; usd: number }> {
  const { data } = await supabaseAdmin
    .from("settings")
    .select("key, value")
    .in("key", ["xof_per_ton", "usd_per_ton"]);
  const map = new Map((data ?? []).map((r) => [r.key, Number(r.value)]));
  return {
    xof: map.get("xof_per_ton") || 3300,
    usd: map.get("usd_per_ton") || 2.3,
  };
}
