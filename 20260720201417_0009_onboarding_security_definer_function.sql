# Activer le moteur d'automatisations (réel)

Ce projet contient maintenant un vrai moteur d'exécution pour le module **Automations** :
déclencheurs en base (triggers Postgres) → fonction Edge → actions réelles (email, tâche,
notification, activité) → journal d'exécution visible dans l'app.

Rien de tout cela ne fonctionne tant que vous n'avez pas fait ce setup une fois (5-10 min).

## 1. Créer un compte Resend (fournisseur email choisi)

Resend a été choisi pour sa simplicité d'API et son offre gratuite généreuse (3 000 emails/mois).

1. Allez sur https://resend.com et créez un compte.
2. Dans **API Keys**, créez une clé et copiez-la (`re_xxxxxxxx`).
3. (Optionnel mais recommandé en prod) Dans **Domains**, ajoutez et vérifiez votre propre
   domaine d'envoi (ex: `notifications.votredomaine.com`). Sans ça, les emails partent depuis
   `onboarding@resend.dev`, ce qui fonctionne mais paraît moins professionnel.

## 2. Générer un secret de dispatch

Ce secret protège votre fonction Edge d'appels non autorisés. Générez une chaîne aléatoire, par
exemple avec :
```bash
openssl rand -hex 32
```
Gardez-la de côté, elle sert à l'étape 4 et 5.

## 3. Appliquer la migration

```bash
supabase db push
```
Cela crée : la colonne `automations.description` (manquante avant), la table
`automation_runs` (journal), la table `automation_config`, l'extension `pg_net`, et les
triggers sur `contacts`, `deals`, `activities`.

## 4. Déployer les fonctions Edge et leurs secrets

```bash
supabase functions deploy automations-dispatch
supabase functions deploy automations-cron

supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set AUTOMATION_DISPATCH_SECRET=<le secret généré à l'étape 2>
# Optionnel :
supabase secrets set RESEND_FROM_EMAIL=notifications@votredomaine.com
supabase secrets set PLATFORM_NAME="LiAfrik One"
```
(`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont déjà fournis automatiquement par Supabase.)

## 5. Configurer le pont base de données → fonction Edge

Dans le SQL Editor de Supabase, exécutez (remplacez `<PROJECT_REF>` et `<SECRET>`) :

```sql
insert into public.automation_config (id, edge_function_url, dispatch_secret)
values (true, 'https://<PROJECT_REF>.supabase.co/functions/v1/automations-dispatch', '<SECRET>')
on conflict (id) do update set
  edge_function_url = excluded.edge_function_url,
  dispatch_secret = excluded.dispatch_secret;
```

## 6. Planifier la vérification des tâches en retard

`automations-cron` gère le déclencheur "Tâche en retard" (basé sur le temps, pas sur un
événement ligne par ligne). Dans le Dashboard Supabase → **Edge Functions** →
`automations-cron` → **Schedule**, planifiez-la toutes les 15 minutes (`*/15 * * * *`).

## Vérifier que ça fonctionne

1. Créez une automatisation : déclencheur "Contact ajouté" → action "Notifier l'équipe".
2. Ajoutez un contact.
3. Ouvrez **Automations → Journal d'exécution** : une ligne "succès" doit apparaître en
   quelques secondes.

## Ce qui est réellement câblé (et ce qui ne l'est pas encore)

| Déclencheur | Statut |
|---|---|
| Deal créé, Deal gagné, Contact ajouté, Activité terminée | ✅ trigger DB temps réel |
| Tâche en retard | ✅ via `automations-cron` planifiée |
| Facture payée, Ticket ouvert | ❌ retirés de la liste : aucune table de facturation/tickets n'existe encore dans le schéma. À ajouter si ces modules sont construits. |

| Action | Statut |
|---|---|
| Envoyer un email, Créer une tâche, Notifier l'équipe, Créer une activité | ✅ implémentées |
| Mettre à jour le deal, Envoyer WhatsApp | ❌ retirées de la liste : nécessitent une UI de configuration supplémentaire (quel champ mettre à jour ?) ou un fournisseur tiers (WhatsApp Business API/Twilio) non encore choisi. |
