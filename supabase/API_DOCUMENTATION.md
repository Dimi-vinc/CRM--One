# API publique CRM-One (v1)

Base URL : `https://<PROJECT_REF>.supabase.co/functions/v1/api-v1`

## Authentification

```
Authorization: Bearer crm1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Générez une clé dans **API & Webhooks → Clés API** (visible en entier une seule fois à la
création — copiez-la immédiatement).

## Limite de débit

100 requêtes/minute par clé. Au-delà : `429 Too Many Requests` avec un header `Retry-After`
(secondes avant de pouvoir réessayer).

## Ressources disponibles

`contacts`, `companies`, `deals`, `tasks`

## Endpoints

### Lister (paginé)
```
GET /contacts?limit=50&offset=0
```
```json
{ "data": [...], "total": 128, "limit": 50, "offset": 0 }
```

### Récupérer un élément
```
GET /contacts/{id}
```

### Créer
```
POST /contacts
Content-Type: application/json

{ "first_name": "Jean", "last_name": "Dupont", "email": "jean@exemple.com" }
```
→ `201 Created`

### Modifier
```
PATCH /contacts/{id}
Content-Type: application/json

{ "phone": "+237600000000" }
```

### Supprimer
```
DELETE /contacts/{id}
```

## Champs autorisés en écriture

| Ressource | Champs |
|---|---|
| contacts | first_name, last_name, email, phone, company_id, country_code, city, marketing_consent |
| companies | name, industry, email, phone, website, country_code, city |
| deals | title, amount, currency_code, stage, contact_id, company_id, expected_close_date |
| tasks | title, description, due_date, priority, status |

`tenant_id` est toujours défini automatiquement à partir de votre clé API — impossible de le
modifier ou d'accéder aux données d'un autre tenant.

## Exemple (curl)

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/api-v1/contacts \
  -H "Authorization: Bearer crm1_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Jean","email":"jean@exemple.com"}'
```

---

# Webhooks sortants (Zapier, Make, n8n, custom)

Configurez une URL dans **API & Webhooks → Webhooks** et sélectionnez les événements à écouter :
`contact_added`, `deal_created`, `deal_won`, `activity_done`.

## Avec Zapier

1. Créez un Zap → déclencheur **"Webhooks by Zapier" → "Catch Hook"**.
2. Zapier vous donne une URL (`https://hooks.zapier.com/hooks/catch/...`).
3. Collez cette URL dans un nouveau webhook CRM-One, cochez les événements voulus.
4. Chaque événement déclenchera votre Zap automatiquement.

## Avec Make.com / n8n

Même principe : créez un scénario/workflow avec un déclencheur "Webhook" (Catch Hook / Webhook
Trigger), copiez son URL, collez-la dans CRM-One.

## Format du payload envoyé

```json
{
  "event": "contact_added",
  "data": { "id": "...", "first_name": "Jean", "email": "jean@exemple.com", ... },
  "timestamp": "2026-08-04T10:30:00.000Z"
}
```

## Vérifier l'authenticité (optionnel mais recommandé)

Chaque requête inclut un header `X-CRM-Signature` : HMAC-SHA256 du corps JSON brut, signé avec
le secret unique du webhook (non affiché dans l'UI pour l'instant — contactez le support si vous
avez besoin de le récupérer pour vérifier la signature côté récepteur).

## Déploiement (côté administrateur Supabase)

⚠️ **`--no-verify-jwt` est obligatoire pour les deux fonctions ci-dessous**, sinon Supabase
rejette leurs appels avant même que leur propre code ne s'exécute :
- `api-v1` est appelée par des développeurs tiers avec `Authorization: Bearer <clé API CRM-One>`
  — ce n'est pas un jeton Supabase, donc la vérification JWT par défaut la bloquerait.
- `webhook-dispatch` est appelée par un trigger PostgreSQL (`pg_net`) avec un secret partagé
  (`Authorization: Bearer <dispatch_secret>`), même situation que `automations-dispatch` (voir
  `AUTOMATIONS_SETUP.md`).

```bash
supabase functions deploy api-v1 --no-verify-jwt
supabase functions deploy webhook-dispatch --no-verify-jwt
```

Puis, dans le SQL Editor, complétez la configuration existante des automatisations avec l'URL de
la nouvelle fonction :

```sql
UPDATE public.automation_config
SET webhook_dispatch_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/webhook-dispatch'
WHERE id = true;
```

(Réutilise le même `dispatch_secret` déjà configuré pour les automatisations — rien d'autre à
faire si `AUTOMATIONS_SETUP.md` a déjà été suivi.)

## Limite honnête

- Pas de retry automatique en cas d'échec de livraison d'un webhook (visible dans l'historique de
  livraisons, mais pas re-tenté automatiquement) — un vrai système de retry avec backoff serait un
  chantier séparé si le volume le justifie.
- L'API publique couvre 4 ressources (contacts, entreprises, deals, tâches), pas l'ensemble des
  24 modules — extensible facilement si besoin de couvrir davantage.
