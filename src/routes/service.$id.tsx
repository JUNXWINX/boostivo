import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createOrder, getService } from "@/lib/boostvari.functions";
import { formatTon, formatXof, formatNumber } from "@/lib/format";

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

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl">
        <div className="border-b border-border/60 bg-gradient-to-br from-primary/15 to-transparent p-5">
          <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {svc.platform || "—"}
          </span>
          <h1 className="mt-2 text-xl font-bold leading-tight">{svc.name}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div>Tarif: <span className="font-semibold text-primary">{formatTon(svc.rate_per_1k_ton)}</span> / 1000</div>
            <div>Min: {svc.min_qty.toLocaleString()}</div>
            <div>Max: {svc.max_qty.toLocaleString()}</div>
          </div>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (valid) mutation.mutate(); }}
          className="space-y-4 p-5"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Lien du compte / publication</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://instagram.com/username"
              required
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Quantité ({svc.min_qty.toLocaleString()} – {svc.max_qty.toLocaleString()})
            </label>
            <input
              type="number"
              min={svc.min_qty}
              max={svc.max_qty}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(svc.min_qty, parseInt(e.target.value) || 0))}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
            />
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Total à payer</span>
              <span className="text-2xl font-bold text-primary">{formatTon(price)}</span>
            </div>
          </div>

          {mutation.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {(mutation.error as Error).message}
            </div>
          )}

          <button
            type="submit"
            disabled={!valid || mutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Commander
          </button>
        </form>
      </div>
    </AppShell>
  );
}
