import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Printer, Smartphone, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getMyTopups } from "@/lib/boostvari.functions";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/recharges")({
  head: () => ({
    meta: [
      { title: "Mes recharges Mobile Money — Boostivo" },
      { name: "description", content: "Suivez le statut de vos recharges Mobile Money Boostivo, téléchargez vos reçus et exportez votre historique." },
      { property: "og:title", content: "Mes recharges Mobile Money — Boostivo" },
      { property: "og:description", content: "Statut, reçus et export de vos recharges Mobile Money." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RechargesPage,
});

type Topup = Awaited<ReturnType<typeof getMyTopups>>[number];

const STATUS = {
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Validée · créditée", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Refusée", cls: "bg-red-100 text-red-700" },
} as const;

function statusOf(t: Topup) {
  return STATUS[(t.status as keyof typeof STATUS)] ?? { label: t.status, cls: "bg-slate-100 text-slate-700" };
}

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function exportCsv(rows: Topup[]) {
  const head = ["Référence", "Date", "Pays", "Opérateur", "Numéro", "Montant (FCFA)", "Statut", "Décision admin", "Note admin", "Crédité (TON)"];
  const body = rows.map((t) => [
    t.reference ?? t.id.slice(0, 8),
    new Date(t.created_at).toLocaleString("fr-FR"),
    t.country,
    t.operator,
    t.phone,
    t.amount_xof,
    statusOf(t).label,
    t.processed_at ? new Date(t.processed_at).toLocaleString("fr-FR") : "—",
    t.admin_note ?? "",
    t.credited_ton ?? "",
  ]);
  const csv = "\uFEFF" + [head, ...body].map((r) => r.map(csvEscape).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `boostivo-recharges-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Receipt({ t, onClose }: { t: Topup; onClose: () => void }) {
  const st = statusOf(t);
  const rows: [string, string][] = [
    ["Référence", t.reference ?? t.id.slice(0, 8).toUpperCase()],
    ["Date de la demande", new Date(t.created_at).toLocaleString("fr-FR")],
    ["Pays", t.country],
    ["Opérateur", t.operator],
    ["Numéro Mobile Money", t.phone],
    ["Montant envoyé", `${formatNumber(t.amount_xof)} FCFA`],
    ["Statut", st.label],
    ["Décision admin", t.processed_at ? new Date(t.processed_at).toLocaleString("fr-FR") : "En cours de traitement"],
    ["Note de l'admin", t.admin_note ?? "—"],
    ["Solde crédité", t.credited_ton != null ? `${t.credited_ton} TON` : "—"],
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3" role="dialog" aria-label="Reçu de recharge">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl print:shadow-none">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold leading-tight">Reçu de recharge Boostivo</p>
              <p className="text-[11px] text-muted-foreground">{t.reference ?? t.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer le reçu" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100 print:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="divide-y divide-slate-100 px-5 py-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex gap-2 border-t border-slate-200 p-4 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-sky-500 px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Printer className="h-4 w-4" /> Imprimer / PDF
          </button>
          <button onClick={() => exportCsv([t])} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">
            CSV
          </button>
        </div>
      </div>
    </div>
  );
}

function RechargesPage() {
  const { data: topups = [], isLoading } = useQuery({
    queryKey: ["my-topups"],
    queryFn: () => getMyTopups(),
    refetchInterval: 20000,
  });
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [receipt, setReceipt] = useState<Topup | null>(null);

  const rows = useMemo(
    () => (filter === "all" ? topups : topups.filter((t) => t.status === filter)),
    [topups, filter],
  );
  const totalCredited = topups.filter((t) => t.status === "approved").reduce((s, t) => s + t.amount_xof, 0);

  return (
    <AppShell>
      <h1 className="sr-only">Mes recharges Mobile Money</h1>
      <div className="space-y-4">
        <div className="rounded-3xl glass-strong p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                <Smartphone className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold">Mes recharges Mobile Money</h2>
                <p className="text-[11px] text-muted-foreground">
                  {topups.length} demande(s) · {formatNumber(totalCredited)} FCFA validés
                </p>
              </div>
            </div>
            <button
              onClick={() => exportCsv(rows)}
              disabled={rows.length === 0}
              className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Exporter (CSV)
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
            {([
              ["all", "Toutes"],
              ["pending", "En attente"],
              ["approved", "Validées"],
              ["rejected", "Refusées"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1.5 font-medium ${
                  filter === k ? "bg-primary text-primary-foreground" : "bg-white/70 text-foreground/80 hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl glass-strong">
          {isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Chargement…</p>
          ) : rows.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Aucune recharge pour ce filtre.</p>
          ) : (
            <ul className="divide-y divide-white/60">
              {rows.map((t) => {
                const st = statusOf(t);
                return (
                  <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">
                        {formatNumber(t.amount_xof)} FCFA
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                          {t.reference ?? t.id.slice(0, 8).toUpperCase()}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.country} · {t.operator} · <span className="font-mono">{t.phone}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Demandé le {new Date(t.created_at).toLocaleString("fr-FR")}
                        {t.processed_at && ` · traité le ${new Date(t.processed_at).toLocaleString("fr-FR")}`}
                      </p>
                      {t.admin_note && <p className="mt-1 text-[11px] text-muted-foreground">Note admin : {t.admin_note}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                      <button
                        onClick={() => setReceipt(t)}
                        className="flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] font-semibold hover:bg-white"
                      >
                        <FileText className="h-3.5 w-3.5" /> Reçu
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {receipt && <Receipt t={receipt} onClose={() => setReceipt(null)} />}
    </AppShell>
  );
}
