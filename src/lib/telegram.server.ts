// Notifications Telegram (bot "Recharges")
// Envoie un message à l'admin quand une recharge est créée ou traitée.

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env["TELEGRAM_RECHARGE_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_RECHARGE_CHAT_ID"];
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error(`Telegram sendMessage failed [${res.status}]: ${await res.text()}`);
      return false;
    }
    const body = (await res.json()) as { ok?: boolean; description?: string };
    if (!body.ok) {
      console.error(`Telegram sendMessage error: ${body.description ?? "unknown"}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Telegram notification error:", e);
    return false;
  }
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export async function notifyNewTopup(t: {
  reference?: string | null;
  username?: string | null;
  country: string;
  operator: string;
  phone: string;
  amount_xof: number;
}) {
  await sendTelegram(
    [
      "🟠 <b>Nouvelle recharge Mobile Money</b>",
      t.reference ? `Réf : <code>${escapeHtml(t.reference)}</code>` : "",
      `Utilisateur : ${escapeHtml(t.username ?? "—")}`,
      `Pays : ${escapeHtml(t.country)} · Opérateur : ${escapeHtml(t.operator)}`,
      `Numéro : <code>${escapeHtml(t.phone)}</code>`,
      `Montant : <b>${fmt(t.amount_xof)} FCFA</b>`,
      "",
      "⏳ En attente de validation dans l'admin.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export async function notifyTopupReviewed(t: {
  reference?: string | null;
  username?: string | null;
  amount_xof: number;
  approved: boolean;
  credited_ton?: number | null;
  note?: string | null;
}) {
  await sendTelegram(
    [
      t.approved ? "✅ <b>Recharge validée</b>" : "❌ <b>Recharge refusée</b>",
      t.reference ? `Réf : <code>${escapeHtml(t.reference)}</code>` : "",
      `Utilisateur : ${escapeHtml(t.username ?? "—")}`,
      `Montant : <b>${fmt(t.amount_xof)} FCFA</b>`,
      t.approved && t.credited_ton != null ? `Crédité : ${t.credited_ton} TON` : "",
      t.note ? `Note : ${escapeHtml(t.note)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export async function notifyCryptoDeposit(d: {
  username?: string | null;
  amount: number;
  asset: string;
  memo?: string | null;
}) {
  await sendTelegram(
    [
      "💎 <b>Dépôt crypto reçu</b>",
      `Utilisateur : ${escapeHtml(d.username ?? "—")}`,
      `Montant : <b>${d.amount} ${escapeHtml(d.asset)}</b>`,
      d.memo ? `Mémo : <code>${escapeHtml(d.memo)}</code>` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

// ============ Bot "Commandes" ============
// Token dédié : TELEGRAM_ORDER_BOT_TOKEN (chat ID partagé avec le bot Recharges)

async function sendTelegramWith(token: string | undefined, text: string): Promise<boolean> {
  const chatId = process.env["TELEGRAM_ORDER_CHAT_ID"] || process.env["TELEGRAM_RECHARGE_CHAT_ID"];
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error(`Telegram (orders) failed [${res.status}]: ${await res.text()}`);
      return false;
    }
    const body = (await res.json()) as { ok?: boolean; description?: string };
    if (!body.ok) {
      console.error(`Telegram (orders) error: ${body.description ?? "unknown"}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Telegram (orders) notification error:", e);
    return false;
  }
}

export async function sendOrderTelegram(text: string): Promise<boolean> {
  const token = process.env["TELEGRAM_ORDER_BOT_TOKEN"];
  // repli sur le bot recharges si le bot commandes n'est pas encore configuré
  return sendTelegramWith(token || process.env["TELEGRAM_RECHARGE_BOT_TOKEN"], text);
}

export async function notifyNewOrder(o: {
  public_code: string;
  username?: string | null;
  service?: string | null;
  platform?: string | null;
  link: string;
  quantity: number;
  amount_ton: number;
  status: string;
  paid_with_balance?: boolean;
}) {
  await sendOrderTelegram(
    [
      "🛒 <b>Nouvelle commande</b>",
      `Code : <code>${escapeHtml(o.public_code)}</code>`,
      `Client : ${escapeHtml(o.username ?? "invité")}`,
      `Service : ${escapeHtml(o.service ?? "—")}${o.platform ? ` (${escapeHtml(o.platform)})` : ""}`,
      `Lien : ${escapeHtml(o.link)}`,
      `Quantité : <b>${fmt(o.quantity)}</b>`,
      `Montant : <b>${o.amount_ton} TON</b>`,
      `Paiement : ${o.paid_with_balance ? "solde du compte" : "en attente"}`,
      `Statut : <b>${escapeHtml(o.status)}</b>`,
    ].join("\n"),
  );
}

export async function notifyOrderStatus(o: {
  public_code: string;
  status: string;
  detail?: string | null;
}) {
  const icon = o.status === "completed" ? "✅" : o.status === "failed" ? "🚨" : "📦";
  await sendOrderTelegram(
    [
      `${icon} <b>Commande ${escapeHtml(o.status)}</b>`,
      `Code : <code>${escapeHtml(o.public_code)}</code>`,
      o.detail ? escapeHtml(o.detail) : "",
    ].filter(Boolean).join("\n"),
  );
}

export async function notifyNewWithdrawal(w: {
  reference?: string | null;
  username?: string | null;
  method: string;
  amount_ton: number;
  amount_xof?: number | null;
  country?: string | null;
  operator?: string | null;
  phone?: string | null;
  holder_name?: string | null;
  crypto_asset?: string | null;
  crypto_address?: string | null;
}) {
  await sendOrderTelegram(
    [
      "💸 <b>Nouvelle demande de retrait (parrainage)</b>",
      w.reference ? `Réf : <code>${escapeHtml(w.reference)}</code>` : "",
      `Utilisateur : ${escapeHtml(w.username ?? "—")}`,
      `Montant : <b>${w.amount_ton} TON</b>${w.amount_xof ? ` (~${fmt(w.amount_xof)} FCFA)` : ""}`,
      w.method === "mobile_money"
        ? [
            `Méthode : Mobile Money`,
            `Pays : ${escapeHtml(w.country ?? "—")} · Opérateur : ${escapeHtml(w.operator ?? "—")}`,
            `Numéro : <code>${escapeHtml(w.phone ?? "—")}</code>`,
            `Titulaire : ${escapeHtml(w.holder_name ?? "—")}`,
          ].join("\n")
        : [
            `Méthode : Crypto ${escapeHtml(w.crypto_asset ?? "TON")}`,
            `Adresse : <code>${escapeHtml(w.crypto_address ?? "—")}</code>`,
          ].join("\n"),
      "",
      "⏳ En attente de traitement dans l'admin.",
    ].filter(Boolean).join("\n"),
  );
}

export async function notifyWithdrawalReviewed(w: {
  reference?: string | null;
  username?: string | null;
  amount_ton: number;
  approved: boolean;
  note?: string | null;
}) {
  await sendOrderTelegram(
    [
      w.approved ? "✅ <b>Retrait payé</b>" : "❌ <b>Retrait refusé</b>",
      w.reference ? `Réf : <code>${escapeHtml(w.reference)}</code>` : "",
      `Utilisateur : ${escapeHtml(w.username ?? "—")}`,
      `Montant : <b>${w.amount_ton} TON</b>`,
      w.note ? `Note : ${escapeHtml(w.note)}` : "",
    ].filter(Boolean).join("\n"),
  );
}
