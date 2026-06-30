## Objectifs

1. **Corriger le bug critique de prix** (priorité #1)
2. Séparer historique des commandes / dépôts
3. Supprimer la page `/track` et la remplacer par l'historique commandes live
4. Adapter la remarque au service sélectionné (notamment Telegram canaux vs vues)

---

## 1. Bug de calcul de prix — racine identifiée

Dans `src/lib/format.ts` :
```ts
export function formatXof(amount, rate) {
  const xof = n < 10 ? tonToXof(n, rate) : Math.round(n);  // ← BUG
  ...
}
```
Cette heuristique `n < 10` part du principe « si la valeur est petite c'est du TON, sinon c'est déjà du XOF ». Conséquence :
- 5 000 abonnés TikTok → `priceTon = 9.94` → `< 10` → conversion OK → `32 813 XOF` ✅ (mathématiquement correct : 9.94 × 3300 ≈ 32 800)
- 10 000 abonnés TikTok → `priceTon = 19.89` → `≥ 10` → **considéré comme déjà XOF** → affiche `20 XOF` ❌

**Pourquoi tu vois aussi un souci à 5 000** : 32 813 XOF correspond bien à 9.94 TON au taux actuel (1 TON = 3 300 XOF), mais le **taux est probablement trop bas** par rapport au prix réel du TON aujourd'hui (≈ 2,30 USD ≈ 1 400 XOF, pas 3 300). Le ratio XOF↔TON paraît donc faux à l'œil même quand la conversion interne est correcte.

### Correctifs
- **Retirer toute heuristique** dans `formatXof` / `formatUsd` / `formatPrice` : la valeur d'entrée est **toujours en TON**, point. Conversion systématique via les taux.
- **Mettre à jour les taux** dans `public.settings` aux valeurs marché actuelles (à confirmer avec toi — voir question ci-dessous) et synchroniser les constantes `XOF_PER_TON` / `USD_PER_TON` de `format.ts` pour qu'elles servent uniquement de fallback SSR.
- **Vérifier en bout de chaîne** : afficher dans le formulaire la ligne de contrôle `quantité × rate_per_1k_ton / 1000 = priceTon` avec les trois devises pour qu'on voie qu'aucune divergence ne réapparaît.

---

## 2. Séparer historique commandes / dépôts

- **`/wallet`** : ne garde QUE le solde, l'adresse TON, le memo, l'avertissement rouge, et l'**historique des dépôts**.
- Nouvelle page **`/orders`** (sous `_authenticated/`) : tableau live des commandes de l'utilisateur connecté, avec auto-refresh toutes les 15 s (Realtime Postgres + invalidation React Query).
- Lien dédié dans le header (à côté de la pastille solde) → icône `ListOrdered` qui pointe vers `/orders`.
- Après création d'une commande, redirection vers `/orders` (au lieu de `/order/$code` quand l'utilisateur est connecté) — la nouvelle ligne apparaît en tête de liste avec son statut en direct.

---

## 3. Supprimer `/track`

Tu as raison : le seul but de `/track` était de retrouver une commande par son code public. Pour un utilisateur connecté, l'historique commandes le remplace entièrement.

- Supprimer `src/routes/track.tsx` et le lien du header.
- Garder `src/routes/order.$code.tsx` (page publique d'une commande individuelle par code) pour les **utilisateurs non connectés** qui paient en TON direct — c'est leur seul lien vers le statut + QR de paiement.
- Pour les connectés, le bouton « Commander » mène directement à `/orders` (et la ligne y apparaît avec le même contenu que `/order/$code` en version compacte + lien « détails »).

---

## 4. Remarques adaptées au service

Créer une fonction `getServiceRemarks(platform, serviceName)` dans `src/lib/platform.tsx` qui détecte le type d'action à partir du nom du service (abonnés, vues, likes, partages, commentaires, membres, etc.) et renvoie la bonne liste de remarques.

Exemples ciblés :

**Telegram — abonnés canal** :
1. Mettez le lien du canal Telegram (public **ou** privé via lien d'invitation `t.me/+...`).
2. Garantie anti-chute incluse.
3. Ne supprimez pas le canal pendant l'exécution.

**Telegram — vues** :
1. Le canal **doit être public** (les vues ne s'appliquent qu'aux posts visibles).
2. Le lien doit pointer vers un post précis (`t.me/canal/123`).
3. Démarrage en quelques secondes.

**Instagram / TikTok — abonnés** :
1. Le compte doit être **public** pendant la livraison.
2. Ne changez pas le nom d'utilisateur pendant l'exécution.
3. Garantie anti-chute selon la qualité choisie.

**Likes / Vues / Commentaires** : règles spécifiques (URL du post précis, post visible publiquement, etc.).

Et un fallback générique pour les services non reconnus.

---

## Détails techniques

| Fichier | Action |
|---|---|
| `src/lib/format.ts` | Supprimer heuristique `n < 10`. `formatXof`/`formatUsd`/`formatPrice` reçoivent toujours du TON. |
| `src/lib/platform.tsx` | Ajouter `getServiceRemarks(platform, serviceName)` + détection type d'action. |
| `src/routes/index.tsx` | Utiliser `getServiceRemarks`. Rediriger connecté → `/orders`. |
| `src/routes/_authenticated/wallet.tsx` | Retirer la section commandes, garder dépôts. |
| `src/routes/_authenticated/orders.tsx` | **Nouveau** — liste live des commandes user. |
| `src/routes/track.tsx` | **Supprimer**. |
| `src/components/AppShell.tsx` | Lien `/orders` dans le header pour les connectés, retirer lien `/track`. |
| `src/lib/boostvari.functions.ts` | Ajouter `listMyOrders()` (déjà partiellement présent, à vérifier). |
| `public.settings` (migration data) | Mettre à jour `xof_per_ton` / `usd_per_ton` aux taux corrects (après ta confirmation). |

---

## Question avant de coder

Pour le taux TON, il faut une valeur fiable. Trois options :
- **A.** Je fixe des taux marché actuels en dur (≈ 1 TON = 2.30 USD = 1 400 XOF) et tu pourras les changer dans la table `settings`.
- **B.** Je branche une mini fonction serveur qui interroge CoinGecko toutes les 10 min pour rafraîchir automatiquement `xof_per_ton` et `usd_per_ton` dans `settings`.
- **C.** Tu me donnes toi-même les taux exacts à utiliser.

Dis-moi laquelle tu préfères et je lance l'implémentation.