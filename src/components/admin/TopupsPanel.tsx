import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Smartphone, X } from "lucide-react";
import { adminListTopups, adminReviewTopup } from "@/lib/boostvari.functions";
import { formatNumber } from "@/lib/format";

export function TopupsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListTopups);
  const reviewFn = useServerFn(adminReviewTopup);
  const { data: topups = [], isLoading } = useQuery({
    queryKey: ["admin", "topups"],
    queryFn: () => listFn(),
    refetchInterval: 15000,
  });

  const review = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => reviewFn({ data: v as never }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin", "topups"] }),
  });

  return (
    <section className="mt-6 rounded-xl border border-border/60 bg-card p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Smartphone className="h-4 w-4" /> Recharges Mobile Money
      </h2>
      {review.error && (
        <p className="mb-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{(review.error as Error).message}</p>
      )}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : topups.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune demande.</p>
      ) : (
        <ul className="space-y-2">
          {topups.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 rounded-lg bg-secondary/40 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">{formatNumber(t.amount_xof)} FCFA · @{t.username}</p>
                <p className="text-xs text-muted-foreground">{t.country} · {t.operator} · <span className="font-mono">{t.phone}</span></p>
                <p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")}</p>
              </div>
              {t.status === "pending" ? (
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => review.mutate({ id: t.id, approve: true })}
                    disabled={review.isPending}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-600 hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" /> Valider
                  </button>
                  <button
                    onClick={() => review.mutate({ id: t.id, approve: false })}
                    disabled={review.isPending}
                    className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/25 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Refuser
                  </button>
                </div>
              ) : (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                  t.status === "approved" ? "bg-emerald-500/15 text-emerald-600" : "bg-destructive/15 text-destructive"
                }`}>
                  {t.status === "approved" ? "validée" : "refusée"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
