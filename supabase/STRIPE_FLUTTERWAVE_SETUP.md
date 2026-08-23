# Activer les paiements (Stripe + Flutterwave + PayUnit)

Le code des trois fournisseurs est prêt. Rien ne fonctionne tant que les secrets ne sont pas
configurés — mais aucun échec silencieux : les boutons afficheront un message clair
("non configuré") jusqu'à ce que ce soit fait.

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
supabase functions deploy stripe-webhook
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
```

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
supabase functions deploy flutterwave-webhook
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

Agrégateur basé au Cameroun : Orange Money, MTN Mobile Money et cartes, centré sur l'Afrique
centrale.

### a. Compte et identifiants
1. https://web.payunit.net → créez un compte et une application (mode Test d'abord).
2. Activez l'application (menu ⋮ de la liste des applications → **Activate**).
3. **Paramètres de l'utilisateur → API CREDENTIALS** → récupérez API user, API key et API
   password.

### b. Déployer les fonctions
```bash
supabase functions deploy payunit-checkout
supabase functions deploy payunit-webhook
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
PayUnit est le plus fiable en XAF (franc CFA d'Afrique centrale) ; d'autres devises dépendent de
la configuration du compte marchand. La fonction convertit toujours correctement le prix
(voir `supabase/functions/_shared/currency-rates.ts`) — si une devise n'est pas prise en charge
par votre compte, PayUnit renverra une erreur claire plutôt qu'un montant erroné.

### f. Tester
Utilisez le mode Test PayUnit et leurs identifiants de test Mobile Money fournis dans leur
documentation (https://developer.payunit.net/getting-started) avant de passer `PAYUNIT_MODE` à
`live`.

---

## 4. Choisir le fournisseur par défaut

`src/lib/payments.ts` expose `getPaymentProvider(code)` — Stripe est utilisé par défaut. La page
Facturation et la page Paramètres proposent déjà un sélecteur Stripe / Flutterwave / PayUnit qui
passe le bon `provider` à `startCheckout()` — l'abstraction gère les trois de façon
interchangeable, aucun autre changement de code nécessaire pour en ajouter un nouveau.
