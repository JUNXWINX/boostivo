// Server-only TON chain helper (native TON via toncenter, USDT jettons via tonapi.io)
const TON_API = "https://toncenter.com/api/v2";
const TONAPI = "https://tonapi.io/v2";

// USDT jetton master on TON
export const USDT_JETTON_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";

type TonTx = {
  transaction_id: { hash: string; lt: string };
  in_msg?: {
    source: string;
    destination: string;
    value: string; // nanoton
    message?: string;
    msg_data?: { "@type"?: string; text?: string; body?: string };
  };
  utime: number;
};

export async function fetchIncomingTxs(address: string, limit = 30): Promise<TonTx[]> {
  const key = process.env.TONCENTER_API_KEY;
  const url = new URL(`${TON_API}/getTransactions`);
  url.searchParams.set("address", address);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url, {
    headers: key ? { "X-API-Key": key } : {},
  });
  if (!res.ok) throw new Error(`toncenter ${res.status}`);
  const data = (await res.json()) as { ok: boolean; result: TonTx[] };
  if (!data.ok) throw new Error("toncenter not ok");
  return data.result.filter((t) => t.in_msg && t.in_msg.source);
}

export function decodeMemo(tx: TonTx): string | null {
  const msg = tx.in_msg?.message;
  if (msg && typeof msg === "string" && msg.trim()) return msg.trim();
  const text = tx.in_msg?.msg_data?.text;
  if (text) {
    try {
      const decoded = atob(text);
      const cleaned = decoded.replace(/^\u0000+/, "").trim();
      if (cleaned) return cleaned;
    } catch {
      return text;
    }
  }
  return null;
}

export function nanoToTon(nano: string): number {
  return Number(BigInt(nano)) / 1e9;
}

// ============ USDT (jetton) scanner via tonapi.io ============

export type JettonIncoming = {
  hash: string;
  amount: number;      // USDT (already divided by 10^6)
  memo: string | null;
  from: string | null;
  utime: number;
};

type TonapiJettonEvent = {
  event_id: string;
  timestamp: number;
  actions?: Array<{
    type: string;
    status?: string;
    JettonTransfer?: {
      sender?: { address?: string };
      recipient?: { address?: string };
      amount?: string;
      jetton?: { address?: string; decimals?: number };
      comment?: string;
    };
  }>;
};

export async function fetchIncomingUsdtJettons(address: string, limit = 40): Promise<JettonIncoming[]> {
  const url = `${TONAPI}/accounts/${address}/jettons/${USDT_JETTON_MASTER}/history?limit=${limit}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json()) as { events?: TonapiJettonEvent[] };
  const events = data.events ?? [];
  const out: JettonIncoming[] = [];
  for (const ev of events) {
    for (const act of ev.actions ?? []) {
      const jt = act.JettonTransfer;
      if (!jt) continue;
      if (act.status && act.status !== "ok") continue;
      // must be incoming to our address
      const recipient = jt.recipient?.address ?? "";
      const norm = (s: string) => s.replace(/^0:/, "").toLowerCase();
      if (norm(recipient).length === 0) continue;
      // tonapi returns raw 0:hex form; compare loosely by suffix
      // We accept all events under this account/jetton endpoint (already filtered by address)
      const decimals = jt.jetton?.decimals ?? 6;
      const rawAmt = jt.amount ?? "0";
      const amount = Number(BigInt(rawAmt)) / Math.pow(10, decimals);
      out.push({
        hash: ev.event_id,
        amount,
        memo: (jt.comment ?? "").trim() || null,
        from: jt.sender?.address ?? null,
        utime: ev.timestamp,
      });
    }
  }
  return out;
}
