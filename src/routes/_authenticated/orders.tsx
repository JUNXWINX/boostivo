import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { ListOrdered, PackageOpen, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getMyOrders, syncMyOrders } from "@/lib/boostvari.functions";
import { useCurrency } from "@/lib/currency";
import { formatNumber, formatPrice } from "@/lib/format";
import { getPlatform } from "@/lib/platform";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Mes commandes — Boostivo" },
      { name: "description", content: "Suivez en temps réel vos commandes SMM Boostivo : statut du paiement TON et progression de la livraison." },
      { property: "og:title", content: "Mes commandes — Boostivo" },
      { property: "og:description", content: "Suivi en temps réel de vos commandes SMM." },
      { property: "og:url", content: "https://boostvari.lovable.app/orders" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://boostvari.lovable.app/orders" }],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const qc = useQueryClient();
  const { currency, rates } = useCurrency();
  const { data: orders = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => getMyOrders(),
    refetchInterval: 20000,
  });
  const syncFn = useServerFn(syncMyOrders);
  const syncMutation = useMutation({
    mutationFn: () => syncFn(),
    onSettled: () => qc.invalidateQueries({ queryKey: ["my-orders"] }),
  });

  // Realtime: invalidate when any of MY orders change
  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null;
      if (!userId) return;
      channel = supabase
        .channel("orders-mine")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
          () => qc.invalidateQueries({ queryKey: ["my-orders"] }),
        )
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [qc]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-3xl glass-strong p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-sky-500 text-white">
              <ListOrdered className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-base font-bold">Mes commandes</h1>
              <p className="text-[11px] text-muted-foreground">Mise à jour en temps réel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium hover:bg-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Synchroniser
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium hover:bg-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-3xl glass-strong p-6 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl glass-strong p-8 text-center">
            <PackageOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucune commande pour le moment.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-full bg-gradient-to-br from-primary to-sky-500 px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Passer ma première commande
            </Link>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {orders.map((o) => {
              const svc = o.service as { name?: string; platform?: string } | null;
              const pi = getPlatform(svc?.platform);
              const PIcon = pi.icon;
              return (
                <li key={o.id} className="rounded-2xl glass-strong p-4">
                  <div className="flex items-start gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${pi.tile} text-white`}>
                      <PIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{svc?.name ?? "Service"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{o.link}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatNumber(o.quantity)} unités · {new Date(o.created_at).toLocaleString("fr-FR")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Code : <span className="font-mono font-semibold">{o.public_code}</span>
                        {o.provider_order_id && <> · Réf. : <span className="font-mono">{o.provider_order_id}</span></>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatPrice(o.amount_ton, currency, rates)}</p>
                      <StatusBadge status={o.status} />
                      {o.status === "pending" && (
                        <Link to="/order/$code" params={{ code: o.public_code }} className="mt-1 block text-[11px] text-primary underline">
                          Payer
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed" || status === "sent" ? "bg-emerald-100 text-emerald-700"
    : status === "paid" ? "bg-sky-100 text-sky-700"
    : status === "pending" ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-700";
  const label =
    status === "completed" ? "Terminée"
    : status === "sent" ? "En cours"
    : status === "paid" ? "Payée"
    : status === "pending" ? "En attente paiement"
    : status === "failed" ? "Échec" : status;
  return <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
}
