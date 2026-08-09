import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getRates } from "./boostvari.functions";
import { USDT_PER_TON, USD_PER_TON, XOF_PER_TON, type Currency } from "./format";

type Rates = { xof: number; usd: number; usdt: number };
type Ctx = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: Rates;
};

const CurrencyContext = createContext<Ctx>({
  currency: "XOF",
  setCurrency: () => {},
  rates: { xof: XOF_PER_TON, usd: USD_PER_TON, usdt: USDT_PER_TON },
});

const STORAGE_KEY = "boostivo:currency";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("XOF");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "XOF" || stored === "USD") setCurrencyState(stored);
      else if (stored) setCurrencyState("XOF");
    } catch { /* noop */ }
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch { /* noop */ }
  };

  // Live rates refresh every 30s — TON price moves with the market
  const { data } = useQuery({
    queryKey: ["rates"],
    queryFn: () => getRates(),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const rates: Rates = {
    xof: data?.xof_per_ton ?? XOF_PER_TON,
    usd: data?.usd_per_ton ?? USD_PER_TON,
    usdt: data?.usdt_per_ton ?? USDT_PER_TON,
  };

  return <CurrencyContext.Provider value={{ currency, setCurrency, rates }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
