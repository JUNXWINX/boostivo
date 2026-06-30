import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Search, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { listServices } from "@/lib/boostvari.functions";
import { formatTon } from "@/lib/format";

const servicesQuery = queryOptions({
  queryKey: ["services"],
  queryFn: () => listServices(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Boostvari — SMM Panel automatique en TON" },
      { name: "description", content: "Achetez followers, likes, vues. Paiement TON, livraison auto." },
      { property: "og:title", content: "Boostvari — SMM Panel TON" },
      { property: "og:description", content: "Followers, likes, vues — paiement TON, livraison instantanée." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(servicesQuery),
  component: Home,
  errorComponent: ({ error }) => (
    <AppShell><div className="p-6 text-destructive">Erreur: {error.message}</div></AppShell>
  ),
  notFoundComponent: () => <AppShell><div>Introuvable</div></AppShell>,
});

function Home() {
  const { data: services } = useSuspenseQuery(servicesQuery);
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<string>("all");

  const platforms = useMemo(() => {
    const s = new Set<string>();
    for (const sv of services) if (sv.platform) s.add(sv.platform);
    return ["all", ...Array.from(s).sort()];
  }, [services]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return services.filter((s) => {
      if (platform !== "all" && s.platform !== platform) return false;
      if (term && !s.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [services, q, platform]);

  return (
    <AppShell>
      <section className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Boostez vos réseaux. Payez en TON.</h1>
            <p className="mt-1 text-sm text-muted-foreground">Commande automatique, livraison dès paiement détecté on-chain.</p>
          </div>
        </div>
      </section>

      <div className="sticky top-[57px] z-20 -mx-4 mb-4 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un service…"
            className="w-full rounded-xl border border-border bg-input py-2.5 pl-9 pr-3 text-sm outline-none ring-primary focus:ring-2"
          />
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {platforms.map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                platform === p ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {p === "all" ? "Tous" : p}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          Aucun service. {services.length === 0 && "Demandez à l'admin de synchroniser le catalogue."}
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {filtered.map((s) => (
            <li key={s.id}>
              <Link
                to="/service/$id"
                params={{ id: s.id }}
                className="flex h-full items-start justify-between gap-3 rounded-xl border border-border/60 bg-card p-3.5 transition hover:border-primary/60 hover:bg-card/80 active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {s.platform || "—"}
                    </span>
                  </div>
                  <h3 className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{s.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Min {s.min_qty.toLocaleString()} · Max {s.max_qty.toLocaleString()}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold text-primary">{formatTon(s.rate_per_1k_ton)}</div>
                  <div className="text-[10px] text-muted-foreground">/ 1000</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
