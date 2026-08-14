import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Send, LogOut } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MarginsPanel } from "@/components/admin/MarginsPanel";
import { TopupsPanel } from "@/components/admin/TopupsPanel";
import { WithdrawalsPanel } from "@/components/admin/WithdrawalsPanel";
import { AnnouncementsPanel } from "@/components/admin/AnnouncementsPanel";
import { ReferralPercentPanel } from "@/components/admin/ReferralPercentPanel";
import {
  adminListOrders,
  adminStats,
  adminSyncServices,
  adminRetryOrder,
  adminMarkPaid,
  triggerTonCheck,
} from "@/lib/boostvari.functions";
import { formatTon } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panneau d'administration — Boostivo" },
      { name: "description", content: "Panneau d'administration Boostivo : gérez les commandes, synchronisez les services et suivez les paiements TON." },
      { property: "og:title", content: "Panneau d'administration — Boostivo" },
      { property: "og:description", content: "Gérez les commandes et les services Boostivo." },
      { property: "og:url", content: "https://boostvari.lovable.app/admin" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://boostvari.lovable.app/admin" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListOrders);
  const statsFn = useServerFn(adminStats);
  const syncFn = useServerFn(adminSyncServices);
  const retryFn = useServerFn(adminRetryOrder);
  const markPaidFn = useServerFn(adminMarkPaid);
  const tonFn = useServerFn(triggerTonCheck);

  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => statsFn() });
  const orders = useQuery({ queryKey: ["admin", "orders"], queryFn: () => listFn(), refetchInterval: 10000 });

  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSettled: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
  const tonScan = useMutation({
    mutationFn: () => tonFn(),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (stats.error) {
    return (
      <AppShell>
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
          {(stats.error as Error).message}. Avez-vous le rôle admin ?
          <p className="mt-2 text-xs text-muted-foreground">Si c'est votre premier compte, ouvrez le backend Cloud et ajoutez une ligne dans user_roles (role='admin') pour votre user_id.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell right={
      <button onClick={logout} className="ml-1 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-secondary">
        <LogOut className="h-3.5 w-3.5" /> Quitter
      </button>
    }>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="flex gap-2">
          <button onClick={() => tonScan.mutate()} disabled={tonScan.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50">
            {tonScan.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Scanner TON
          </button>
          <button onClick={() => sync.mutate()} disabled={sync.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {sync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync services
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total" value={stats.data?.total ?? 0} />
        <Stat label="En attente" value={stats.data?.pending ?? 0} />
        <Stat label="Payées" value={stats.data?.paid ?? 0} />
        <Stat label="Revenu" value={formatTon(stats.data?.revenue ?? 0)} />
      </div>

      {sync.data && (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
          {sync.data.upserted} / {sync.data.total} services importés.
        </div>
      )}
      {tonScan.data && (
        <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs">
          Scan TON: {tonScan.data.scanned} txs · {tonScan.data.orderMatches} commandes · {tonScan.data.depositCredits} dépôts · {tonScan.data.pushed} envoyées
        </div>
      )}

      <TopupsPanel />
      <WithdrawalsPanel />
      <MarginsPanel />
      <ReferralPercentPanel />
      <AnnouncementsPanel />

      <h2 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Commandes récentes</h2>
      {orders.isLoading ? (
        <div className="rounded-xl border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">Chargement…</div>
      ) : (orders.data?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">Aucune commande.</div>
      ) : (
        <ul className="space-y-2">
          {orders.data!.map((o: any) => (
            <li key={o.id} className="rounded-xl border border-border/60 bg-card p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to="/order/$code" params={{ code: o.public_code }} className="font-mono text-xs text-primary">#{o.public_code}</Link>
                  <div className="mt-0.5 font-medium">{o.service?.name ?? "—"}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground break-all">{o.link}</div>
                  <div className="mt-0.5 text-xs">Qté: {o.quantity.toLocaleString()} · {formatTon(o.amount_ton)} · mémo <span className="font-mono">{o.memo}</span></div>
                  {o.provider_order_id && <div className="mt-0.5 text-xs text-emerald-300">→ Provider #{o.provider_order_id}</div>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${badge(o.status)}`}>{o.status}</span>
                  {o.status === "pending" && (
                    <button onClick={() => markPaidFn({ data: { id: o.id } }).then(() => qc.invalidateQueries({ queryKey: ["admin"] }))}
                      className="rounded-md bg-secondary px-2 py-1 text-[10px] hover:bg-accent">Marquer payé</button>
                  )}
                  {(o.status === "paid" || o.status === "failed") && (
                    <button onClick={() => retryFn({ data: { id: o.id } }).then(() => qc.invalidateQueries({ queryKey: ["admin"] }))}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/20 px-2 py-1 text-[10px] text-primary hover:bg-primary/30">
                      <Send className="h-3 w-3" /> Envoyer
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function badge(s: string) {
  if (s === "pending") return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  if (s === "paid") return "bg-blue-500/15 text-blue-300 border-blue-500/30";
  if (s === "sent" || s === "completed") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}
