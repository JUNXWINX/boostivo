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
