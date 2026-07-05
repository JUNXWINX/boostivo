import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CurrencyProvider } from "../lib/currency";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Cette page n'a pas pu se charger</h1>
        <p className="mt-2 text-sm text-muted-foreground">Une erreur est survenue. Essayez de rafraîchir.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Réessayer</button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium">Accueil</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Boostivo — SMM Panel avec paiements TON" },
      { name: "description", content: "Boostivo : SMM panel automatique. Achetez followers, likes et vues sur Instagram, TikTok, Telegram, YouTube. Paiement TON, livraison en quelques minutes." },
      { property: "og:title", content: "Boostivo — SMM Panel avec paiements TON" },
      { property: "og:description", content: "Boostivo : SMM panel automatique. Achetez followers, likes et vues sur Instagram, TikTok, Telegram, YouTube. Paiement TON, livraison en quelques minutes." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Boostivo" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Boostivo — SMM Panel avec paiements TON" },
      { name: "twitter:description", content: "Boostivo : SMM panel automatique. Achetez followers, likes et vues sur Instagram, TikTok, Telegram, YouTube. Paiement TON, livraison en quelques minutes." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/3b5c1a5a-c039-4584-b886-0da87daf094f" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/3b5c1a5a-c039-4584-b886-0da87daf094f" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://boostvari.lovable.app/#org",
              name: "Boostivo",
              url: "https://boostvari.lovable.app",
              description: "SMM Panel automatique avec paiement TON : followers, likes et vues pour Instagram, TikTok, Telegram, YouTube et plus.",
            },
            {
              "@type": "WebSite",
              "@id": "https://boostvari.lovable.app/#website",
              name: "Boostivo",
              url: "https://boostvari.lovable.app",
              publisher: { "@id": "https://boostvari.lovable.app/#org" },
              inLanguage: "fr",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <Outlet />
      </CurrencyProvider>
    </QueryClientProvider>
  );
}
