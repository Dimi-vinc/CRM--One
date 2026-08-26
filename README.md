# CRM-One

CRM SaaS multi-tenant, frontend React/Vite hébergé sur Cloudflare Pages et backend Supabase.

## Pré-requis

- Node.js 20 ou plus récent
- Un projet Supabase
- Un dépôt GitHub/GitLab connecté à Cloudflare Pages
- Supabase CLI pour appliquer les migrations et déployer les Edge Functions

## Vérification locale

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
```

Créez un fichier `.env.local` (jamais à versionner) :

```env
VITE_SUPABASE_URL=https://VOTRE_PROJET.supabase.co
VITE_SUPABASE_ANON_KEY=VOTRE_CLE_ANON
VITE_GOOGLE_CLIENT_ID=OPTIONNEL
VITE_MICROSOFT_CLIENT_ID=OPTIONNEL
```

## Déploiement Supabase

1. Liez le projet Supabase puis appliquez toutes les migrations (dans l'ordre du dossier `supabase/migrations/`), y compris `20260805000000_0025_critical_billing_rls_enforcement.sql` qui verrouille l'accès facturation au niveau base de données.

```powershell
supabase link --project-ref VOTRE_PROJECT_REF
supabase db push
```

2. Déployez toutes les fonctions Edge. La fonction `create-email-oauth-state` est obligatoire pour les intégrations Gmail et Outlook sécurisées.

```powershell
supabase functions deploy create-email-oauth-state
supabase functions deploy gmail-oauth-callback --no-verify-jwt
supabase functions deploy outlook-oauth-callback --no-verify-jwt
supabase functions deploy email-connection-status
supabase functions deploy disconnect-email
supabase functions deploy send-connected-email
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy flutterwave-checkout
supabase functions deploy flutterwave-webhook --no-verify-jwt
supabase functions deploy submit-web-form --no-verify-jwt
```

⚠️ `--no-verify-jwt` est requis partout ci-dessus où la fonction est appelée par quelque chose
d'autre qu'une session utilisateur connectée (webhook de paiement, redirection OAuth d'un
fournisseur, ou visiteur anonyme remplissant un formulaire public) — sans ce flag, Supabase
rejette l'appel avec une 401 avant même d'exécuter le code de la fonction. Pour les autres
fonctions du projet (automatisations, API publique, chatbot/tickets publics, PayUnit,
intégrations), voir `AUTOMATIONS_SETUP.md`, `API_DOCUMENTATION.md`, `CHATBOT_SETUP.md`,
`STRIPE_FLUTTERWAVE_SETUP.md` et `INTEGRATIONS_SETUP.md`, qui documentent chacune le flag exact
requis pour leurs propres fonctions.

3. Configurez les secrets uniquement côté Supabase. Ne placez jamais ces valeurs dans Cloudflare ni dans le frontend :

```powershell
supabase secrets set APP_URL=https://crm.votredomaine.com
supabase secrets set STRIPE_SECRET_KEY=...
supabase secrets set STRIPE_WEBHOOK_SECRET=...
supabase secrets set FLW_SECRET_KEY=...
supabase secrets set FLW_WEBHOOK_HASH=...
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
supabase secrets set MICROSOFT_CLIENT_ID=... MICROSOFT_CLIENT_SECRET=...
```

Ajoutez selon les modules utilisés : `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `GROQ_API_KEY` et `AUTOMATION_DISPATCH_SECRET`.

4. Dans Google et Microsoft, déclarez les URLs de retour Supabase :

```text
https://VOTRE_PROJET.supabase.co/functions/v1/gmail-oauth-callback
https://VOTRE_PROJET.supabase.co/functions/v1/outlook-oauth-callback
```

5. Dans Stripe et Flutterwave, configurez les webhooks vers les fonctions du même nom. Seuls ces webhooks peuvent activer un abonnement ; le client ne peut pas modifier un plan ou un statut de paiement.

## Déploiement Cloudflare Pages

Dans Cloudflare Pages, créez un projet depuis votre dépôt Git :

- Commande de build : `npm ci && npm run build`
- Répertoire de sortie : `dist`
- Version Node.js : `20`

Ajoutez ces variables pour **Production** et **Preview** :

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GOOGLE_CLIENT_ID          (si Gmail est activé)
VITE_MICROSOFT_CLIENT_ID       (si Outlook est activé)
```

Après le premier déploiement, définissez cette URL publique dans le secret Supabase `APP_URL`, puis redéployez les callbacks OAuth si nécessaire. L’application utilise un routeur avec `#`, aucune règle de réécriture Cloudflare n’est requise.

## Sécurité

- Les clés `SERVICE_ROLE`, Stripe, Flutterwave, OAuth et IA restent exclusivement dans les secrets Supabase.
- Les droits et l’accès Premium sont contrôlés côté base de données et webhooks, pas par le navigateur.
- Les migrations doivent être appliquées avant la publication du frontend afin que les règles RLS et les protections d’abonnement soient actives.
