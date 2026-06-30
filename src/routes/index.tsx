import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Info, Loader2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createOrder, listServices } from "@/lib/boostvari.functions";
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

// Decode HTML entities (provider returns &#039; etc.)
function decode(s: string): string {
  return s
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Extract quality / variant label from name (text in trailing parentheses)
function extractVariant(name: string): { base: string; variant: string } {
  const n = decode(name).trim();
  const m = n.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (m) return { base: m[1].trim(), variant: m[2].trim() };
  return { base: n, variant: "Standard" };
}

function groupKey(s: Service): string {
  return (s.category && s.category.trim()) || extractVariant(s.name).base;
}

function Home() {
  const { data: services } = useSuspenseQuery(servicesQuery);
  const navigate = useNavigate();
  const createFn = useServerFn(createOrder);

  // Group: platform -> serviceGroup (category) -> variants[]
  const byPlatform = useMemo(() => {
    const map = new Map<string, Map<string, Service[]>>();
    for (const s of services) {
      const p = s.platform || "Autre";
      if (!map.has(p)) map.set(p, new Map());
      const g = map.get(p)!;
      const key = groupKey(s);
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(s);
    }
    return map;
  }, [services]);

  const platforms = useMemo(() => {
    const list = Array.from(byPlatform.keys());
    list.sort((a, b) => {
      const ia = PLATFORM_ORDER.indexOf(a);
      const ib = PLATFORM_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return list;
  }, [byPlatform]);

  const [platform, setPlatform] = useState<string>("");
  useEffect(() => {
    if (!platform && platforms[0]) setPlatform(platforms[0]);
  }, [platforms, platform]);

  const groups = byPlatform.get(platform) ?? new Map<string, Service[]>();
  const groupNames = useMemo(() => Array.from(groups.keys()).sort(), [groups]);

  const [serviceGroup, setServiceGroup] = useState<string>("");
  useEffect(() => { setServiceGroup(groupNames[0] ?? ""); }, [platform, groupNames.join("|")]);

  const variants = groups.get(serviceGroup) ?? [];
  const variantOpts = useMemo(
    () => variants.map((v) => ({ svc: v, ...extractVariant(v.name) })).sort((a, b) => Number(a.svc.rate_per_1k_ton) - Number(b.svc.rate_per_1k_ton)),
    [variants],
  );

  const [variantId, setVariantId] = useState<string>("");
  useEffect(() => { setVariantId(variantOpts[0]?.svc.id ?? ""); }, [serviceGroup, variantOpts.length]);

  const selected = variantOpts.find((v) => v.svc.id === variantId)?.svc ?? variantOpts[0]?.svc;
  const info = getPlatform(platform);
  const Icon = info.icon;

  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState(0);
  useEffect(() => { if (selected) setQuantity(selected.min_qty); }, [selected?.id]);

  const price = useMemo(
    () => (selected ? (Number(selected.rate_per_1k_ton) * quantity) / 1000 : 0),
    [selected, quantity],
  );

  const mutation = useMutation({
    mutationFn: () => createFn({ data: { service_id: selected!.id, link, quantity } }),
    onSuccess: (res) => navigate({ to: "/order/$code", params: { code: res.public_code } }),
  });

  const valid = !!selected && link.trim().length > 5 && quantity >= selected.min_qty && quantity <= selected.max_qty;

  return (
    <AppShell>
      <section className="mb-5 overflow-hidden rounded-3xl glass-strong p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-sky-400 text-primary-foreground shadow-lg shadow-primary/30">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">Boostez vos réseaux. Payez en TON.</h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Commande automatique, livraison dès paiement détecté on-chain.</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> {services.length} services · {platforms.length} réseaux
        </div>
      </section>

      {/* Platform icons row */}
      <div className="mb-5 rounded-3xl glass p-3">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Choisissez votre réseau
        </p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {platforms.map((p) => {
            const pi = getPlatform(p);
            const PIcon = pi.icon;
            const active = p === platform;
            return (
              <button
                key={p}
                type="button"
                aria-label={pi.name}
                title={pi.name}
                onClick={() => setPlatform(p)}
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${pi.tile} text-white transition ${
                  active
                    ? "scale-105 ring-2 ring-primary ring-offset-2 ring-offset-white shadow-lg"
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                <PIcon className="h-7 w-7" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Configurator */}
      {selected ? (
        <form
          onSubmit={(e) => { e.preventDefault(); if (valid) mutation.mutate(); }}
          className="overflow-hidden rounded-3xl glass-strong"
        >
          <div className="flex items-center gap-3 border-b border-white/60 p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${info.tile} text-white shadow-md`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Réseau</div>
              <div className="text-base font-bold">{info.name}</div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            {/* Service select */}
            <Field label="Service">
              <Select
                value={serviceGroup}
                onChange={setServiceGroup}
                options={groupNames.map((g) => ({ value: g, label: decode(g) }))}
              />
            </Field>

            {/* Type / quality select — only when multiple variants */}
            {variantOpts.length > 1 && (
              <Field label="Type / Qualité">
                <Select
                  value={variantId}
                  onChange={setVariantId}
                  options={variantOpts.map((v) => ({
                    value: v.svc.id,
                    label: `${v.variant} — ${formatXof(v.svc.rate_per_1k_ton)} / 1k`,
                  }))}
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {variantOpts.length} qualités disponibles, prix par 1000.
                </p>
              </Field>
            )}

            {/* Link */}
            <Field label={`Lien ${info.name === "Autre" ? "" : info.name}`}>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={info.placeholder}
                required
                className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
              />
              <p className="mt-1.5 flex items-start gap-1 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0" /> {info.hint}
              </p>
            </Field>

            {/* Quantity */}
            <Field label={`Quantité (${formatNumber(selected.min_qty)} – ${formatNumber(selected.max_qty)})`}>
              <input
                type="number"
                min={selected.min_qty}
                max={selected.max_qty}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(selected.min_qty, parseInt(e.target.value) || 0))}
                className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[selected.min_qty, 100, 500, 1000, 5000, 10000]
                  .filter((v, i, a) => v >= selected.min_qty && v <= selected.max_qty && a.indexOf(v) === i)
                  .slice(0, 6)
                  .map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setQuantity(v)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                        quantity === v ? "bg-primary text-primary-foreground" : "bg-white/70 text-foreground hover:bg-white"
                      }`}
                    >
                      {formatNumber(v)}
                    </button>
                  ))}
              </div>
            </Field>

            {/* Total */}
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-sky-200/40 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Total à payer</span>
                <span className="text-2xl font-bold text-primary">{formatXof(price)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{formatXof(selected.rate_per_1k_ton)} / 1 000</span>
                <span>≈ {formatTon(price)}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-white/60 p-3 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>Paiement on-chain en TON. Commande envoyée auto au fournisseur dès détection (≈ 30 sec).</span>
            </div>

            {mutation.isError && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {(mutation.error as Error).message}
              </div>
            )}

            <button
              type="submit"
              disabled={!valid || mutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-primary to-sky-500 px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-50"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Commander
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl glass p-8 text-center text-sm text-muted-foreground">
          Aucun service disponible pour ce réseau.
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-foreground/80">{label}</label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 pr-9 text-sm outline-none ring-primary focus:ring-2"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
