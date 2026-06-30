
# Boostvari — SMM Panel automatique

## Décision d'architecture

Votre code PHP/MySQL existant ne peut pas tourner sur Lovable (stack = React + TanStack Start sur Cloudflare Workers + Postgres). Plutôt qu'adapter SMMBooster (PHP) ou votre projet partiel, on **reconstruit Boostvari à neuf** sur Lovable Cloud. Avantages vs PHP/InfinityFree :

- Vérification TON **automatique on-chain** (toncenter) → plus de "j'ai payé" manuel
- Envoi commande ExoBooster **100% automatique** dès paiement détecté
- Mobile-first natif, pas de lenteur InfinityFree
- HTTPS, base managée, secrets sécurisés (pas de clé API en clair dans le code PHP)

Hébergement : gratuit sur Lovable (sous-domaine `.lovable.app`). InfinityFree n'est plus nécessaire.

## Fonctionnalités

**Client (mobile-first)**
- Catalogue services (synchronisé depuis ExoBooster `action=services`)
- Recherche + filtre par plateforme (Instagram, TikTok, YouTube…)
- Formulaire commande : lien + quantité → prix calculé en TON en direct
- Page paiement : adresse TON + **mémo unique** + QR code + bouton copier
- Suivi commande par ID (status temps réel : pending → paid → sent → completed)

**Admin**
- Login (rôle admin via table `user_roles`)
- Dashboard : commandes, revenus, taux conversion
- Liste commandes filtrables, détails, retry manuel ExoBooster
- Gestion services : import depuis ExoBooster, markup (%), activer/désactiver

**Automatisation TON**
- Cron toutes les 30s : scan transactions entrantes sur `UQCFRAi…K0MS` via toncenter
- Match `memo` ↔ commande → status `paid` → push auto vers ExoBooster → status `sent`
- Stockage `tx_hash` pour audit

## Stack technique

- TanStack Start (React 19 + SSR)
- Lovable Cloud (Postgres + Auth + Secrets)
- Tailwind v4, thème **dark + bleu moderne**
- Server functions pour : prix, créer commande, webhook TON-checker, push ExoBooster
- Route publique `/api/public/ton-check` déclenchée par pg_cron (30s)

## Schéma base de données

```text
services      (id, provider_id, name, category, platform, rate_per_1k_ton,
               min_qty, max_qty, active, updated_at)
orders        (id, public_code, service_id, link, quantity, amount_ton,
               memo, status, provider_order_id, tx_hash, user_id?,
               created_at, paid_at, sent_at)
ton_txs       (hash PK, memo, amount_ton, from_addr, lt, seen_at)  -- dédup
user_roles    (user_id, role)                                       -- admin gate
settings      (key, value)                                          -- markup %, TON addr
```

RLS : `orders` lisible par tous via `public_code` (suivi anonyme), écriture admin uniquement ; `services` lecture publique ; `settings`/`ton_txs` admin only.

## Secrets nécessaires

- `EXOBOOSTER_API_KEY` = `390213078841f7317f498c607204c6d0` (fourni)
- `EXOBOOSTER_API_URL` = `https://exosupplier.com/api/v2` (en clair OK, mais on le met aussi en secret)
- `TON_RECEIVE_ADDRESS` = `UQCFRAiDxDKyRdfql_6EeSwVS6-8kje0qyWIKQsXpExiK0MS`
- `TONCENTER_API_KEY` (optionnel, gratuit sur toncenter.com — augmente rate limit)
- `ADMIN_EMAIL` à définir lors du premier login

## Plan de livraison (un seul build)

1. Activer Lovable Cloud + créer schéma + RLS + rôle admin
2. Stocker secrets ExoBooster + adresse TON
3. Server functions :
   - `syncServices()` (import + markup)
   - `quote(serviceId, qty)` → prix TON
   - `createOrder()` → génère mémo unique 8 chars
   - `tonCheck()` (route publique sécurisée + pg_cron 30s)
   - `pushToExobooster(orderId)` (auto + retry manuel admin)
4. UI client : home/catalogue, page service, checkout, page paiement (QR), suivi
5. UI admin : login, dashboard, commandes, services
6. Test E2E : créer commande → simuler paiement → vérifier envoi ExoBooster

## Hors scope

- App mobile native (le site est mobile-first et installable PWA si demandé plus tard)
- Multi-crypto (TON uniquement comme demandé)
- Système de tickets/support (peut être ajouté ensuite)

Confirmez-vous ce plan ? Dites "go" et je construis.
