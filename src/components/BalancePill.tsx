import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/boostvari.functions";
import { useCurrency } from "@/lib/currency";
import { formatPrice } from "@/lib/format";

export function BalancePill() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const { currency } = useCurrency();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
    enabled: signedIn === true,
    refetchInterval: 30000,
  });

  if (signedIn === false) {
    return (
      <Link to="/auth" className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow">
        Connexion
      </Link>
    );
  }

  const balance = profile ? Number(profile.balance_ton) : 0;
  return (
    <Link
      to="/wallet"
      className="group flex items-center gap-1.5 rounded-full bg-emerald-500 pl-1 pr-3 py-1 text-xs font-bold text-white shadow-md hover:bg-emerald-600"
      aria-label="Portefeuille"
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20">
        <Plus className="h-3.5 w-3.5" />
      </span>
      <span>{formatPrice(balance, currency)}</span>
      <Wallet className="h-3.5 w-3.5 opacity-80" />
    </Link>
  );
}
