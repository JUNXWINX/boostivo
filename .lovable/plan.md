## Vue d'ensemble

Refonte majeure de Boostvari → **Boostivo** avec nouvelle adresse TON, catalogue complet ExoBooster, marge ×2,1 uniforme, 4 devises (XOF/USD/USDT/TON) avec taux TON en temps réel, et paiements crypto TON + USDT sur la même adresse.

---

## 1. Rebranding complet — Boostvari → Boostivo

- Renommer partout dans l'UI : header, `<title>`, meta description, OG tags, JSON-LD, `robots.txt`, `llms.txt`, sitemap, page auth, wallet, admin.
- Mémoire projet mise à jour.
- Nom du memo passe de `BV...` à `BO...` (via `generate_deposit_memo`).

## 2. Nouvelle adresse de paiement

- Secret `TON_RECEIVE_ADDRESS` → `UQClYXOpiv1q_FJzxVV7SYId2zMAHYRxXD6KKA09X_wJpnTX`.
- Cette adresse sert **à la fois pour TON et USDT (jetton TRC20/TON Jetton)**.
- Le scanner on-chain doit détecter les 2 types de transferts entrants sur cette adresse et matcher le memo.

## 3. Système multi-devises (XOF, USD, USDT, TON)

**Stockage interne :** tous les prix restent en **TON** (source de vérité). L'affichage est dérivé au rendu.

**Taux :**
- `xof_per_ton`, `usd_per_ton`, `usdt_per_ton` stockés dans `settings`.
- USDT ≈ USD (taux ~1:1, mis à jour avec USD).
- **Taux TON en temps réel** : cron toutes les 30 s qui interroge CoinGecko (`ton/simple/price?vs_currencies=usd,xof`) et met à jour `settings`.
- Route publique : `src/routes/api/public/refresh-rates.ts` déclenchée par `pg_cron`.
- Front : `useCurrency` étendu à `"USDT"`, `formatPrice` gère les 4 devises et refetch les taux toutes les 30 s côté client (via `useQuery` sur les settings publics).

## 4. Marges (uniforme ×2,1 avec arrondi)

- Toutes les catégories utilisent le multiplicateur **×2,1** (Telegram, Instagram, TikTok, YouTube, Facebook, WhatsApp, autres).
- Recalcul en base : `services.rate_per_1k_ton = provider_rate_usd / usd_per_ton × 2.1`, puis arrondi propre (2 décimales TON, ou arrondi au XOF le plus proche à l'affichage).
- Mis à jour à chaque sync des services (fonction `syncServices` dans admin).

## 5. Catalogue complet ExoBooster

- Modifier `syncServices` pour importer **tous** les services renvoyés par l'API (aujourd'hui filtrés/limités).
- Classification automatique par plateforme via mots-clés dans le nom (Telegram, Instagram, TikTok, YouTube, Facebook, WhatsApp, Twitter/X, Threads, Discord, Twitch, LinkedIn, Potato, Snapchat, autres).
- Ne masquer aucun service sauf ceux marqués inactifs par le fournisseur.
- Pour chaque service en base : `name`, `category`, `platform`, `provider_rate` (USD/1k), `rate_per_1k_ton`, `min`, `max`, `avg_time` (nouveau champ), `remarks` (nouveau champ), `active`.

## 6. UI service — infos complètes

Sur la carte + page détail service :
- Nom complet.
- **Temps moyen** (`avg_time` renvoyé par l'API `services` d'ExoBooster).
- **Remarques / description** (`refill`, `dripfeed`, `cancel`, description).
- Prix pour 1000 dans la devise sélectionnée.
- Min / Max.

## 7. Paiements crypto — TON + USDT

- Scanner étendu : `runTonCheck` détecte les transferts TON natifs **et** les jettons USDT (via `getJettonWallet` ou API tonapi.io).
- Table `deposits` : ajouter colonne `asset` (`TON` | `USDT`).
- Crédit converti en TON interne (via taux courant) OU stocké en asset natif ? → **Décision : convertir en TON à réception** pour garder une source de vérité unique.
- Anti-double crédit : contrainte unique sur `tx_hash` (déjà en place, à vérifier).
- Affichage post-paiement : montant reçu (dans devise d'origine), memo, hash, statut confirmé.

## 8. Migration base

```sql
ALTER TABLE services ADD COLUMN avg_time text, ADD COLUMN remarks text;
ALTER TABLE deposits ADD COLUMN asset text NOT NULL DEFAULT 'TON';
UPDATE settings SET usdt_per_ton = usd_per_ton; -- ou colonne dédiée
-- Mise à jour prefix memo BO
CREATE OR REPLACE FUNCTION generate_deposit_memo ... 'BO' ...
-- Recalcul rate_per_1k_ton avec ×2,1
```

## 9. Cron taux TON temps réel

- Nouvelle route `/api/public/refresh-rates` (GET/POST).
- `pg_cron` toutes les 30 s : `SELECT net.http_post(...)`.
- Interroge CoinGecko public (pas de clé requise).
- Met à jour `settings.xof_per_ton`, `usd_per_ton`, `usdt_per_ton`.

## 10. Hors scope (non demandé cette fois)

- Recharge auto solde ExoBooster (l'utilisateur recharge manuellement).
- Aucun changement sur la logique `pushToProvider`.

---

## Étapes techniques (ordre d'exécution)

1. Migration SQL (colonnes + fonction memo + recalcul prix).
2. Mise à jour `TON_RECEIVE_ADDRESS` via `set_secret`.
3. Serveur : `format.ts` (USDT + 4 devises), `currency.tsx`, `settings` fetch client, scanner USDT.
4. Serveur : `refresh-rates` route + cron.
5. Serveur : `syncServices` sans filtre + classification étendue.
6. UI : rebrand Boostvari → Boostivo (batch grep + replace).
7. UI : composant service (avg_time, remarks), `CurrencySwitcher` (4 options), wallet (badge USDT).
8. Vérification : build + smoke test préview.

---

## Points à confirmer avant exécution

- **USDT sur TON** (jetton) et non TRC20/ERC20 ? → nécessaire car adresse fournie est une adresse TON.
- Taux `xof_per_ton` fixe ou vraiment lié au marché ? Si marché réel, les prix XOF affichés vont bouger toutes les 30 s (fluctuation cours TON). OK ?
- Marge ×2,1 sur **tous** les services (même YouTube que tu mentionnes ×2,1 et non ×2) — je confirme ×2,1 partout.

Réponds sur ces 3 points et j'exécute d'un bloc.