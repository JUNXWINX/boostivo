import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Download, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { adminListTopups, adminReviewTopup } from "@/lib/boostvari.functions";
import { formatNumber } from "@/lib/format";

type Row = Awaited<ReturnType<typeof adminListTopups>>[number];

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function exportCsv(rows: Row[]) {
  const head = ["Référence", "Date", "Utilisateur", "Pays", "Opérateur", "Numéro", "Montant (FCFA)", "Statut", "Traité le", "Note admin", "Crédité (TON)"];
  const body = rows.map((t) => [
    t.reference ?? t.id.slice(0, 8),
    new Date(t.created_at).toLocaleString("fr-FR"),
    t.username,
    t.country,
    t.operator,
    t.phone,
    t.amount_xof,
    t.status,
    t.processed_at ? new Date(t.processed_at).toLocaleString("fr-FR") : "",
    t.admin_note ?? "",
    t.credited_ton ?? "",
  ]);
  const csv = "\uFEFF" + [head, ...body].map((r) => r.map(csvEscape).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `boostivo-recharges-admin-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TopupsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListTopups);
  const reviewFn = useServerFn(adminReviewTopup);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const { data: topups = [], isLoading } = useQuery({
    queryKey: ["admin", "topups"],
    queryFn: () => listFn(),
    refetchInterval: 15000,
  });

  const review = useMutation({
    mutationFn: (v: { id: string; approve: boolean; note?: string }) => reviewFn({ data: v as never }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin", "topups"] }),
  });

  const rows = filter === "pending" ? topups.filter((t) => t.status === "pending") : topups;
  const pendingCount = topups.filter((t) => t.status === "pending").length;

  return (
    <section className="mt-6 rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Smartphone className="h-4 w-4" /> Recharges Mobile Money
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-600">{pendingCount} en attente</span>
          )}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter(filter === "pending" ? "all" : "pending")}
            className="rounded-md border border-border/60 px-2 py-1 text-[11px]"
          >
            {filter === "pending" ? "Voir tout" : "En attente seulement"}
          </button>
          <button
            onClick={() => exportCsv(topups)}
            disabled={topups.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] disabled:opacity-50"
          >
            <Download className="h-3 w-3" /> CSV
          </button>
        </div>
      </div>

      {review.error && (
        <p className="mb-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{(review.error as Error).message}</p>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune demande.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li key={t.id} className="rounded-lg bg-secondary/40 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {formatNumber(t.amount_xof)} FCFA · @{t.username}
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">{t.reference ?? ""}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.country} · {t.operator} · <span className="font-mono">{t.phone}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("fr-FR")}
                    {t.credited_ton != null && ` · crédité ${t.credited_ton} TON`}
                  </p>
                  {t.admin_note && <p className="text-[11px] text-muted-foreground">Note : {t.admin_note}</p>}
                </div>
                {t.status !== "pending" && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                    t.status === "approved" ? "bg-emerald-500/15 text-emerald-600" : "bg-destructive/15 text-destructive"
                  }`}>
                    {t.status === "approved" ? "validée" : "refusée"}
                  </span>
                )}
              </div>

              {t.status === "pending" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={notes[t.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [t.id]: e.target.value }))}
                    placeholder="Note (optionnelle) visible par le client"
                    aria-label="Note admin"
                    className="min-w-[180px] flex-1 rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => review.mutate({ id: t.id, approve: true, note: notes[t.id] })}
                    disabled={review.isPending}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1.5 text-[11px] text-emerald-600 hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" /> Valider & créditer
                  </button>
                  <button
                    onClick={() => review.mutate({ id: t.id, approve: false, note: notes[t.id] })}
                    disabled={review.isPending}
                    className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1.5 text-[11px] text-destructive hover:bg-destructive/25 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Refuser
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
