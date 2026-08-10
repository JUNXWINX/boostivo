import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM = `Tu es l'assistant de Boostivo, un panel SMM (followers, likes, vues, abonnés) pour Instagram, TikTok, Telegram, YouTube, Facebook, WhatsApp et plus.
Réponds toujours en français, de façon courte, claire et amicale (2 à 5 phrases max).
Infos utiles :
- Recharge Mobile Money : l'utilisateur choisit son pays et son opérateur (MTN, MOOV, Orange, Wave, T-Money...), envoie l'argent au numéro affiché, puis remplit le formulaire avec SON numéro Mobile Money et le montant (minimum 100 FCFA). Un admin valide et le solde est crédité.
- Recharge crypto : TON ou USDT vers l'adresse affichée dans le Portefeuille, en collant OBLIGATOIREMENT le memo personnel, sinon le dépôt est perdu.
- Commander : page Acheter → réseau social → service → type/qualité → lien → quantité → payer avec le solde.
- Suivi : page « Mes commandes » avec statut et progression.
Si tu ne sais pas, invite l'utilisateur à contacter le support.`;

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

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "system", content: SYSTEM }, ...data.messages],
      }),
    });

    if (res.status === 429) return { reply: "Trop de demandes en même temps, réessaie dans quelques secondes." };
    if (res.status === 402) return { reply: "L'assistant est momentanément indisponible. Contacte le support." };
    if (!res.ok) return { reply: "Je n'arrive pas à répondre pour l'instant, réessaie." };

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim();
    return { reply: reply || "Je n'ai pas compris, peux-tu reformuler ?" };
  });
