// Server-only TON chain helper via toncenter
const TON_API = "https://toncenter.com/api/v2";

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
      // toncenter returns base64-encoded comment text
      const decoded = atob(text);
      // The first byte may be a 0x00 opcode for text comment
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
