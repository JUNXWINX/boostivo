// Deterministic number formatter (avoids SSR/CSR hydration mismatches)
export function formatNumber(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? parseFloat(n) : n ?? 0;
  if (!isFinite(num)) return "0";
  const [int, dec] = Math.abs(num).toString().split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (num < 0 ? "-" : "") + (dec ? `${withSep},${dec}` : withSep);
}

export function formatTon(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  if (!isFinite(n)) return "0 TON";
  return `${n.toFixed(n < 1 ? 4 : 2)} TON`;
}

// XOF rate per TON (kept in sync with DB setting `xof_per_ton`)
export const XOF_PER_TON = 3300;

export function tonToXof(ton: number | string | null | undefined, rate = XOF_PER_TON): number {
  const n = typeof ton === "string" ? parseFloat(ton) : ton ?? 0;
  if (!isFinite(n)) return 0;
  return Math.round(n * rate);
}

export function formatXof(amount: number | string | null | undefined, rate = XOF_PER_TON): string {
  // If given a small number (<10), treat as TON and convert. Otherwise treat as XOF.
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  if (!isFinite(n)) return "0 XOF";
  const xof = n < 10 ? tonToXof(n, rate) : Math.round(n);
  return `${formatNumber(xof)} XOF`;
}

export function generateMemo(): string {
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
