import { useCurrency } from "@/lib/currency";
import type { Currency } from "@/lib/format";

export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency();
  const opts: Currency[] = ["XOF", "USD"];
  return (
    <div className="flex items-center rounded-full border border-white/70 bg-white/80 p-0.5 text-[10px] font-semibold">
      {opts.map((c) => (
        <button
          key={c}
          onClick={() => setCurrency(c)}
          className={`rounded-full px-2 py-1 transition ${
            currency === c ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label={`Afficher en ${c}`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
