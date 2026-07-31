# Activer le chatbot de support (Groq — gratuit)

Widget de chat IA sur le portail public d'aide (`/help/:tenantId`), qui répond à partir de vos
articles de la Base de connaissances marqués "publics", et bascule automatiquement vers la
création d'un ticket support si l'IA ne peut pas répondre ou si le client demande un humain.

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
