import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useSuspenseQuery, queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createOrder, getMyProfile, getRates, listServices } from "@/lib/boostvari.functions";
import { formatNumber, formatPrice, formatTon } from "@/lib/format";
import { getPlatform, getServiceRemarks, PLATFORM_ORDER } from "@/lib/platform";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";

const servicesQuery = queryOptions({ queryKey: ["services"], queryFn: () => listServices() });
const ratesQuery = queryOptions({ queryKey: ["rates"], queryFn: () => getRates() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Boostivo — SMM Panel avec paiements TON" },
      { name: "description", content: "Boostivo : SMM panel automatique. Achetez followers, likes et vues sur Instagram, TikTok, Telegram, YouTube. Paiement TON, livraison en quelques minutes." },
      { property: "og:title", content: "Boostivo — SMM Panel avec paiements TON" },
      { property: "og:description", content: "Followers, likes, vues. Paiement TON, livraison automatique." },
      { property: "og:url", content: "https://boostvari.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://boostvari.lovable.app/" }],
  }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(servicesQuery),
    context.queryClient.ensureQueryData(ratesQuery),
  ]),
  component: Home,
  errorComponent: ({ error }) => (<AppShell><div className="p-6 text-destructive">Erreur: {error.message}</div></AppShell>),
  notFoundComponent: () => <AppShell><div>Introuvable</div></AppShell>,
});

type Service = Awaited<ReturnType<typeof listServices>>[number];

function decode(s: string): string {
  return s.replace(/&#0?39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
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
  const { data: rates } = useSuspenseQuery(ratesQuery);
  const { currency } = useCurrency();
  const navigate = useNavigate();
  const createFn = useServerFn(createOrder);

  // signed-in?
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
    enabled: signedIn === true,
  });

  // Group: platform -> category -> variants[]
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
  useEffect(() => { if (!platform && platforms[0]) setPlatform(platforms[0]); }, [platforms, platform]);

  const groups = byPlatform.get(platform) ?? new Map<string, Service[]>();
  const groupNames = useMemo(() => Array.from(groups.keys()).sort(), [groups]);

  const [serviceGroup, setServiceGroup] = useState<string>("");
  useEffect(() => { setServiceGroup(groupNames[0] ?? ""); /* eslint-disable-next-line */ }, [platform, groupNames.join("|")]);

  const variants = groups.get(serviceGroup) ?? [];
  const variantOpts = useMemo(
    () => variants.map((v) => ({ svc: v, ...extractVariant(v.name) }))
      .sort((a, b) => Number(a.svc.rate_per_1k_ton) - Number(b.svc.rate_per_1k_ton)),
    [variants],
  );

  const [variantId, setVariantId] = useState<string>("");
  useEffect(() => { setVariantId(variantOpts[0]?.svc.id ?? ""); /* eslint-disable-next-line */ }, [serviceGroup, variantOpts.length]);

  const selected = variantOpts.find((v) => v.svc.id === variantId)?.svc ?? variantOpts[0]?.svc;
  const info = getPlatform(platform);
  const Icon = info.icon;

  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  useEffect(() => { if (selected) setQuantity(selected.min_qty); }, [selected?.id]);

  const priceTon = useMemo(
    () => (selected ? (Number(selected.rate_per_1k_ton) * Math.max(0, quantity)) / 1000 : 0),
    [selected, quantity],
  );
  const rateRow = selected ? Number(selected.rate_per_1k_ton) : 0;
  const balanceTon = profile ? Number(profile.balance_ton) : 0;
  const canPayFromBalance = signedIn && balanceTon >= priceTon && priceTon > 0;

  const mutation = useMutation({
    mutationFn: () => createFn({ data: { service_id: selected!.id, link, quantity } }),
    onSuccess: (res) => {
      if (res.paid_with_balance) navigate({ to: "/orders" });
      else if (signedIn) navigate({ to: "/orders" });
      else navigate({ to: "/order/$code", params: { code: res.public_code } });
    },
  });

  const valid = !!selected && link.trim().length > 5 && quantity >= selected.min_qty && quantity <= selected.max_qty;

  return (
    <AppShell>
      <h1 className="sr-only">Boostivo : SMM Panel avec paiements TON</h1>
      {/* Network picker */}
      <div className="mb-4 rounded-3xl glass-strong p-4">
        <p className="mb-3 text-center text-[12px] font-bold uppercase tracking-wider text-foreground/80">
          Choisissez votre réseau social cible :
        </p>
        <div className="flex flex-wrap justify-center gap-2">
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
                className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${pi.tile} text-white transition ${
                  active ? "scale-110 ring-2 ring-primary ring-offset-2 ring-offset-white shadow-lg" : "opacity-70 hover:opacity-100"
                }`}
              >
                <PIcon className="h-6 w-6" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Form */}
      {selected ? (
        <form onSubmit={(e) => { e.preventDefault(); if (valid) mutation.mutate(); }} className="space-y-4">
          <Field label="Service :">
            <Select
              value={serviceGroup}
              onChange={setServiceGroup}
              options={groupNames.map((g) => ({ value: g, label: decode(g) }))}
              accent
            />
          </Field>

          {variantOpts.length > 1 && (
            <Field label="Type :">
              <Select
                value={variantId}
                onChange={setVariantId}
                options={variantOpts.map((v) => ({
                  value: v.svc.id,
                  label: `${v.variant} — ${formatPrice(Number(v.svc.rate_per_1k_ton), currency, { xof: rates.xof_per_ton, usd: rates.usd_per_ton })} / 1k`,
                }))}
              />
            </Field>
          )}

          <Field label={`Le lien du compte ${info.name} :`}>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={info.placeholder}
              required
              className="w-full rounded-xl border border-white/70 bg-white/90 px-3 py-3 text-sm outline-none ring-primary focus:ring-2"
            />
          </Field>

          <Field label="Quantité :">
            <input
              type="number"
              min={selected.min_qty}
              max={selected.max_qty}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-xl border border-white/70 bg-white/90 px-3 py-3 text-sm outline-none ring-primary focus:ring-2"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              (Min : {formatNumber(selected.min_qty)} – Max : {formatNumber(selected.max_qty)})
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[selected.min_qty, 500, 1000, 5000, 10000, 50000]
                .filter((v, i, a) => v >= selected.min_qty && v <= selected.max_qty && a.indexOf(v) === i)
                .slice(0, 6)
                .map((v) => (
                  <button
                    type="button" key={v} onClick={() => setQuantity(v)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      quantity === v ? "bg-primary text-primary-foreground" : "bg-white/70 hover:bg-white"
                    }`}
                  >
                    {formatNumber(v)}
                  </button>
                ))}
            </div>
          </Field>

          {/* Price */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl glass p-4">
            <span className="text-sm font-bold">Prix :</span>
            <span className="rounded-lg bg-emerald-500 px-4 py-2 text-lg font-bold text-white shadow">
              {formatPrice(priceTon, currency, { xof: rates.xof_per_ton, usd: rates.usd_per_ton })}
            </span>
            <span className="text-xs text-muted-foreground">≈ {formatTon(priceTon)}</span>
            <div className="basis-full text-xs text-muted-foreground">
              ({formatPrice(rateRow, currency, { xof: rates.xof_per_ton, usd: rates.usd_per_ton })} / 1k {decode(serviceGroup).toLowerCase()})
            </div>
          </div>

          {/* Remark — adapté au service sélectionné */}
          <div className="rounded-2xl glass p-4">
            <p className="text-sm font-bold">Remarque :</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs text-foreground/80">
              {getServiceRemarks(platform, selected.name).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
          </div>

          {mutation.isError && (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {(mutation.error as Error).message}
            </div>
          )}

          {/* Sticky CTA */}
          <div className="sticky bottom-3 z-20">
            <button
              type="submit"
              disabled={!valid || mutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-primary to-sky-500 px-4 py-4 text-base font-bold text-primary-foreground shadow-xl shadow-primary/30 transition active:scale-[0.98] disabled:opacity-50"
            >
              {mutation.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
              {canPayFromBalance ? "Commander (payer avec mon solde)" : "Commander"}
              <Icon className="h-4 w-4 opacity-80" />
            </button>
            {signedIn && !canPayFromBalance && priceTon > 0 && (
              <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                Solde insuffisant — vous serez redirigé vers le paiement TON direct.
              </p>
            )}
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
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-foreground">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value, onChange, options, accent,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; accent?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none rounded-xl border bg-white/90 px-3 py-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary ${
          accent ? "border-primary/60" : "border-white/70"
        }`}
      >
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
