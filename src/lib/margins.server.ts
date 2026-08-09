// Server-only: per-platform / per-service-kind margin resolution
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ServiceKind = "subscribers" | "members" | "likes" | "views" | "other";

export function guessKind(text: string): ServiceKind {
  const t = text.toLowerCase();
  if (/\b(member|members|membre|membres)\b/.test(t)) return "members";
  if (/(subscriber|abonn|follower|suiveur)/.test(t)) return "subscribers";
  if (/(like|j'aime|jaime|favorite)/.test(t)) return "likes";
  if (/(view|vue|vues|reel|story|watch)/.test(t)) return "views";
  return "other";
}

export type MarginRow = { platform: string; kind: string; percent: number };

export async function loadMargins(): Promise<MarginRow[]> {
  const { data } = await supabaseAdmin.from("margins").select("platform, kind, percent");
  return (data ?? []).map((m) => ({ platform: m.platform, kind: m.kind, percent: Number(m.percent) }));
}

/** Returns the multiplier (1 + percent/100) to apply on the provider cost. */
export function resolveMargin(margins: MarginRow[], platform: string, kind: ServiceKind): number {
  const find = (p: string, k: string) => margins.find((m) => m.platform === p && m.kind === k)?.percent;
  const pct =
    find(platform, kind) ??
    find(platform, "other") ??
    find(platform, "all") ??
    find("Autre", "all") ??
    75;
  return 1 + pct / 100;
}

/** Round a TON price so displayed FCFA stays clean. */
export function roundTon(ton: number): number {
  return Math.round(ton * 1e6) / 1e6;
}
