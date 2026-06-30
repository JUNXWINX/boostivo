import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getOrderByCode, triggerTonCheck } from "@/lib/boostvari.functions";
import { formatTon } from "@/lib/format";

const orderQuery = (code: string) =>
  queryOptions({
    queryKey: ["order", code],
    queryFn: () => getOrderByCode({ data: { code } }),
    refetchInterval: 8000,
  });

export const Route = createFileRoute("/order/$code")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(orderQuery(params.code)),
  component: OrderPage,
  errorComponent: ({ error }) => (
    <AppShell><div className="p-6 text-destructive">{error.message}</div></AppShell>
  ),
  notFoundComponent: () => <AppShell><div>Commande introuvable</div></AppShell>,
});

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground hover:bg-accent"
      aria-label="Copier"
    >
      {copied ? <Check className="h-4 w-4 text-[oklch(0.7_0.18_150)]" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function statusLabel(s: string) {
  return {
    pending: "En attente du paiement",
    paid: "Paiement reçu — envoi en cours",
    sent: "Envoyé au fournisseur",
    completed: "Terminé",
    failed: "Échec",
    cancelled: "Annulée",
  }[s] ?? s;
}

function statusColor(s: string) {
  if (s === "pending") return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  if (s === "paid") return "bg-blue-500/20 text-blue-300 border-blue-500/40";
  if (s === "sent" || s === "completed") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (s === "failed" || s === "cancelled") return "bg-destructive/20 text-destructive border-destructive/40";
  return "bg-secondary";
}

function OrderPage() {
  const { code } = Route.useParams();
  const qc = useQueryClient();
  const { data: order } = useQuery(orderQuery(code));
  const tonCheckFn = useServerFn(triggerTonCheck);
  const checkMutation = useMutation({
    mutationFn: () => tonCheckFn(),
    onSettled: () => qc.invalidateQueries({ queryKey: ["order", code] }),
  });

  if (!order) return <AppShell><div>Chargement…</div></AppShell>;

  const tonLink = order.ton_address
    ? `ton://transfer/${order.ton_address}?amount=${Math.round(order.amount_ton * 1e9)}&text=${encodeURIComponent(order.memo)}`
    : "";

  const svcInfo = order.service as { name?: string; platform?: string } | null;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Commande</p>
              <h1 className="text-xl font-bold">#{order.public_code}</h1>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColor(order.status)}`}>
              {statusLabel(order.status)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Service</p>
              <p className="font-medium">{svcInfo?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Quantité</p>
              <p className="font-medium">{order.quantity.toLocaleString()}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Lien</p>
              <p className="break-all text-xs">{order.link}</p>
            </div>
          </div>
        </div>

        {order.status === "pending" && (
          <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-transparent p-5 shadow-xl">
            <h2 className="text-base font-semibold">Paiement TON</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Envoyez exactement <strong className="text-primary">{formatTon(order.amount_ton)}</strong> avec le mémo ci-dessous. Détection automatique sous 30s.
            </p>

            {tonLink && (
              <div className="mt-4 grid place-items-center rounded-xl bg-white p-3">
                <QRCodeSVG value={tonLink} size={180} level="M" />
              </div>
            )}

            <div className="mt-4 space-y-3">
              <Field label="Adresse" value={order.ton_address} mono />
              <Field label="Mémo (obligatoire)" value={order.memo} highlight mono />
              <Field label="Montant exact" value={`${order.amount_ton} TON`} mono />
            </div>

            {tonLink && (
              <a
                href={tonLink}
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-primary/50 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/20"
              >
                Ouvrir dans un wallet TON
              </a>
            )}

            <button
              onClick={() => checkMutation.mutate()}
              disabled={checkMutation.isPending}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              {checkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Vérifier maintenant
            </button>
          </div>
        )}

        {(order.status === "sent" || order.status === "completed") && order.provider_order_id && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
            ID fournisseur: <span className="font-mono text-emerald-300">{order.provider_order_id}</span>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${highlight ? "border-primary/60 bg-primary/10" : "border-border bg-input"}`}>
        <span className={`flex-1 break-all text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
        <CopyButton value={value} />
      </div>
    </div>
  );
}
