import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, ArrowDownToLine, Check, Copy, Loader2, RefreshCw, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getMyProfile, getMyDeposits, triggerTonCheck } from "@/lib/boostvari.functions";
import { useCurrency } from "@/lib/currency";
import { formatPrice, formatTon } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Portefeuille TON — Boostivo" },
      { name: "description", content: "Gérez votre solde TON Boostivo : rechargez votre portefeuille avec un memo unique et suivez l'historique de vos dépôts." },
      { property: "og:title", content: "Portefeuille TON — Boostivo" },
      { property: "og:description", content: "Rechargez votre solde TON et suivez l'historique de vos dépôts." },
      { property: "og:url", content: "https://boostvari.lovable.app/wallet" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://boostvari.lovable.app/wallet" }],
  }),
  component: WalletPage,
});

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/70 text-foreground hover:bg-white"
      aria-label="Copier"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function WalletPage() {
  const qc = useQueryClient();
  const { currency } = useCurrency();
  const { data: profile, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => getMyProfile() });
  const { data: deposits = [] } = useQuery({ queryKey: ["my-deposits"], queryFn: () => getMyDeposits() });

  // Realtime: refresh balance + deposits when a new deposit lands
  useEffect(() => {
    let uid: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data }) => {
      uid = data.user?.id ?? null;
      if (!uid) return;
      channel = supabase
        .channel("deposits-mine")
        .on("postgres_changes", { event: "*", schema: "public", table: "deposits", filter: `user_id=eq.${uid}` },
          () => {
            qc.invalidateQueries({ queryKey: ["my-deposits"] });
            qc.invalidateQueries({ queryKey: ["my-profile"] });
          })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [qc]);

  const tonCheckFn = useServerFn(triggerTonCheck);
  const refresh = useMutation({
    mutationFn: () => tonCheckFn(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["my-deposits"] });
    },
  });

  if (isLoading || !profile) return <AppShell><div className="p-6">Chargement…</div></AppShell>;

  const tonLink = profile.ton_address
    ? `ton://transfer/${profile.ton_address}?text=${encodeURIComponent(profile.deposit_memo)}`
    : "";

  return (
    <AppShell>
      <h1 className="sr-only">Votre portefeuille TON Boostivo</h1>
      <div className="space-y-4">
        {/* Balance card */}
        <div className="rounded-3xl glass-strong p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Bonjour, @{profile.username}</p>
              <p className="mt-1 text-xs text-muted-foreground">Solde disponible</p>
              <p className="text-3xl font-bold text-emerald-600">{formatPrice(profile.balance_ton, currency)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">≈ {formatTon(profile.balance_ton)}</p>
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
              className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-white"
            >
              <LogOut className="h-3.5 w-3.5" /> Déconnexion
            </button>
          </div>
        </div>

        {/* Deposit section */}
        <div className="overflow-hidden rounded-3xl glass-strong">
          <div className="flex items-center gap-2 border-b border-white/60 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white">
              <ArrowDownToLine className="h-5 w-5" />
            </span>
            <h2 className="text-base font-bold">Recharger en TON</h2>
          </div>

          <div className="space-y-4 p-5">
            {/* Critical warning */}
            <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div className="text-sm text-red-700">
                  <p className="font-bold uppercase">⚠️ Important — À lire avant tout envoi</p>
                  <p className="mt-1">
                    Vous <strong>DEVEZ</strong> coller le <strong>MEMO ci-dessous</strong> dans le champ "memo / commentaire / tag"
                    de votre wallet avant de confirmer la transaction.
                  </p>
                  <p className="mt-2 font-bold text-red-800">
                    ❌ Sans memo (ou avec un memo incorrect), votre dépôt sera <u>PERDU DÉFINITIVEMENT</u> et irrécupérable.
                  </p>
                </div>
              </div>
            </div>

            {/* QR code */}
            {tonLink && (
              <div className="grid place-items-center rounded-2xl bg-white p-4">
                <QRCodeSVG value={tonLink} size={180} level="M" />
                <p className="mt-2 text-[11px] text-muted-foreground">Scannez avec votre wallet TON</p>
              </div>
            )}

            <Field label="Adresse de réception (TON)" value={profile.ton_address} mono />
            <Field label="VOTRE MEMO PERSONNEL (obligatoire)" value={profile.deposit_memo} mono highlight />

            <p className="rounded-xl bg-white/60 p-3 text-[11px] text-muted-foreground">
              Après envoi, votre solde sera crédité automatiquement en moins d'une minute.
              Vous pouvez aussi forcer une vérification immédiate ci-dessous.
            </p>

            <button
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-sky-500 px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {refresh.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Vérifier mon dépôt maintenant
            </button>
          </div>
        </div>

        {/* Deposit history */}
        <div className="rounded-3xl glass-strong p-5">
          <h2 className="mb-3 text-base font-bold">Historique des dépôts</h2>
          {deposits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun dépôt pour le moment.</p>
          ) : (
            <ul className="divide-y divide-white/60">
              {deposits.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-semibold text-emerald-600">+ {formatPrice(d.amount_ton, currency)}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">✓ Confirmé</span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </AppShell>
  );
}


function Field({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold">{label}</p>
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${highlight ? "border-red-400 bg-red-50" : "border-white/70 bg-white/80"}`}>
        <span className={`flex-1 break-all text-sm ${mono ? "font-mono" : ""} ${highlight ? "font-bold text-red-700" : ""}`}>{value}</span>
        <CopyBtn value={value} />
      </div>
    </div>
  );
}
