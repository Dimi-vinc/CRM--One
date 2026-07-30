# Activer les paiements (Stripe + Flutterwave)

Le code des deux fournisseurs est prêt. Rien ne fonctionne tant que les secrets ne sont pas
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

## 3. Choisir le fournisseur par défaut

`src/lib/payments.ts` expose `getPaymentProvider(code)` — Stripe est utilisé par défaut. Pour
proposer le choix à l'utilisateur (ex: Stripe pour cartes internationales, Flutterwave pour
Mobile Money africain), il suffit d'ajouter un sélecteur dans `Billing.tsx` qui passe
`provider: 'flutterwave'` à `startCheckout()` — l'abstraction gère déjà les deux de façon
interchangeable, aucun autre changement de code nécessaire.
