# Activer les intégrations email (Gmail + Outlook — réelles)

Chaque utilisateur connecte son propre compte email (comme dans Salesforce/HubSpot). Une fois
connecté, les emails aux contacts partent depuis sa vraie adresse, pas depuis un système générique.

## 1. Gmail (Google Cloud Console)

1. https://console.cloud.google.com → créez un projet.
2. **APIs & Services → Library** → activez **Gmail API**.
3. **APIs & Services → OAuth consent screen** :
   - Type : External (ou Internal si Google Workspace)
   - Scopes à ajouter : `gmail.send`, `userinfo.email`
   - Statut : "In production" pour éviter la limite de 100 testeurs (nécessite une vérification
     Google si vous demandez des scopes sensibles — `gmail.send` en fait partie, comptez
     quelques jours de review la première fois)
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** :
   - Type : Web application
   - Authorized redirect URI : `https://<PROJECT_REF>.supabase.co/functions/v1/gmail-oauth-callback`
5. Notez le **Client ID** et le **Client Secret**.

## 2. Outlook (Azure App Registrations)

1. https://portal.azure.com → **App registrations → New registration**.
2. Redirect URI (type Web) : `https://<PROJECT_REF>.supabase.co/functions/v1/outlook-oauth-callback`
3. **API permissions → Add a permission → Microsoft Graph → Delegated** : `Mail.Send`,
   `User.Read`, `offline_access`.
4. **Certificates & secrets → New client secret** → notez sa valeur immédiatement (non
   ré-affichable).
5. Notez l'**Application (client) ID**.

## 3. Configurer les secrets Supabase (côté serveur)

⚠️ **`--no-verify-jwt` est obligatoire pour `gmail-oauth-callback` et
`outlook-oauth-callback`.** Ces deux fonctions sont atteintes par une redirection brute du
navigateur depuis Google/Microsoft après le consentement OAuth — aucun jeton Supabase n'est
attaché à cette requête. Sans ce flag, Supabase rejette la redirection avec une 401 avant même
que le code de la fonction ne s'exécute, et la connexion Gmail/Outlook échoue systématiquement
sans erreur visible côté application.

```bash
supabase functions deploy gmail-oauth-callback --no-verify-jwt
supabase functions deploy outlook-oauth-callback --no-verify-jwt
supabase functions deploy email-connection-status
supabase functions deploy disconnect-email
supabase functions deploy send-connected-email

supabase secrets set GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
supabase secrets set GOOGLE_CLIENT_SECRET=xxxxxxxxxxxx
supabase secrets set MICROSOFT_CLIENT_ID=xxxxxxxxxxxx
supabase secrets set MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxx
supabase secrets set APP_URL=https://votredomaine.com
```

## 4. Configurer les variables CÔTÉ FRONTEND (Cloudflare Pages)

Les Client ID (pas les secrets !) doivent aussi être accessibles au navigateur pour démarrer le
flux OAuth. Dans Cloudflare Pages → Settings → Environment variables, ajoutez :

```
VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
VITE_MICROSOFT_CLIENT_ID=xxxxxxxxxxxx
```

Puis redéployez (nouveau build, pas juste un redémarrage — les variables `VITE_*` sont injectées
au moment du build, pas à l'exécution).

## 5. Tester

1. Va dans **Paramètres → Intégrations email**, clique "Connecter" sur Gmail ou Outlook.
2. Autorise l'accès sur l'écran Google/Microsoft.
3. Tu es redirigé vers Paramètres avec la confirmation "Compte email connecté avec succès."

## Comment ça fonctionne

- Les tokens (access + refresh) sont stockés **uniquement côté serveur**, jamais exposés au
  frontend — aucune policy RLS n'autorise leur lecture directe, seules les Edge Functions (service
  role) y accèdent.
- Le token d'accès expire après ~1h ; il est **automatiquement rafraîchi** via le refresh_token à
  chaque envoi si nécessaire — pas besoin de reconnexion manuelle.
- Chaque envoi est journalisé (`sent_emails_log`), visible dans l'historique du contact.

## Limite honnête

Cette phase couvre la **connexion et l'envoi réel**. La **synchronisation bidirectionnelle**
(voir les emails reçus/lus depuis Gmail/Outlook directement dans le CRM, tracking d'ouverture)
n'est pas encore construite — ce serait un chantier séparé (webhooks Gmail/Graph, stockage des
threads). Dites-le-moi si vous voulez qu'on l'ajoute ensuite.
