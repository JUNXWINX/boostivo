import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Percent, RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { adminListMargins, adminRecalcPrices, adminSaveMargin } from "@/lib/boostvari.functions";

const KIND_LABEL: Record<string, string> = {
  subscribers: "Abonnés",
  members: "Membres",
  likes: "J'aime",
  views: "Vues",
  other: "Autres",
  all: "Tous",
};

export function MarginsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListMargins);
  const saveFn = useServerFn(adminSaveMargin);
  const recalcFn = useServerFn(adminRecalcPrices);
  const { data: margins = [], isLoading } = useQuery({ queryKey: ["admin", "margins"], queryFn: () => listFn() });
  const [draft, setDraft] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (v: { platform: string; kind: string; percent: number }) =>
      saveFn({ data: v as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "margins"] }),
  });
  const recalc = useMutation({ mutationFn: () => recalcFn() });

  const grouped = margins.reduce<Record<string, typeof margins>>((acc, m) => {
    (acc[m.platform] ||= []).push(m);
    return acc;
  }, {});

  return (
    <section className="mt-6 rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Percent className="h-4 w-4" /> Marges par réseau
        </h2>
        <button
          onClick={() => recalc.mutate()}
          disabled={recalc.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {recalc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Recalculer les prix
        </button>
      </div>
      {recalc.data && (
        <p className="mb-3 rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-700">
          {recalc.data.updated} / {recalc.data.total} services recalculés.
        </p>
      )}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([platform, rows]) => (
            <div key={platform}>
              <p className="mb-1 text-xs font-semibold">{platform}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {rows.map((m) => {
                  const key = `${m.platform}|${m.kind}`;
                  const value = draft[key] ?? String(m.percent);
                  return (
                    <div key={key} className="flex items-center gap-2 rounded-lg bg-secondary/50 px-2 py-1.5">
                      <span className="flex-1 text-xs">{KIND_LABEL[m.kind] ?? m.kind}</span>
                      <input
                        aria-label={`Marge ${platform} ${KIND_LABEL[m.kind] ?? m.kind}`}
                        value={value}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value.replace(/[^0-9.]/g, "") })}
                        className="w-20 rounded-md border border-border/60 bg-background px-2 py-1 text-right text-xs"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      <button
                        onClick={() => save.mutate({ platform: m.platform, kind: m.kind, percent: Number(value) })}
                        className="grid h-7 w-7 place-items-center rounded-md bg-primary/20 text-primary hover:bg-primary/30"
                        aria-label="Enregistrer la marge"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Après modification d'une marge, cliquez sur « Recalculer les prix » pour l'appliquer au catalogue.
      </p>
    </section>
  );
}
