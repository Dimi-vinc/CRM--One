# Activer le marketplace d'Intégrations

Nouveau module "Intégrations" — un catalogue de ~75 applications (IA, paiements, email,
comptabilité, e-commerce, automatisation, etc.), gratuit sur tous les plans, avec recherche,
filtres par catégorie et sous-filtre Paiements (Cartes / Mobile Money / Virements).

Catalogue complet : `src/lib/integrations.ts`. Ajouter une intégration = ajouter une entrée dans
ce fichier (elle apparaît immédiatement dans la page, sans autre changement de code).

## 1. Intégrations à clé API (fonctionnelles immédiatement)

OpenAI, Anthropic, Google Gemini, Stripe, Flutterwave, PayUnit, Twilio, Zapier, Mailchimp, et la
plupart des passerelles de paiement africaines (CamPay, CinetPay, Kkiapay, Wave, Orange Money,
MTN MoMo, etc.) fonctionnent **dès aujourd'hui** : l'utilisateur colle sa propre clé API dans la
modale "Connecter", elle est enregistrée via la fonction `save-integration-key` et stockée dans
`integration_connections` (isolée par tenant + utilisateur, RLS stricte — voir migration 0033).

Aucune configuration serveur requise pour ces intégrations : chaque utilisateur apporte sa
propre clé.

## 2. Intégrations OAuth (nécessitent une app enregistrée par vous)

Gmail et Outlook utilisent déjà leurs propres fonctions dédiées (`gmail-oauth-callback`,
`outlook-oauth-callback` — voir `EMAIL_INTEGRATIONS_SETUP.md`).

Toutes les autres intégrations OAuth (Slack, PayPal, Shopify, QuickBooks, Xero, Google
Drive/Calendar/Meet, Notion, Asana, Trello, Zendesk, Intercom, Meta/Google/LinkedIn Ads, etc.)
passent par un flux générique unique : `oauth-integration-start` + `oauth-integration-callback`,
configuré par `supabase/functions/_shared/oauth-providers.ts`.

**Tant qu'aucune app n'est enregistrée pour un fournisseur, son bouton "Connecter" affiche un
message clair ("non configuré") au lieu d'échouer silencieusement** — même principe que Stripe/
PayUnit ailleurs dans ce SaaS.

### Pour activer un fournisseur OAuth :
1. Créez une app dans la console développeur du fournisseur (ex. https://api.slack.com/apps pour
   Slack).
2. URL de redirection à déclarer chez le fournisseur :
   `https://<PROJECT_REF>.supabase.co/functions/v1/oauth-integration-callback`
3. Définissez les secrets Supabase (remplacez `SLACK` par l'id du fournisseur en MAJUSCULES,
   tirets remplacés par des underscores — ex. `revolut-business` → `REVOLUT_BUSINESS`) :
   ```bash
   supabase secrets set SLACK_CLIENT_ID=xxxxxxxx
   supabase secrets set SLACK_CLIENT_SECRET=xxxxxxxx
   ```
4. Déployez les deux fonctions génériques une seule fois (elles servent tous les fournisseurs) :
   ```bash
   supabase functions deploy oauth-integration-start
   supabase functions deploy oauth-integration-callback --no-verify-jwt
   supabase functions deploy save-integration-key
   ```
   ⚠️ `--no-verify-jwt` est obligatoire pour `oauth-integration-callback` : comme
   `gmail-oauth-callback`/`outlook-oauth-callback`, elle est atteinte par une redirection brute du
   navigateur depuis le fournisseur OAuth, sans jeton Supabase attaché. Sans ce flag, Supabase la
   rejette avec une 401 avant même que son code ne s'exécute, et "Connecter" échoue
   systématiquement sans erreur visible.

### ⚠️ À vérifier avant mise en production
Les endpoints OAuth de `_shared/oauth-providers.ts` utilisent les URLs standards documentées par
chaque fournisseur au moment de l'écriture. Certains ont des particularités (Shopify nécessite un
sous-domaine par boutique, QuickBooks/Intuit un `realmId`, Trello utilise un flux de jeton hérité
non-OAuth2 standard) — **vérifiez la documentation actuelle du fournisseur avant d'activer son
bouton "Connecter" en production**, surtout pour ceux marqués comme cas particuliers dans les
commentaires du fichier.

## 3. Intégrations internes (LiAfrik)

Libooks (`libooks.liafrik.com`) et Sellia (`sellia.liafrik.com`) sont listées à clé API, en
attendant une intégration native plus poussée si besoin.
