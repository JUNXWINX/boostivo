# Plan : UI ExoBooster + Système de solde utilisateur

## Partie 1 — Refonte de la page commande (style ExoBooster)

Reproduire exactement la mise en page de la capture :

- Bandeau "CHOISISSEZ VOTRE RÉSEAU SOCIAL CIBLE" + rangée d'icônes plates centrées (TikTok, Instagram, Facebook, Telegram, YouTube, WhatsApp), l'icône active souligné par une bordure colorée.
- Champs empilés simples (label gras au-dessus, input plein largeur) :
  - **Service** (liste déroulante)
  - **Type** (n'apparaît que si plusieurs qualités)
  - **Lien du compte [Réseau]** (placeholder dynamique)
  - **Quantité** + texte `(Min: X – Max: Y)` en dessous
  - **Prix** affiché en pastille verte (montant total dans la devise choisie) + ligne `(X XOF / 1k Followers)` en dessous
  - **Temps moyen de réalisation** (champ readonly)
  - **Remarque** : zone d'aide avec règles 1/2/3 spécifiques au service
- Bouton **Commander** sticky en bas.

### Correction du calcul de prix

Vérifier la formule de bout en bout pour qu'à chaque changement de quantité, **prix XOF = (rate_per_1k_ton × xof_per_ton × quantité) / 1000** arrondi à l'unité, et **prix TON = (rate_per_1k_ton × quantité) / 1000** arrondi à 4 décimales. Recalculer immédiatement à chaque saisie sans décalage d'un tick.

## Partie 2 — Comptes utilisateurs

- Page `/auth` avec onglets **Connexion / Inscription** :
  - Inscription : `username`, `email`, `password` + bouton œil pour afficher/masquer
  - Vérification temps réel que l'username n'est pas déjà pris (debounced)
  - Email de vérification envoyé via Lovable Auth (template par défaut)
- Page `/reset-password` pour mot de passe oublié + formulaire nouveau mdp
- Table `profiles` (user_id, username unique, balance_ton, preferred_currency 'XOF'|'USD', created_at)

## Partie 3 — Solde et dépôts TON

### Affichage solde (en haut de chaque page)

Pastille verte type ExoBooster : `[+] 12 500 XOF` (cliquable → page Dépôt). Toggle FR/devise dans le header (XOF ↔ USD ↔ TON).

### Page `/wallet` (Dépôt)

1. Affiche l'adresse TON du wallet maître (copiable + QR code).
2. **Memo unique par utilisateur** (généré une fois et stocké dans `profiles.deposit_memo`).
3. Avertissement **EN ROUGE GRAS** : « ⚠️ IMPORTANT : Vous DEVEZ coller le memo `XXXX` avant de confirmer l'envoi. Sans ce memo, votre dépôt sera PERDU définitivement et irrécupérable. »
4. Formulaire « J'ai envoyé X TON » qui force le scan immédiat.
5. Historique des dépôts (en attente / confirmés).

### Vérification automatique

Le cron `/api/public/ton-check` existant est étendu : pour chaque tx entrante avec un memo qui matche `profiles.deposit_memo`, créditer `balance_ton` et insérer une ligne dans `deposits`. Déduplication via `ton_txs.hash`.

### Paiement des commandes depuis le solde

Au lieu de payer chaque commande on-chain, l'utilisateur connecté paie en débitant son solde TON. La commande passe direct en `paid` → `pushToProvider` (latence nulle). Les utilisateurs non connectés gardent le flow on-chain actuel.

### Préférence d'affichage

Setting `preferred_currency` dans `profiles` : choix entre `XOF` et `USD`. Tous les prix et le solde s'affichent dans cette devise + équivalent TON en secondaire partout. Taux USD/TON ajouté dans `settings` (ex. `usd_per_ton = 5.5`).

## Schéma DB

```text
profiles
  - user_id (uuid, pk, ref auth.users)
  - username (text unique)
  - balance_ton (numeric default 0)
  - deposit_memo (text unique)
  - preferred_currency (text default 'XOF')

deposits
  - user_id, amount_ton, tx_hash (unique), memo, status, created_at

settings (ajouts)
  - usd_per_ton
```

RLS : chaque utilisateur lit/écrit uniquement ses lignes ; le crédit du solde se fait via fonction SECURITY DEFINER appelée par le cron côté serveur.

## Hors scope (pour rester focus)

- Pas de retrait (TON → utilisateur) dans cette itération
- Pas de 2FA

## Détails techniques

- Frontend : refonte de `src/routes/index.tsx` pour matcher 1:1 la capture ExoBooster (champs empilés, pastille verte, remarques).
- `src/lib/format.ts` : ajouter `formatUsd`, helper `formatPrice(amount, currency)` unique pour éviter les divergences.
- `src/routes/auth.tsx` : refonte avec onglets, check username via server fn, toggle password.
- Nouveau `src/routes/_authenticated/wallet.tsx` : adresse + memo + QR + historique.
- Nouveau `src/components/BalancePill.tsx` + currency switcher dans `AppShell`.
- Migration : table `profiles`, `deposits`, fonctions `credit_balance`, `debit_balance`, trigger auto-create profile à l'inscription avec memo généré.
- `processing.server.ts` étendu : si memo match un `profiles.deposit_memo`, créditer le solde au lieu de matcher une commande.
- `createOrder` server fn : si user connecté avec solde suffisant, débiter + push immédiat ; sinon flow on-chain existant.
- Email de vérification : utilise le flow Supabase Auth standard (déjà actif).

&nbsp;

Il doit y avoir l'historique de commande et l'historique de paiement précisément appelé Portefeuille et le solde doit être afficher dedans,et pour le solde je pense que tu comprends déjà quand il effectuer son dépôt c'est juste un affichage et chaque commande est déduit de ce solde tu comprends nn moi je reçois l'argent et comme j'avais déjà recharger mon compte API de exobooster la où les commandes seront payés mais avec le prix de exobooster genre leur plateforme 