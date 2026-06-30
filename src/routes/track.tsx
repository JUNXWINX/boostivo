import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/track")({
  component: TrackPage,
});

function TrackPage() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  return (
    <AppShell>
      <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-xl">
        <h1 className="text-xl font-bold">Suivi de commande</h1>
        <p className="mt-1 text-sm text-muted-foreground">Entrez le code à 8 caractères de votre commande.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) navigate({ to: "/order/$code", params: { code: code.trim().toUpperCase() } });
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD1234"
            className="flex-1 rounded-lg border border-border bg-input px-3 py-2.5 font-mono text-sm uppercase outline-none ring-primary focus:ring-2"
          />
          <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Voir</button>
        </form>
      </div>
    </AppShell>
  );
}
