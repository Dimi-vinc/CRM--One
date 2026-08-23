# Activer l'IA (Groq — gratuite) : chatbot public + Assistant IA interne

Deux fonctionnalités partagent la même clé Groq gratuite :

1. **Chatbot de support public** (`/help/:tenantId`) : répond à partir des articles de la Base
   de connaissances marqués "publics", et bascule vers un ticket si l'IA ne peut pas répondre.
2. **Assistant IA interne** (module "Assistant IA" du CRM) : disponible pour tous les
   utilisateurs authentifiés de tous les tenants, **sur tous les plans, y compris Starter** —
   ce n'est pas une fonctionnalité premium, elle est gratuite par conception (voir
   `src/lib/constants.ts`, où `ai_assistant` figure dans les `modules` de chaque plan sans
   `minPlan`). Il aide à rédiger des emails, résumer une situation et donner des conseils CRM,
   en s'appuyant sur un aperçu chiffré (contacts, deals ouverts, tâches en retard, tickets
   ouverts) lu sous le RLS de l'utilisateur — jamais de fuite inter-tenant possible. Un plafond
   quotidien par tenant (`AI_ASSISTANT_DAILY_LIMIT`, 100 messages/jour par défaut) protège la
   clé Groq partagée pour que la fonctionnalité reste gratuite et disponible pour tous ; les
   super admins ne sont jamais plafonnés, cohérent avec le fait qu'ils ne paient aucun plan.

## 1. Créer un compte Groq (gratuit, sans carte bancaire)

1. https://console.groq.com → créez un compte.
2. **API Keys → Create API Key** → copiez la clé (`gsk_...`).

## 2. Déployer les fonctions et configurer le secret

```bash
supabase functions deploy support-chat
supabase functions deploy create-public-ticket
supabase secrets set GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx
```

## 3. Tester

1. Ajoutez au moins un article **public** dans Base de connaissances (coche "Public").
2. Ouvrez `https://votredomaine.com/#/help/<votre-tenant-id>` (l'ID est visible dans
   Paramètres ou l'URL de votre CRM).
3. Cliquez sur la bulle de chat en bas à droite, posez une question liée à un article publié.

## Comment ça marche (honnêteté sur les limites)

- **Gratuit avec limites de débit** : Groq offre un tier gratuit généreux, mais pas illimité. À
  très fort volume, un passage à un tier payant Groq pourrait devenir nécessaire — mais c'est
  loin d'être le cas pour un usage normal de support client.
- **Pas de vecteurs/embeddings** : la recherche d'articles pertinents se fait par correspondance
  de mots-clés simple, pas par recherche sémantique avancée. Efficace pour une base de
  connaissances de taille raisonnable (quelques dizaines à centaines d'articles), moins précis
  qu'un vrai moteur de recherche vectoriel sur une très grosse base.
- **Ne répond qu'à partir de vos articles publics** : si l'information n'existe pas dans un
  article marqué public, l'IA ne l'invente pas — elle propose de créer un ticket.
- **Aucune authentification requise** : n'importe quel visiteur du portail public peut discuter
  et créer un ticket (c'est le but — support client en libre-service). Les messages sont limités
  à 1000 caractères pour éviter les abus basiques.
