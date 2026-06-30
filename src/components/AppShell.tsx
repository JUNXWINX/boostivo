import { Link } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass-soft">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-sky-400 text-primary-foreground shadow-lg shadow-primary/30">
              <Rocket className="h-4 w-4" />
            </span>
            <span className="text-lg">Boost<span className="text-primary">vari</span></span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/" className="rounded-lg px-3 py-1.5 text-foreground/80 hover:bg-white/60" activeOptions={{ exact: true }} activeProps={{ className: "bg-white/70 text-foreground shadow-sm" }}>Services</Link>
            <Link to="/track" className="rounded-lg px-3 py-1.5 text-foreground/80 hover:bg-white/60" activeProps={{ className: "bg-white/70 text-foreground shadow-sm" }}>Suivi</Link>
            {right}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-muted-foreground">
        Boostvari — Paiements 100% en TON · Livraison automatique
      </footer>
    </div>
  );
}
