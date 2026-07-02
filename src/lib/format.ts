// Deterministic number formatter (avoids SSR/CSR hydration mismatches)
export function formatNumber(n: number | string | null | undefined, decimals?: number): string {
  const num = typeof n === "string" ? parseFloat(n) : n ?? 0;
  if (!isFinite(num)) return "0";
  const fixed = typeof decimals === "number" ? Math.abs(num).toFixed(decimals) : Math.abs(num).toString();
  const [int, dec] = fixed.split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (num < 0 ? "-" : "") + (dec ? `${withSep},${dec}` : withSep);
}

export type Currency = "XOF" | "USD" | "USDT" | "TON";

// Fallback default rates (real values come from settings + live refresh)
export const XOF_PER_TON = 1400;
export const USD_PER_TON = 2.3;
export const USDT_PER_TON = 2.3;

export function tonToXof(ton: number, rate = XOF_PER_TON): number {
  return Math.round(ton * rate);
}
export function tonToUsd(ton: number, rate = USD_PER_TON): number {
  return Math.round(ton * rate * 100) / 100;
}

export function formatTon(ton: number | string | null | undefined): string {
  const n = typeof ton === "string" ? parseFloat(ton) : ton ?? 0;
  if (!isFinite(n) || n === 0) return "0 TON";
  return `${n < 1 ? n.toFixed(4) : n.toFixed(3)} TON`;
}
export function formatXof(ton: number | string | null | undefined, rate = XOF_PER_TON): string {
  const n = typeof ton === "string" ? parseFloat(ton) : ton ?? 0;
  if (!isFinite(n)) return "0 XOF";
  return `${formatNumber(tonToXof(n, rate))} XOF`;
}
export function formatUsd(ton: number | string | null | undefined, rate = USD_PER_TON): string {
  const n = typeof ton === "string" ? parseFloat(ton) : ton ?? 0;
  if (!isFinite(n)) return "$0";
  return `$${formatNumber(tonToUsd(n, rate), 2)}`;
}
export function formatUsdt(ton: number | string | null | undefined, rate = USDT_PER_TON): string {
  const n = typeof ton === "string" ? parseFloat(ton) : ton ?? 0;
  if (!isFinite(n)) return "0 USDT";
  return `${formatNumber(tonToUsd(n, rate), 2)} USDT`;
}

/** Format a TON amount in the chosen display currency. */
export function formatPrice(
  ton: number,
  currency: Currency,
  rates?: { xof?: number; usd?: number; usdt?: number },
): string {
  if (!isFinite(ton)) ton = 0;
  if (currency === "TON") return formatTon(ton);
  if (currency === "USD") return formatUsd(ton, rates?.usd ?? USD_PER_TON);
  if (currency === "USDT") return formatUsdt(ton, rates?.usdt ?? USDT_PER_TON);
  return formatXof(ton, rates?.xof ?? XOF_PER_TON);
}

export function generateMemo(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += b.toString(36).padStart(2, "0");
  return ("BO" + s).toUpperCase().slice(0, 12);
}

export function generatePublicCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
