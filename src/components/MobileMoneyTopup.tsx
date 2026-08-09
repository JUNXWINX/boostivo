import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Loader2, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { createTopupRequest, getMomoAccounts, getMyTopups } from "@/lib/boostvari.functions";
import { formatNumber } from "@/lib/format";

function Copyable({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/70 hover:bg-white"
      aria-label="Copier le numéro"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export function MobileMoneyTopup() {
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery({ queryKey: ["momo-accounts"], queryFn: () => getMomoAccounts() });
  const { data: topups = [] } = useQuery({ queryKey: ["my-topups"], queryFn: () => getMyTopups() });
  const submitFn = useServerFn(createTopupRequest);

  const countries = useMemo(() => [...new Set(accounts.map((a) => a.country))], [accounts]);
  const [country, setCountry] = useState("");
  const [operator, setOperator] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);

  const activeCountry = country || countries[0] || "";
  const operators = accounts.filter((a) => a.country === activeCountry);
  const activeOp = operators.find((o) => o.operator === operator) ?? operators[0];

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          country: activeCountry,
          operator: activeOp?.operator ?? "",
          phone: phone.trim(),
          amount_xof: Number(amount),
        },
      }),
    onSuccess: () => {
      setDone(true);
      setPhone(""); setAmount("");
      qc.invalidateQueries({ queryKey: ["my-topups"] });
    },
  });

  const amountNum = Number(amount);
  const valid = activeOp && phone.trim().length >= 6 && amountNum >= 500;

  return (
    <div className="overflow-hidden rounded-3xl glass-strong">
      <div className="flex items-center gap-2 border-b border-white/60 p-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <Smartphone className="h-5 w-5" />
        </span>
        <h2 className="text-base font-bold">Recharger par Mobile Money</h2>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <label htmlFor="momo-country" className="mb-1 block text-xs font-semibold">Pays</label>
          <select
            id="momo-country"
            value={activeCountry}
            onChange={(e) => { setCountry(e.target.value); setOperator(""); }}
            className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm"
          >
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="momo-operator" className="mb-1 block text-xs font-semibold">Opérateur</label>
          <select
            id="momo-operator"
            value={activeOp?.operator ?? ""}
            onChange={(e) => setOperator(e.target.value)}
            className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm"
          >
            {operators.map((o) => <option key={o.operator} value={o.operator}>{o.operator}</option>)}
          </select>
        </div>

        {activeOp && (
          <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-sm">
            <p className="font-bold text-amber-800">1. Envoyez le montant à ce numéro :</p>
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2">
              <span className="flex-1 font-mono text-base font-bold">{activeOp.number}</span>
              <Copyable value={activeOp.number} />
            </div>
            <p className="mt-1 text-xs text-amber-800">Nom du compte : <strong>{activeOp.name}</strong></p>
            <p className="mt-2 text-xs text-amber-800">
              2. Remplissez le formulaire ci-dessous avec le <strong>numéro qui a envoyé l'argent</strong> et le montant exact.
              Votre solde est crédité après vérification par l'administrateur.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="momo-phone" className="mb-1 block text-xs font-semibold">Votre numéro d'envoi</label>
          <input
            id="momo-phone"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setDone(false); }}
            placeholder="+229 ..."
            className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="momo-amount" className="mb-1 block text-xs font-semibold">Montant envoyé (FCFA)</label>
          <input
            id="momo-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => { setAmount(e.target.value.replace(/[^0-9]/g, "")); setDone(false); }}
            placeholder="5000"
            className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Minimum 500 FCFA.</p>
        </div>

        {submit.error && (
          <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{(submit.error as Error).message}</p>
        )}
        {done && (
          <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
            Demande envoyée ✓ — elle sera validée après vérification du paiement.
          </p>
        )}

        <button
          onClick={() => submit.mutate()}
          disabled={!valid || submit.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          J'ai payé — envoyer ma demande
        </button>

        {topups.length > 0 && (
          <div>
            <h3 className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mes demandes de recharge
            </h3>
            <ul className="divide-y divide-white/60">
              {topups.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-semibold">{formatNumber(t.amount_xof)} FCFA</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.operator} · {new Date(t.created_at).toLocaleString("fr-FR")}
                    </p>
                    {t.admin_note && <p className="text-[11px] text-muted-foreground">Note : {t.admin_note}</p>}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    t.status === "approved" ? "bg-emerald-100 text-emerald-700"
                      : t.status === "rejected" ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {t.status === "approved" ? "✓ Validée" : t.status === "rejected" ? "Refusée" : "En attente"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
