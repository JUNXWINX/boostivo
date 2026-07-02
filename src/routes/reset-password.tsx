import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Boostivo" },
      { name: "description", content: "Définissez un nouveau mot de passe pour votre compte Boostivo." },
      { property: "og:title", content: "Nouveau mot de passe — Boostivo" },
      { property: "og:url", content: "https://boostvari.lovable.app/reset-password" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://boostvari.lovable.app/reset-password" }],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // On recovery, Supabase puts the session in URL hash automatically
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate({ to: "/wallet" }), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-sm rounded-3xl glass-strong p-6">
        <h1 className="text-lg font-bold">Nouveau mot de passe</h1>
        {!ready && <p className="mt-2 text-sm text-muted-foreground">Lien invalide ou expiré. <Link to="/auth" className="text-primary">Recommencer</Link>.</p>}
        {ready && !done && (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                required minLength={6} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nouveau mot de passe"
                className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 pr-10 text-sm outline-none ring-primary focus:ring-2"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Mettre à jour
            </button>
          </form>
        )}
        {done && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">✓ Mot de passe mis à jour ! Redirection…</p>}
      </div>
    </AppShell>
  );
}
