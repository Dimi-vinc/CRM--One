# Activer WhatsApp (Twilio) pour les automatisations

L'action "Envoyer un WhatsApp" est maintenant réellement implémentée. Elle notifie les
administrateurs du tenant (pas les contacts/clients) sur leur numéro WhatsApp renseigné dans
**Paramètres**. Setup requis une fois (10 min).

## 1. Créer un compte Twilio

1. Allez sur https://www.twilio.com/try-twilio et créez un compte (offre gratuite avec crédit
   d'essai).
2. Dans le tableau de bord, notez votre **Account SID** et votre **Auth Token**.

## 2. Activer le bac à sable WhatsApp (pour tester rapidement)

Pour tester sans validation Meta longue :
1. Console Twilio → **Messaging → Try it out → Send a WhatsApp message**.
2. Suivez les instructions pour rejoindre le sandbox (envoyer un code depuis votre WhatsApp au
   numéro Twilio fourni, ex : `+1 415 523 8886`).
3. Notez ce numéro sandbox : c'est votre `TWILIO_WHATSAPP_FROM` pour les tests.

⚠️ **Limite du sandbox** : seuls les numéros qui ont rejoint le sandbox (comme vous venez de le
faire) peuvent recevoir des messages. Pour notifier n'importe quel administrateur en production,
il faut passer à un numéro WhatsApp Business vérifié (étape 3).

## 3. Passer en production (numéro WhatsApp Business vérifié)

1. Console Twilio → **Messaging → Senders → WhatsApp senders**.
2. Suivez le processus de vérification Meta Business (peut prendre 1 à 3 jours).
3. Une fois approuvé, votre `TWILIO_WHATSAPP_FROM` devient ce numéro officiel
   (format : `whatsapp:+237XXXXXXXXX`).

## 4. Configurer les secrets

```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

## 5. Redéployer la fonction

```bash
supabase functions deploy automations-dispatch --no-verify-jwt
```
(voir `AUTOMATIONS_SETUP.md` pour l'explication : ce flag est obligatoire, la fonction est
appelée par un trigger PostgreSQL avec un secret partagé, pas un jeton Supabase.)

## 6. Chaque administrateur doit renseigner son numéro

Dans **Paramètres → Mon profil → Téléphone (WhatsApp)**, format international
(`+237600000000`). Sans numéro renseigné, l'action échoue proprement avec un message clair dans
le Journal d'exécution des Automations — jamais d'échec silencieux.

## Vérifier que ça fonctionne

1. Renseignez votre numéro dans Paramètres (et rejoignez le sandbox si vous êtes encore en test).
2. Créez une automatisation : déclencheur "Contact ajouté" → action "Envoyer un WhatsApp".
3. Ajoutez un contact, puis ouvrez **Automations → Journal d'exécution**.
