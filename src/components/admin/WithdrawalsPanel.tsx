import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { adminListWithdrawals, adminReviewWithdrawal } from "@/lib/boostvari.functions";
import { formatNumber } from "@/lib/format";

export function WithdrawalsPanel() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin-withdrawals"], queryFn: () => adminListWithdrawals() });
  const reviewFn = useServerFn(adminReviewWithdrawal);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const review = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) =>
      reviewFn({ data: { id: v.id, approve: v.approve, note: notes[v.id] || undefined } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-withdrawals"] }),
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="rounded-3xl glass-strong p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold"><Send className="h-4 w-4" /> Retraits parrainage</h2>
      {err && <p className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune demande de retrait.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((w) => (
            <li key={w.id} className="rounded-2xl border border-white/70 bg-white/70 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold">
                    {w.amount_ton} TON {w.amount_xof ? `(~${formatNumber(w.amount_xof)} FCFA)` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {w.reference} · @{w.username} · {new Date(w.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium">{w.status}</span>
              </div>
              <p className="mt-1 text-[12px]">
                {w.method === "crypto"
                  ? <>Crypto {w.crypto_asset} → <span className="font-mono break-all">{w.crypto_address}</span></>
                  : <>{w.operator} · {w.country} · <span className="font-mono">{w.phone}</span> · Titulaire : <strong>{w.holder_name}</strong></>}
              </p>
              {w.admin_note && <p className="mt-1 text-[11px] text-muted-foreground">Note : {w.admin_note}</p>}
              {w.status === "pending" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={notes[w.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))}
                    placeholder="Note (optionnel)"
                    className="min-w-[160px] flex-1 rounded-lg border border-white/70 bg-white px-2 py-1.5 text-xs"
                  />
                  <button
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: w.id, approve: true })}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {review.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Marquer payé
                  </button>
                  <button
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: w.id, approve: false })}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
