import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, Info, Loader2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createOrder, getService } from "@/lib/boostvari.functions";
import { formatTon, formatXof, formatNumber } from "@/lib/format";
import { getPlatform } from "@/lib/platform";

const serviceQuery = (id: string) =>
  queryOptions({
    queryKey: ["service", id],
    queryFn: () => getService({ data: { id } }),
  });

export const Route = createFileRoute("/service/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(serviceQuery(params.id)),
  component: ServicePage,
  errorComponent: ({ error }) => (
    <AppShell><div className="p-6 text-destructive">{error.message}</div></AppShell>
  ),
  notFoundComponent: () => <AppShell><div>Service introuvable</div></AppShell>,
});

function ServicePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: svc } = useSuspenseQuery(serviceQuery(id));
  const info = getPlatform(svc.platform);
  const Icon = info.icon;
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState(svc.min_qty);
  const createFn = useServerFn(createOrder);

  const price = useMemo(() => (Number(svc.rate_per_1k_ton) * quantity) / 1000, [svc, quantity]);

  const mutation = useMutation({
    mutationFn: () => createFn({ data: { service_id: svc.id, link, quantity } }),
    onSuccess: (res) => navigate({ to: "/order/$code", params: { code: res.public_code } }),
  });

  const valid = link.trim().length > 5 && quantity >= svc.min_qty && quantity <= svc.max_qty;

  return (
    <AppShell>
      <button onClick={() => history.back()} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      <div className="overflow-hidden rounded-3xl glass-strong">
        <div className="border-b border-white/60 p-5">
          <div className="flex items-center gap-3">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${info.tile} text-white shadow-md`}>
              <Icon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{info.name}</div>
              <h1 className="text-lg font-bold leading-tight">{svc.name}</h1>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tarif / 1000</div>
              <div className="mt-0.5 font-bold text-primary">{formatXof(svc.rate_per_1k_ton)}</div>
              <div className="text-[10px] text-muted-foreground/70">≈ {formatTon(svc.rate_per_1k_ton)}</div>
            </div>
            <div className="rounded-xl bg-white/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Quantité</div>
              <div className="mt-0.5 font-medium">{formatNumber(svc.min_qty)} – {formatNumber(svc.max_qty)}</div>
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (valid) mutation.mutate(); }}
          className="space-y-4 p-5"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/80">
              Lien {info.name === "Autre" ? "" : info.name}
            </label>
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
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/80">
              Quantité ({formatNumber(svc.min_qty)} – {formatNumber(svc.max_qty)})
            </label>
            <input
              type="number"
              min={svc.min_qty}
              max={svc.max_qty}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(svc.min_qty, parseInt(e.target.value) || 0))}
              className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[svc.min_qty, 100, 500, 1000, 5000, 10000]
                .filter((v, i, a) => v >= svc.min_qty && v <= svc.max_qty && a.indexOf(v) === i)
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
          </div>

          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-sky-200/40 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Total à payer</span>
              <span className="text-2xl font-bold text-primary">{formatXof(price)}</span>
            </div>
            <div className="mt-1 text-right text-xs text-muted-foreground">≈ {formatTon(price)}</div>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-white/60 p-3 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>Paiement on-chain en TON. Votre commande est envoyée automatiquement au fournisseur dès détection (≈ 30 sec).</span>
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
        </form>
      </div>
    </AppShell>
  );
}
