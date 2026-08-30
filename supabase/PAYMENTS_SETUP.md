# Activer les paiements (Stripe + Flutterwave + PayUnit + Paystack)

Ce sont les 4 PSP actifs sur cette plateforme. Le code des quatre fournisseurs est prêt. Rien ne
fonctionne tant que les secrets ne sont pas configurés — mais aucun échec silencieux : les
boutons afficheront un message clair ("non configuré") jusqu'à ce que ce soit fait.

## ⚠️ Faille corrigée au passage
L'ancien code activait un plan directement depuis l'URL (`/billing?status=success&plan=X`) —
n'importe qui pouvait taper cette adresse et obtenir n'importe quel plan gratuitement. C'est
maintenant corrigé : **seul le webhook du fournisseur de paiement (vérifié cryptographiquement)
peut activer un plan.** La page Billing attend juste la confirmation.

---

## 1. Stripe

### a. Compte et clé
1. https://dashboard.stripe.com → créez un compte (mode Test d'abord).
2. **Developers → API keys** → copiez la clé secrète (`sk_test_...`).

### b. Déployer les fonctions
```bash
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
```
⚠️ **`--no-verify-jwt` est obligatoire pour `stripe-webhook`.** Stripe appelle cette fonction
directement depuis ses serveurs, sans jeton Supabase — sans ce flag, la passerelle Supabase
rejette l'appel avec une 401 *avant même* que le code de la fonction ne s'exécute (vous ne
verriez même pas l'erreur dans les logs de la fonction). `stripe-checkout` et `stripe-portal`
n'en ont pas besoin : ils sont appelés depuis votre propre frontend avec le jeton de l'utilisateur
connecté.

### c. Créer le webhook
1. **Developers → Webhooks → Add endpoint**.
2. URL : `https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`
3. Événements à cocher : `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`.
4. Copiez le **Signing secret** (`whsec_...`) affiché après création.
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### d. Tester
Utilisez une carte de test Stripe (`4242 4242 4242 4242`, toute date future, tout CVC) depuis
Facturation → choisir un plan. Le webhook doit passer le tenant en "actif" en quelques secondes.

### e. Passer en production
Remplacez `sk_test_...` par `sk_live_...` et recréez le webhook en mode Live (clés/secrets
différents entre Test et Live).

---

## 2. Flutterwave

### a. Compte et clé
1. https://dashboard.flutterwave.com → créez un compte (mode Test d'abord).
2. **Settings → API Keys** → copiez la clé secrète (`FLWSECK_TEST-...`).

### b. Déployer les fonctions
```bash
supabase functions deploy flutterwave-checkout
supabase functions deploy flutterwave-webhook --no-verify-jwt
supabase secrets set FLW_SECRET_KEY=FLWSECK_TEST-xxxxxxxxxxxxx
```

### c. Créer le webhook
1. **Settings → Webhooks**.
2. URL : `https://<PROJECT_REF>.supabase.co/functions/v1/flutterwave-webhook`
3. **Secret Hash** : générez une chaîne aléatoire vous-même (`openssl rand -hex 32`), collez-la
   ici ET dans le secret Supabase ci-dessous — elle doit être identique des deux côtés.
```bash
supabase secrets set FLW_SECRET_HASH=<la_meme_chaine_aleatoire>
```

### d. Limite importante (honnête)
Flutterwave n'a pas d'équivalent au "portail self-service" de Stripe, et le renouvellement
automatique n'est pas natif pour tous les moyens de paiement (notamment Mobile Money). Le
webhook actuel active le plan pour 30 jours à chaque paiement réussi ; la **relance pour le
renouvellement du mois suivant n'est pas automatisée** — ce serait un chantier séparé (API
Payment Plans de Flutterwave, ou rappel automatique via l'automatisation email déjà en place).

### e. Tester
Mode Test Flutterwave : utilisez leurs identifiants de test Mobile Money/carte fournis dans leur
documentation (https://developer.flutterwave.com/docs/integration-guides/testing-helpers).

---

---

## 3. PayUnit (premier PSP validé pour la mise en production)

⚠️ **Cause la plus fréquente d'un webhook qui ne fonctionne jamais** : Supabase exige par défaut
un jeton (JWT) valide sur CHAQUE appel à une Edge Function. PayUnit (comme Stripe et Flutterwave)
appelle votre fonction `payunit-webhook` directement depuis ses serveurs, sans jeton Supabase —
sans le flag `--no-verify-jwt` au déploiement (voir étape b ci-dessous), Supabase **rejette
l'appel avec une erreur 401 avant même que le code de la fonction ne s'exécute**. Ce genre
d'échec n'apparaît même pas dans les logs applicatifs de la fonction, ce qui le rend difficile à
diagnostiquer sans le savoir à l'avance.

Agrégateur de paiement donnant accès aux cartes bancaires, au Mobile Money et à d'autres moyens
de paiement internationaux — pas limité à une seule région. La couverture exacte (pays, devises,
moyens de paiement) dépend du compte marchand activé par PayUnit ; vérifiez votre contrat/
tableau de bord PayUnit pour la liste à jour.

### a. Compte et identifiants
1. https://web.payunit.net → créez un compte et une application (mode Test d'abord).
2. Activez l'application (menu ⋮ de la liste des applications → **Activate**).
3. **Paramètres de l'utilisateur → API CREDENTIALS** → récupérez API user, API key et API
   password.

### b. Déployer les fonctions
```bash
supabase functions deploy payunit-checkout
supabase functions deploy payunit-webhook --no-verify-jwt
supabase secrets set PAYUNIT_API_KEY=test_xxxxxxxxxxxxx
supabase secrets set PAYUNIT_API_USERNAME=xxxxxxxxxxxxx
supabase secrets set PAYUNIT_API_PASSWORD=xxxxxxxxxxxxx
supabase secrets set PAYUNIT_MODE=test
```
`PAYUNIT_MODE` doit valoir exactement `live` pour prendre de vrais paiements — toute autre
valeur (y compris absente) reste volontairement en mode `test`, pour qu'une mauvaise
configuration ne bascule jamais accidentellement en production.

### c. Notify URL
Le `notify_url` est envoyé automatiquement par la fonction `payunit-checkout` à chaque
transaction (`https://<PROJECT_REF>.supabase.co/functions/v1/payunit-webhook`) — rien à
configurer manuellement côté tableau de bord PayUnit pour ça.

### d. Limite importante (honnête)
Comme pour Flutterwave : pas de portail self-service, et pas de renouvellement automatique
natif dans l'API REST de base — chaque paiement réussi active le plan pour 30 jours, la relance
du mois suivant reste à automatiser séparément.

### e. Devise
La fonction convertit toujours correctement le prix vers la devise choisie par le tenant (voir
la fonction `convertUsdTo()` en tête de `payunit-checkout/index.ts`). La liste exacte des devises
réellement supportées dépend de votre compte marchand PayUnit — si une devise n'est pas prise en
charge, PayUnit renverra une erreur claire au lieu d'un montant erroné. Vérifiez avec PayUnit la
liste complète des devises/pays activés sur votre compte avant le lancement.

### f. Tester
Utilisez le mode Test PayUnit et leurs identifiants de test Mobile Money fournis dans leur
documentation (https://developer.payunit.net/getting-started) avant de passer `PAYUNIT_MODE` à
`live`.

### ⚠️ Étape critique avant le lancement : vérifier le webhook avec une vraie transaction test
Deux problèmes distincts peuvent empêcher un webhook de fonctionner — vérifiez-les dans cet
ordre :

**0. Le déploiement a-t-il bien inclus `--no-verify-jwt` ?** Si vous avez déployé
`payunit-webhook` sans ce flag (ou redéployé depuis le dashboard Supabase, qui ne l'applique pas
automatiquement), chaque appel de PayUnit échoue avec une 401 au niveau de la passerelle, invisible
dans les logs de la fonction elle-même. Dans le dashboard Supabase → Edge Functions →
`payunit-webhook` → onglet **Logs**, si vous ne voyez STRICTEMENT AUCUNE invocation malgré un
paiement test terminé, c'est le symptôme classique de ce problème — redéployez avec :
```bash
supabase functions deploy payunit-webhook --no-verify-jwt
```

**1. Le nom du champ transaction_id.** La documentation PayUnit n'est pas totalement cohérente
sur le nom exact du champ qui transporte votre `transaction_id` dans la notification envoyée à
`notify_url` (`transaction_id` vs `t_id`, au niveau racine ou imbriqué sous `data`). Le code de
`payunit-webhook` vérifie déjà toutes les variantes plausibles, mais **avant de considérer
PayUnit prêt pour de vrais paiements** :
1. Faites un paiement de test complet en mode `test`.
2. Dans le tableau de bord Supabase → Edge Functions → `payunit-webhook` → Logs, vérifiez que la
   fonction a bien reçu l'appel (donc que le point 0 ci-dessus est correct) et trouvé une ligne
   correspondante dans `payunit_transactions` (pas de `{"received": true, "ignored": true}` —
   cette réponse signifie que le `transaction_id` n'a pas été retrouvé).
3. Vérifiez dans la table `payunit_transactions` que la ligne passe bien à `status = 'confirmed'`
   et que le tenant a bien été activé sur le bon plan.
Si l'étape 2 montre un payload "ignored" (et que le point 0 est bien correct), ouvrez
`supabase/functions/payunit-webhook/index.ts` et ajoutez le nom de champ réel observé dans les
logs à la liste de repli.

---

## 4. Paystack (Nigeria, Ghana, Afrique du Sud, Kenya)

### a. Compte et clé
1. https://dashboard.paystack.com → créez un compte (mode Test d'abord).
2. **Settings → API Keys & Webhooks** → copiez la clé secrète (`sk_test_...`).

### b. Déployer les fonctions
```bash
supabase functions deploy paystack-checkout
supabase functions deploy paystack-webhook --no-verify-jwt
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx
```
⚠️ **`--no-verify-jwt` est obligatoire pour `paystack-webhook`**, même raison que pour
Stripe/Flutterwave/PayUnit : Paystack appelle cette fonction directement depuis ses serveurs,
sans jeton Supabase.

### c. Configurer le webhook
Dans **Settings → API Keys & Webhooks → Webhook URL**, renseignez
`https://<PROJECT_REF>.supabase.co/functions/v1/paystack-webhook`. Notez que Paystack a des URLs
de webhook **séparées pour le mode Test et le mode Live** — configurez les deux.

### d. Devises supportées
Paystack ne facture officiellement que dans un nombre limité de devises selon le pays du compte
marchand (principalement NGN, GHS, ZAR, KES, USD). La fonction de checkout se rabat
automatiquement sur USD si la devise demandée n'est pas dans cette liste, plutôt que de risquer un
montant erroné.

### e. Signature de sécurité — particularité importante
Contrairement à Stripe/Flutterwave (HMAC-SHA256), Paystack signe ses webhooks en
**HMAC-SHA512** — c'est l'erreur la plus fréquente lors d'une implémentation manuelle. Déjà géré
correctement dans `paystack-webhook/index.ts`.

## 5. Choisir le fournisseur par défaut

`src/lib/payments.ts` expose `getPreferredProvider(countryCode)` — sélectionne automatiquement
Paystack (Nigeria/Ghana/Afrique du Sud/Kenya), PayUnit (autres marchés Mobile Money) ou Stripe
(reste du monde) selon le pays du tenant, **sauf si l'utilisateur a déjà choisi manuellement un
fournisseur** (ce choix est mémorisé et n'est plus jamais écrasé automatiquement). La page
Facturation et la page Paramètres proposent un sélecteur Stripe / Flutterwave / PayUnit /
Paystack qui passe le bon `provider` à `startCheckout()` — l'abstraction gère les quatre de façon
interchangeable, aucun autre changement de code nécessaire pour en ajouter un nouveau.
