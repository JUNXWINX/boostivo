export function formatTon(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  if (!isFinite(n)) return "0 TON";
  return `${n.toFixed(n < 1 ? 4 : 2)} TON`;
}

export function generateMemo(): string {
  // 10-char base36 memo
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += b.toString(36).padStart(2, "0");
  return ("BV" + s).toUpperCase().slice(0, 12);
}

export function generatePublicCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
