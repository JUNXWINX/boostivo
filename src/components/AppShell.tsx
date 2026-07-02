import { Link } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import type { ReactNode } from "react";
import { BalancePill } from "./BalancePill";
import { CurrencySwitcher } from "./CurrencySwitcher";

export function AppShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass-soft">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2.5">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-sky-400 text-primary-foreground shadow-lg shadow-primary/30">
              <Rocket className="h-4 w-4" />
            </span>
            <span className="text-base sm:text-lg">Boost<span className="text-primary">ivo</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <CurrencySwitcher />
            <BalancePill />
            {right}
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl items-center gap-1 px-3 pb-2 text-xs">
          <Link to="/" className="rounded-lg px-2.5 py-1 text-foreground/80 hover:bg-white/60" activeOptions={{ exact: true }} activeProps={{ className: "bg-white/70 text-foreground shadow-sm" }}>Acheter</Link>
          <Link to="/orders" className="rounded-lg px-2.5 py-1 text-foreground/80 hover:bg-white/60" activeProps={{ className: "bg-white/70 text-foreground shadow-sm" }}>Mes commandes</Link>
          <Link to="/wallet" className="rounded-lg px-2.5 py-1 text-foreground/80 hover:bg-white/60" activeProps={{ className: "bg-white/70 text-foreground shadow-sm" }}>Portefeuille</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-[11px] text-muted-foreground">
        Boostivo — Paiements crypto (TON & USDT) · Livraison automatique
      </footer>
    </div>
  );
}
