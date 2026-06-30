import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ChevronDown, Search, Sparkles, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { listServices } from "@/lib/boostvari.functions";
import { formatTon, formatXof, formatNumber } from "@/lib/format";
import { getPlatform, PLATFORM_ORDER } from "@/lib/platform";

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

type Service = Awaited<ReturnType<typeof listServices>>[number];

function Home() {
  const { data: services } = useSuspenseQuery(servicesQuery);
  const [q, setQ] = useState("");
  const [openPlatform, setOpenPlatform] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const term = q.toLowerCase().trim();
    const map = new Map<string, Service[]>();
    for (const s of services) {
      if (term && !s.name.toLowerCase().includes(term)) continue;
      const p = s.platform || "Autre";
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(s);
    }
    const entries = Array.from(map.entries());
    entries.sort((a, b) => {
      const ia = PLATFORM_ORDER.indexOf(a[0]);
      const ib = PLATFORM_ORDER.indexOf(b[0]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return entries;
  }, [services, q]);

  // Auto-open first matching platform when searching
  const effectiveOpen = q.trim() && grouped[0] ? grouped[0][0] : openPlatform ?? grouped[0]?.[0];

  return (
    <AppShell>
      <section className="mb-6 overflow-hidden rounded-3xl glass-strong p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-sky-400 text-primary-foreground shadow-lg shadow-primary/30">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Boostez vos réseaux. Payez en TON.</h1>
            <p className="mt-1 text-sm text-muted-foreground">Commande automatique, livraison dès paiement détecté on-chain.</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> {services.length} services disponibles
        </div>
      </section>

      <div className="sticky top-[60px] z-20 -mx-4 mb-4 px-4 py-3 glass-soft">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un service…"
            className="w-full rounded-xl border border-white/60 bg-white/70 py-2.5 pl-9 pr-3 text-sm outline-none ring-primary backdrop-blur focus:ring-2"
          />
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl glass p-8 text-center text-sm text-muted-foreground">
          Aucun service. {services.length === 0 && "Demandez à l'admin de synchroniser le catalogue."}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([platform, items]) => {
            const info = getPlatform(platform);
            const Icon = info.icon;
            const isOpen = effectiveOpen === platform;
            return (
              <section key={platform} className="overflow-hidden rounded-2xl glass">
                <button
                  type="button"
                  onClick={() => setOpenPlatform(isOpen ? null : platform)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/40"
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${info.tile} text-white shadow-md`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-base font-semibold">{info.name}</span>
                    <span className="block text-xs text-muted-foreground">{items.length} service{items.length > 1 ? "s" : ""}</span>
                  </span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <ul className="grid gap-2 border-t border-white/60 bg-white/30 p-2 sm:grid-cols-2">
                    {items.map((s) => (
                      <li key={s.id}>
                        <Link
                          to="/service/$id"
                          params={{ id: s.id }}
                          className="flex h-full items-start justify-between gap-3 rounded-xl border border-white/60 bg-white/70 p-3.5 transition hover:border-primary/40 hover:bg-white active:scale-[0.99]"
                        >
                          <div className="min-w-0 flex-1">
                            <h3 className="line-clamp-2 text-sm font-medium leading-snug">{s.name}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Min {formatNumber(s.min_qty)} · Max {formatNumber(s.max_qty)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-sm font-bold text-primary">{formatXof(s.rate_per_1k_ton)}</div>
                            <div className="text-[10px] text-muted-foreground">/ 1000</div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground/70">≈ {formatTon(s.rate_per_1k_ton)}</div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
