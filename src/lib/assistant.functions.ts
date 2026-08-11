import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE_SYSTEM = `Tu es l'assistant officiel de Boostivo, un panel SMM (followers, likes, vues, abonnés) pour Instagram, TikTok, Telegram, YouTube, Facebook, WhatsApp et plus.
Réponds toujours en français, de façon courte, claire et amicale (2 à 6 phrases max).
Utilise EXCLUSIVEMENT les données réelles du site fournies ci-dessous pour parler de services, prix, délais et paiements. N'invente jamais un prix, un délai ou un service : si l'information n'est pas dans les données, dis-le et invite à regarder la page « Acheter » ou à contacter le support.
Donne toujours les prix en FCFA (XOF) pour 1 000 unités, et précise le délai moyen quand il est connu.

Fonctionnement du site :
- Recharge Mobile Money : pays → opérateur → son propre numéro Mobile Money → montant (minimum 100 FCFA) → Confirmer. Un admin valide, le solde est crédité automatiquement et un reçu est disponible dans « Mes recharges ».
- Recharge crypto : TON ou USDT vers l'adresse affichée dans le Portefeuille, avec OBLIGATOIREMENT le memo personnel, sinon le dépôt est perdu. Crédit automatique.
- Commander : page Acheter → réseau social → service → type/qualité → lien → quantité → paiement avec le solde du compte.
- Suivi : page « Mes commandes » (statut + progression) ; recharges Mobile Money : page « Mes recharges » (en attente / validée / refusée).`;

type Svc = {
  name: string; platform: string | null; type: string | null;
  rate_per_1k_ton: number; min_qty: number; max_qty: number; avg_time: string | null;
};

async function buildContext(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: settings }, { data: services }] = await Promise.all([
    supabaseAdmin.from("settings").select("key, value").in("key", ["xof_per_ton", "usd_per_ton", "momo_accounts"]),
    supabaseAdmin
      .from("services")
      .select("name, platform, type, rate_per_1k_ton, min_qty, max_qty, avg_time")
      .eq("active", true)
      .order("platform", { ascending: true })
      .limit(400),
  ]);

  const map = new Map((settings ?? []).map((s) => [s.key, s.value]));
  const xof = Number(map.get("xof_per_ton") ?? 3300) || 3300;
  const usd = Number(map.get("usd_per_ton") ?? 2.3) || 2.3;

  let momo = "";
  try {
    const parsed = JSON.parse(String(map.get("momo_accounts") ?? "[]")) as {
      country: string; operator: string;
    }[];
    const byCountry = new Map<string, string[]>();
    for (const a of parsed) {
      byCountry.set(a.country, [...(byCountry.get(a.country) ?? []), a.operator]);
    }
    momo = [...byCountry.entries()].map(([c, ops]) => `${c} : ${ops.join(", ")}`).join(" | ");
  } catch { /* ignore */ }

  const byPlatform = new Map<string, Svc[]>();
  for (const s of (services ?? []) as Svc[]) {
    const p = s.platform || "Autre";
    byPlatform.set(p, [...(byPlatform.get(p) ?? []), s]);
  }

  const lines: string[] = [];
  for (const [platform, list] of byPlatform) {
    lines.push(`\n## ${platform}`);
    for (const s of list.slice(0, 40)) {
      const price = Math.round(Number(s.rate_per_1k_ton) * xof);
      lines.push(
        `- ${s.name}${s.type ? ` (${s.type})` : ""} : ${price.toLocaleString("fr-FR")} FCFA / 1k · min ${s.min_qty} · max ${s.max_qty}${s.avg_time ? ` · délai moyen ${s.avg_time}` : ""}`,
      );
    }
  }

  return `\n\n=== DONNÉES RÉELLES DU SITE (source de vérité) ===
Taux : 1 TON = ${xof.toLocaleString("fr-FR")} FCFA ≈ ${usd} USD.
Opérateurs Mobile Money disponibles : ${momo || "voir la page Portefeuille"}.
Catalogue des services actifs (prix TTC affichés au client, pour 1 000 unités) :${lines.join("\n")}
=== FIN DES DONNÉES ===`;
}

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().trim().min(1).max(2000),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { reply: "Assistant indisponible pour le moment." };

    let context = "";
    try {
      context = await buildContext();
    } catch {
      context = "";
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "system", content: BASE_SYSTEM + context }, ...data.messages],
      }),
    });

    if (res.status === 429) return { reply: "Trop de demandes en même temps, réessaie dans quelques secondes." };
    if (res.status === 402) return { reply: "L'assistant est momentanément indisponible. Contacte le support." };
    if (!res.ok) return { reply: "Je n'arrive pas à répondre pour l'instant, réessaie." };

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim();
    return { reply: reply || "Je n'ai pas compris, peux-tu reformuler ?" };
  });
