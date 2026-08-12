import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Gift, Loader2, Send, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  createWithdrawal,
  getMomoAccounts,
  getMyReferral,
  getMyWithdrawals,
  transferReferralEarnings,
} from "@/lib/boostvari.functions";
import { formatNumber, formatPrice } from "@/lib/format";
import { useCurrency } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/referral")({
  head: () => ({
    meta: [
      { title: "Parrainage — Boostivo" },
      { name: "description", content: "Parrainez vos amis sur Boostivo et gagnez 10% sur toutes leurs commandes. Transférez vos gains vers votre solde ou retirez-les." },
      { property: "og:title", content: "Programme de parrainage Boostivo" },
      { property: "og:description", content: "Gagnez 10% sur chaque commande de vos filleuls." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReferralPage,
});

function ReferralPage() {
  const qc = useQueryClient();
  const { currency, rates } = useCurrency();
  const { data, isLoading } = useQuery({ queryKey: ["my-referral"], queryFn: () => getMyReferral() });
  const { data: withdrawals = [] } = useQuery({ queryKey: ["my-withdrawals"], queryFn: () => getMyWithdrawals() });
  const { data: accounts = [] } = useQuery({ queryKey: ["momo-accounts"], queryFn: () => getMomoAccounts() });

  const transferFn = useServerFn(transferReferralEarnings);
  const withdrawFn = useServerFn(createWithdrawal);

  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"none" | "transfer" | "withdraw">("none");
  const [transferAmount, setTransferAmount] = useState("");
  const [method, setMethod] = useState<"mobile_money" | "crypto">("mobile_money");
  const [country, setCountry] = useState("");
  const [operator, setOperator] = useState("");
  const [phone, setPhone] = useState("");
  const [holder, setHolder] = useState("");
  const [asset, setAsset] = useState<"TON" | "USDT">("TON");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const countries = [...new Set(accounts.map((a) => a.country))];
  const activeCountry = country || countries[0] || "";
  const operators = accounts.filter((a) => a.country === activeCountry);
  const activeOp = operators.find((o) => o.operator === operator)?.operator ?? operators[0]?.operator ?? "";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-referral"] });
    qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
    qc.invalidateQueries({ queryKey: ["my-profile"] });
  };

  const transfer = useMutation({
    mutationFn: () => transferFn({ data: { amount_ton: Number(transferAmount) } }),
    onSuccess: () => { setMsg("✅ Gains transférés vers votre solde principal."); setTransferAmount(""); setTab("none"); refresh(); },
    onError: (e: Error) => setMsg(`❌ ${e.message}`),
  });

  const withdraw = useMutation({
    mutationFn: () =>
      withdrawFn({
        data: {
          method,
          amount: Number(amount),
          currency: method === "mobile_money" ? ("XOF" as const) : (asset as "TON" | "USDT"),
          ...(method === "mobile_money"
            ? { country: activeCountry, operator: activeOp, phone: phone.trim(), holder_name: holder.trim() }
            : { crypto_asset: asset, crypto_address: address.trim() }),
        },
      }),
    onSuccess: (r) => {
      setMsg(`✅ Demande de retrait envoyée${r.reference ? ` (réf. ${r.reference})` : ""}. Traitement sous 24h.`);
      setAmount(""); setPhone(""); setHolder(""); setAddress(""); setTab("none"); refresh();
    },
    onError: (e: Error) => setMsg(`❌ ${e.message}`),
  });

  if (isLoading || !data) return <AppShell><div className="p-6">Chargement…</div></AppShell>;

  const minXof = Math.round(data.min_withdraw_ton * data.rates.xof);

  return (
    <AppShell>
      <h1 className="sr-only">Programme de parrainage Boostivo</h1>
      <div className="space-y-4">
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-primary p-6 text-white shadow-lg">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/80">
            <Gift className="h-3.5 w-3.5" /> Gains de parrainage
          </p>
          <p className="mt-1 text-4xl font-extrabold">{formatPrice(data.earnings_ton, currency, rates)}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-white/80">Filleuls</p>
              <p className="mt-0.5 text-base font-bold">{data.referrals}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-white/80">Commission</p>
              <p className="mt-0.5 text-base font-bold">{data.percent}%</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-white/80">Total gagné</p>
              <p className="mt-0.5 text-base font-bold">{formatPrice(data.total_earned_ton, currency, rates)}</p>
            </div>
          </div>
        </div>

        {/* Lien de parrainage */}
        <div className="rounded-3xl glass-strong p-5">
          <h2 className="mb-1 text-base font-bold">Votre lien de parrainage</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Partagez ce lien : vous touchez <strong>{data.percent}%</strong> sur <strong>toutes</strong> les commandes de vos filleuls, à vie.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-3 py-2">
            <span className="flex-1 break-all font-mono text-xs">{data.link}</span>
            <button
              aria-label="Copier le lien"
              onClick={() => { navigator.clipboard.writeText(data.link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white hover:bg-white/70"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Code : <strong className="font-mono">{data.referral_code}</strong></p>
        </div>

        {/* Actions */}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => { setTab(tab === "transfer" ? "none" : "transfer"); setMsg(null); }}
            className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 p-4 text-left hover:bg-white"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-sky-500 text-white"><Wallet className="h-5 w-5" /></span>
            <span>
              <span className="block text-sm font-bold">Transférer vers mon solde</span>
              <span className="block text-[11px] text-muted-foreground">Utilisable uniquement pour commander — irréversible</span>
            </span>
          </button>
          <button
            onClick={() => { setTab(tab === "withdraw" ? "none" : "withdraw"); setMsg(null); }}
            className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 p-4 text-left hover:bg-white"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white"><Send className="h-5 w-5" /></span>
            <span>
              <span className="block text-sm font-bold">Retirer mes gains</span>
              <span className="block text-[11px] text-muted-foreground">Minimum {formatNumber(minXof)} FCFA (ou {data.min_withdraw_usd} $)</span>
            </span>
          </button>
        </div>

        {msg && <p className="rounded-xl bg-white/70 px-3 py-2 text-sm">{msg}</p>}

        {tab === "transfer" && (
          <div className="rounded-3xl glass-strong p-5">
            <h2 className="mb-2 text-base font-bold">Transfert vers le solde principal</h2>
            <p className="mb-3 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-800">
              ⚠️ Une fois transférés, ces gains ne peuvent plus être retirés : ils servent uniquement à passer des commandes.
            </p>
            <label htmlFor="tr-amount" className="mb-1 block text-xs font-semibold">Montant (TON) — disponible : {data.earnings_ton.toFixed(4)} TON</label>
            <input
              id="tr-amount" type="number" step="0.0001" min={0} max={data.earnings_ton}
              value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)}
              className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 text-sm"
            />
            <button
              disabled={transfer.isPending || !(Number(transferAmount) > 0) || Number(transferAmount) > data.earnings_ton}
              onClick={() => transfer.mutate()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-sky-500 px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {transfer.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer le transfert
            </button>
          </div>
        )}

        {tab === "withdraw" && (
          <div className="space-y-4 rounded-3xl glass-strong p-5">
            <h2 className="text-base font-bold">Demande de retrait</h2>
            <div className="flex rounded-xl bg-white/60 p-1 text-sm font-medium">
              <button onClick={() => setMethod("mobile_money")} className={`flex-1 rounded-lg px-3 py-2 ${method === "mobile_money" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Mobile Money</button>
              <button onClick={() => setMethod("crypto")} className={`flex-1 rounded-lg px-3 py-2 ${method === "crypto" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Crypto</button>
            </div>

            {method === "mobile_money" ? (
              <>
                <div>
                  <label htmlFor="wd-country" className="mb-1 block text-xs font-semibold">Pays</label>
                  <select id="wd-country" value={activeCountry} onChange={(e) => { setCountry(e.target.value); setOperator(""); }} className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm">
                    {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="wd-op" className="mb-1 block text-xs font-semibold">Opérateur</label>
                  <select id="wd-op" value={activeOp} onChange={(e) => setOperator(e.target.value)} className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm">
                    {operators.map((o) => <option key={o.operator} value={o.operator}>{o.operator}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="wd-phone" className="mb-1 block text-xs font-semibold">Numéro de retrait</label>
                  <input id="wd-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+229 ..." className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label htmlFor="wd-holder" className="mb-1 block text-xs font-semibold">Nom complet du titulaire du numéro</label>
                  <input id="wd-holder" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Prénom NOM" className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label htmlFor="wd-amount" className="mb-1 block text-xs font-semibold">Montant à retirer (FCFA)</label>
                  <input id="wd-amount" type="number" min={minXof} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 text-sm" />
                  <p className="mt-1 text-[11px] text-muted-foreground">Minimum {formatNumber(minXof)} FCFA · Disponible : {formatPrice(data.earnings_ton, "XOF", rates)}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="wd-asset" className="mb-1 block text-xs font-semibold">Devise</label>
                  <select id="wd-asset" value={asset} onChange={(e) => setAsset(e.target.value as "TON" | "USDT")} className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm">
                    <option value="TON">TON</option>
                    <option value="USDT">USDT (TON)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="wd-addr" className="mb-1 block text-xs font-semibold">Adresse de réception</label>
                  <input id="wd-addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="UQ..." className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 font-mono text-xs" />
                </div>
                <div>
                  <label htmlFor="wd-camount" className="mb-1 block text-xs font-semibold">Montant à retirer ({asset})</label>
                  <input id="wd-camount" type="number" step="0.0001" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 text-sm" />
                  <p className="mt-1 text-[11px] text-muted-foreground">Disponible : {data.earnings_ton.toFixed(4)} TON</p>
                </div>
              </>
            )}

            <button
              disabled={withdraw.isPending || !(Number(amount) > 0)}
              onClick={() => withdraw.mutate()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {withdraw.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer la demande
            </button>
          </div>
        )}

        {/* Historique retraits */}
        <div className="rounded-3xl glass-strong p-5">
          <h2 className="mb-3 text-base font-bold">Mes retraits</h2>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande de retrait.</p>
          ) : (
            <ul className="divide-y divide-white/60">
              {withdrawals.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{formatPrice(w.amount_ton, currency, rates)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {w.reference} · {w.method === "crypto" ? `Crypto ${w.crypto_asset}` : `${w.operator} ${w.country}`} · {new Date(w.created_at).toLocaleString("fr-FR")}
                    </p>
                    {w.admin_note && <p className="text-[11px] text-muted-foreground">Note : {w.admin_note}</p>}
                  </div>
                  <StatusBadge status={w.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Historique commissions */}
        <div className="rounded-3xl glass-strong p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold"><Users className="h-4 w-4" /> Commissions reçues</h2>
          {data.commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune commission pour le moment. Partagez votre lien !</p>
          ) : (
            <ul className="divide-y divide-white/60">
              {data.commissions.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString("fr-FR")}</span>
                  <span className="font-semibold text-emerald-600">+ {formatPrice(c.amount_ton, currency, rates)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
    approved: { label: "Validé", cls: "bg-sky-100 text-sky-700" },
    paid: { label: "Payé", cls: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "Refusé", cls: "bg-red-100 text-red-700" },
  };
  const s = map[status] ?? { label: status, cls: "bg-white/70 text-foreground" };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.label}</span>;
}
