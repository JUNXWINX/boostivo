import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { checkUsername } from "@/lib/boostvari.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion & Inscription — Boostivo" },
      { name: "description", content: "Connectez-vous ou créez votre compte Boostivo pour commander des services SMM et gérer votre portefeuille TON." },
      { property: "og:title", content: "Connexion — Boostivo" },
      { property: "og:description", content: "Accédez à votre compte Boostivo et gérez votre portefeuille TON." },
      { property: "og:url", content: "https://boostvari.lovable.app/auth" },
    ],
    links: [{ rel: "canonical", href: "https://boostvari.lovable.app/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // username availability
  const checkFn = useServerFn(checkUsername);
  const [uStatus, setUStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  useEffect(() => {
    if (mode !== "signup") return;
    const u = username.trim();
    if (!u) { setUStatus("idle"); return; }
    if (!/^[a-z0-9_]{3,24}$/i.test(u)) { setUStatus("invalid"); return; }
    setUStatus("checking");
    const t = setTimeout(async () => {
      try {
        const r = await checkFn({ data: { username: u } });
        setUStatus(r.available ? "ok" : "taken");
      } catch { setUStatus("idle"); }
    }, 400);
    return () => clearTimeout(t);
  }, [username, mode, checkFn]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setInfo(null);
    try {
      if (mode === "signup") {
        if (uStatus !== "ok") throw new Error("Nom d'utilisateur invalide ou déjà pris");
        const { error: e1 } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin + "/",
            data: { username: username.trim() },
          },
        });
        if (e1) throw e1;
        setInfo("Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.");
        setMode("login");
      } else if (mode === "login") {
        const { error: e1 } = await supabase.auth.signInWithPassword({ email, password });
        if (e1) throw e1;
        navigate({ to: "/wallet" });
      } else {
        const { error: e1 } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (e1) throw e1;
        setInfo("Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-sm rounded-3xl glass-strong p-6">
        <h1 className="sr-only">
          {mode === "login" ? "Connexion à Boostivo" : mode === "signup" ? "Créer un compte Boostivo" : "Réinitialiser le mot de passe Boostivo"}
        </h1>
        <div className="mb-4 flex rounded-xl bg-white/60 p-1 text-sm font-medium">
          <Tab active={mode === "login"} onClick={() => setMode("login")}>Connexion</Tab>
          <Tab active={mode === "signup"} onClick={() => setMode("signup")}>Inscription</Tab>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label htmlFor="auth-username" className="mb-1 block text-xs font-semibold">Nom d'utilisateur</label>
              <div className="relative">
                <input
                  id="auth-username"
                  required minLength={3} maxLength={24}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="ex: jeanluc23"
                  className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 pr-9 text-sm outline-none ring-primary focus:ring-2"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  {uStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {uStatus === "ok" && <Check className="h-4 w-4 text-emerald-600" />}
                  {(uStatus === "taken" || uStatus === "invalid") && <X className="h-4 w-4 text-destructive" />}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {uStatus === "taken" ? "❌ Déjà pris" : uStatus === "invalid" ? "Lettres, chiffres et _ uniquement (3–24)" : "3 à 24 caractères. Lettres, chiffres, _"}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="mb-1 block text-xs font-semibold">Email</label>
            <input
              id="auth-email"
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemple.com"
              className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <label htmlFor="auth-password" className="mb-1 block text-xs font-semibold">Mot de passe</label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPwd ? "text" : "password"}
                  required minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Au moins 6 caractères"
                  className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 pr-10 text-sm outline-none ring-primary focus:ring-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-white"
                  aria-label={showPwd ? "Masquer" : "Afficher"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{info}</p>}

          <button
            disabled={loading || (mode === "signup" && uStatus !== "ok")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-sky-500 px-4 py-3 text-sm font-semibold text-primary-foreground shadow disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Se connecter" : mode === "signup" ? "Créer le compte" : "Envoyer le lien"}
          </button>
        </form>

        <div className="mt-3 text-center text-xs">
          {mode === "login" && (
            <button onClick={() => { setMode("forgot"); setError(null); setInfo(null); }} className="text-muted-foreground hover:text-foreground">
              Mot de passe oublié ?
            </button>
          )}
          {mode === "forgot" && (
            <button onClick={() => setMode("login")} className="text-muted-foreground hover:text-foreground">
              ← Retour à la connexion
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Retour au site</Link>
        </p>
      </div>
    </AppShell>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 transition ${active ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
