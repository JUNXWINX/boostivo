import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { adminSetReferralPercent, getReferralPercentSetting } from "@/lib/boostvari.functions";

export function ReferralPercentPanel() {
  const qc = useQueryClient();
  const getFn = useServerFn(getReferralPercentSetting);
  const setFn = useServerFn(adminSetReferralPercent);
  const { data } = useQuery({ queryKey: ["referral-percent"], queryFn: () => getFn() });
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? (data ? String(data.percent) : "");

  const save = useMutation({
    mutationFn: () => setFn({ data: { percent: Number(value) } as never }),
    onSuccess: () => {
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["referral-percent"] });
      qc.invalidateQueries({ queryKey: ["my-referral"] });
    },
  });

  return (
    <section className="mt-6 rounded-xl border border-border/60 bg-card p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Gift className="h-4 w-4" /> Pourcentage de parrainage
      </h2>
      <div className="flex items-center gap-2">
        <label htmlFor="ref-percent" className="text-xs text-muted-foreground">
          Gain du parrain sur chaque commande d'un filleul
        </label>
        <input
          id="ref-percent"
          value={value}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
          className="w-20 rounded-md border border-border/60 bg-background px-2 py-1 text-right text-sm"
        />
        <span className="text-xs text-muted-foreground">%</span>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || !(Number(value) >= 0 && Number(value) <= 90)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Enregistrer
        </button>
      </div>
      {save.error && <p className="mt-2 text-xs text-destructive">{(save.error as Error).message}</p>}
      <p className="mt-2 text-[11px] text-muted-foreground">
        La nouvelle valeur s'applique immédiatement partout sur le site (page Parrainage, calcul des commissions des prochaines commandes).
      </p>
    </section>
  );
}
