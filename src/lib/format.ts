// Deterministic number formatter (avoids SSR/CSR hydration mismatches)
export function formatNumber(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? parseFloat(n) : n ?? 0;
  if (!isFinite(num)) return "0";
  const [int, dec] = Math.abs(num).toString().split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (num < 0 ? "-" : "") + (dec ? `${withSep},${dec}` : withSep);
}

export type Currency = "XOF" | "USD" | "TON";

// Default rates (kept in sync with DB settings: xof_per_ton, usd_per_ton)
export const XOF_PER_TON = 3300;
export const USD_PER_TON = 5.5;

export function formatTon(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  if (!isFinite(n)) return "0 TON";
  if (n === 0) return "0 TON";
  return `${n < 1 ? n.toFixed(4) : n.toFixed(2)} TON`;
}

export function tonToXof(ton: number, rate = XOF_PER_TON): number {
  return Math.round(ton * rate);
}
export function tonToUsd(ton: number, rate = USD_PER_TON): number {
  return Math.round(ton * rate * 100) / 100;
}

export function formatXof(amount: number | string | null | undefined, rate = XOF_PER_TON): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  if (!isFinite(n)) return "0 XOF";
  const xof = n < 10 ? tonToXof(n, rate) : Math.round(n);
  return `${formatNumber(xof)} XOF`;
}

export function formatUsd(amount: number | string | null | undefined, rate = USD_PER_TON): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  if (!isFinite(n)) return "$0";
  const usd = tonToUsd(n, rate);
  return `$${formatNumber(usd)}`;
}

/** Format a TON amount in the chosen display currency. */
export function formatPrice(
  ton: number,
  currency: Currency,
  rates?: { xof?: number; usd?: number },
): string {
  if (!isFinite(ton)) ton = 0;
  if (currency === "TON") return formatTon(ton);
  if (currency === "USD") return formatUsd(ton, rates?.usd ?? USD_PER_TON);
  return formatXof(ton, rates?.xof ?? XOF_PER_TON);
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
